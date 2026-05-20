// Scenario projection engine — pure aggregation on top of resolveFee.
//
// `projectScenario` takes a fee schedule's base_config, the current set of
// assignments (denormalized + light), occupancy assumptions, and returns
// the right-pane payload that the editor displays live (total, byTier,
// byHolderState, byLeaseType, perHolder).
//
// This is pure — no DB, no clock — so it's trivially unit-testable and
// the editor can run it in either the server action OR client-side preview
// (we keep it server-side for the canonical answer; client recompute is
// purely advisory until the action returns).

import {
  resolveFee,
  type FeeSchedule,
  type HolderState,
  type LeaseType,
  type SlipTier,
} from "@/lib/pricing/resolve";
import { roundToCents } from "@/lib/utils/round";

/* ============================================================
 * Input shapes
 * ============================================================ */

export interface ProjectionAssignment {
  /** Stable id for diffing per-holder vs. an alternate scenario. */
  holderId: string;
  holderName: string;
  holderState: HolderState;
  slipNumber: string;
  slipTier: SlipTier;
  slipFeeModifier: number;
  vesselLoaFt: number | null;
  leaseType: LeaseType;
  /** For TRANSIENT only: how many nights this assignment represents. */
  nights?: number;
  /** Buy-in gating — defaults to false if the caller can't compute it. */
  isFirstSeason?: boolean;
}

export interface OccupancyAssumptions {
  /** Fraction (0-1) of full-season slots that we assume will be filled. */
  fullSeasonPct: number;
  halfSeason1Pct: number;
  halfSeason2Pct: number;
  /** Average transient nights per slip per year — multiplies the per-night rate. */
  transientNightsPerSlipPerYear: number;
}

export const DEFAULT_OCCUPANCY: OccupancyAssumptions = {
  fullSeasonPct: 1.0,
  halfSeason1Pct: 0.92,
  halfSeason2Pct: 0.88,
  transientNightsPerSlipPerYear: 22,
};

export interface ProjectionInput {
  feeSchedule: FeeSchedule;
  assignments: ReadonlyArray<ProjectionAssignment>;
  occupancy?: Partial<OccupancyAssumptions>;
  /** Season year is required by resolveFee but doesn't change the math here. */
  seasonYear: number;
}

/* ============================================================
 * Output shapes
 * ============================================================ */

export interface PerHolderImpact {
  holderId: string;
  holderName: string;
  slipNumber: string;
  fee: number;
  /** Sum of per-line-item amounts for debugging / display. */
  components: Array<{ kind: string; description: string; amount: number }>;
}

export interface ProjectionResult {
  /** Banker-rounded final total in dollars. */
  total: number;
  /** Total by slip tier (Premium / Standard / Restricted). */
  byTier: Record<string, number>;
  /** Total by holder state (resident-owner / resident-renter / etc.). */
  byHolderState: Record<string, number>;
  /** Total by lease type (FULL_SEASON / HALF_SEASON_1 / HALF_SEASON_2 / TRANSIENT). */
  byLeaseType: Record<string, number>;
  /** Per-holder fees — used for the impact table + winners/losers list. */
  perHolder: PerHolderImpact[];
  /** Count of assignments that were skipped because resolveFee threw. */
  skippedCount: number;
  /** Reasons individual assignments were skipped, if any. */
  skipped: Array<{ holderId: string; reason: string }>;
}

/* ============================================================
 * Compare result — used by /compare page + 9.5 server action.
 * ============================================================ */

export interface PerHolderDelta {
  holderId: string;
  holderName: string;
  slipNumber: string;
  baselineFee: number;
  scenarioFee: number;
  delta: number;
  deltaPct: number;
}

export interface CompareResult {
  baselineTotal: number;
  scenarioTotal: number;
  delta: number;
  deltaPct: number;
  perHolderDeltas: PerHolderDelta[];
  /** Top winners (negative delta == pays less) and losers (positive delta). */
  topWinners: PerHolderDelta[];
  topLosers: PerHolderDelta[];
}

/* ============================================================
 * projectScenario — the core projection routine
 * ============================================================ */

export function projectScenario(input: ProjectionInput): ProjectionResult {
  const occupancy: OccupancyAssumptions = {
    ...DEFAULT_OCCUPANCY,
    ...(input.occupancy ?? {}),
  };

  const byTier: Record<string, number> = { Premium: 0, Standard: 0, Restricted: 0 };
  const byHolderState: Record<string, number> = {
    "resident-owner": 0,
    "resident-renter": 0,
    "non-resident-owner": 0,
    "non-resident": 0,
  };
  const byLeaseType: Record<string, number> = {
    FULL_SEASON: 0,
    HALF_SEASON_1: 0,
    HALF_SEASON_2: 0,
    TRANSIENT: 0,
  };
  const perHolder: PerHolderImpact[] = [];
  const skipped: Array<{ holderId: string; reason: string }> = [];

  let total = 0;

  for (const a of input.assignments) {
    try {
      // Per-lease-type occupancy weighting. We compute the fee at full
      // occupancy, then scale by the assumption — this matches Linda's
      // mental model: "what if 88% of half-2 slots actually book?"
      const occWeight = occupancyWeight(a.leaseType, occupancy);

      const nights =
        a.leaseType === "TRANSIENT"
          ? a.nights ?? occupancy.transientNightsPerSlipPerYear
          : undefined;

      const { total: rawTotal, lineItems } = resolveFee(
        { state: a.holderState },
        { tier: a.slipTier, fee_modifier: a.slipFeeModifier },
        a.leaseType,
        input.feeSchedule,
        {
          year: input.seasonYear,
          nights,
          vesselLoaFt: a.vesselLoaFt ?? undefined,
          isFirstSeason: a.isFirstSeason,
        },
      );

      const weightedFee = rawTotal * occWeight;
      const fee = roundToCents(weightedFee);

      total += fee;
      byTier[a.slipTier] = (byTier[a.slipTier] ?? 0) + fee;
      byHolderState[a.holderState] = (byHolderState[a.holderState] ?? 0) + fee;
      byLeaseType[a.leaseType] = (byLeaseType[a.leaseType] ?? 0) + fee;

      perHolder.push({
        holderId: a.holderId,
        holderName: a.holderName,
        slipNumber: a.slipNumber,
        fee,
        components: lineItems.map((li) => ({
          kind: li.kind,
          description: li.description,
          amount: li.amount,
        })),
      });
    } catch (err) {
      // resolveFee throws FeeResolutionError on bad inputs (e.g., transient
      // without vessel LOA). We surface the count + reasons rather than
      // aborting the whole projection — Linda needs to see the rest.
      skipped.push({
        holderId: a.holderId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    total: roundToCents(total),
    byTier: roundRecord(byTier),
    byHolderState: roundRecord(byHolderState),
    byLeaseType: roundRecord(byLeaseType),
    perHolder,
    skippedCount: skipped.length,
    skipped,
  };
}

/* ============================================================
 * compareScenarios — pairs two projections + builds a delta table.
 * ============================================================ */

export function compareScenarios(
  baseline: ProjectionResult,
  scenario: ProjectionResult,
  options?: { topN?: number },
): CompareResult {
  const topN = options?.topN ?? 10;
  const baselineByHolder = new Map(baseline.perHolder.map((h) => [h.holderId, h]));

  const perHolderDeltas: PerHolderDelta[] = scenario.perHolder.map((s) => {
    const b = baselineByHolder.get(s.holderId);
    const baselineFee = b?.fee ?? 0;
    const delta = roundToCents(s.fee - baselineFee);
    const deltaPct = baselineFee === 0 ? 0 : (delta / baselineFee) * 100;
    return {
      holderId: s.holderId,
      holderName: s.holderName,
      slipNumber: s.slipNumber,
      baselineFee,
      scenarioFee: s.fee,
      delta,
      deltaPct: roundToCents(deltaPct),
    };
  });

  // Winners = lowest delta (most negative); losers = highest delta.
  const sortedByDelta = [...perHolderDeltas].sort((a, b) => a.delta - b.delta);
  const topWinners = sortedByDelta.slice(0, topN).filter((d) => d.delta < 0);
  const topLosers = sortedByDelta
    .slice(-topN)
    .filter((d) => d.delta > 0)
    .reverse();

  const totalDelta = roundToCents(scenario.total - baseline.total);
  const totalDeltaPct =
    baseline.total === 0 ? 0 : roundToCents((totalDelta / baseline.total) * 100);

  return {
    baselineTotal: baseline.total,
    scenarioTotal: scenario.total,
    delta: totalDelta,
    deltaPct: totalDeltaPct,
    perHolderDeltas,
    topWinners,
    topLosers,
  };
}

/* ============================================================
 * Helpers
 * ============================================================ */

function occupancyWeight(leaseType: LeaseType, occ: OccupancyAssumptions): number {
  switch (leaseType) {
    case "FULL_SEASON":
      return clamp01(occ.fullSeasonPct);
    case "HALF_SEASON_1":
      return clamp01(occ.halfSeason1Pct);
    case "HALF_SEASON_2":
      return clamp01(occ.halfSeason2Pct);
    case "TRANSIENT":
      // For transient, the "occupancy" assumption is built into nights/year
      // by the caller (we threaded it through season.nights above). We don't
      // scale the per-assignment total again, otherwise we'd double-count.
      return 1;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 1) return n > 100 ? 1 : n / 100;
  return n;
}

function roundRecord(rec: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = roundToCents(v);
  return out;
}
