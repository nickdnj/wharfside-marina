// Pricing engine — pure function, deterministic, no DB.
// Architecture §7.3 / FIXTURES.md.
//
// Same function powers both the Active engine (resolveFee with active
// schedule) and the Scenario Modeler (resolveFee with scenario schedule).
// Same code, different input. Do not branch on "is this a scenario" — the
// whole point is that the resolver doesn't know.

import { roundToCents } from "@/lib/utils/round";

// ---------------------------------------------------------------------------
// Contract types — these become the public surface of the pricing engine.
// Any change here is a breaking change for callers.
// ---------------------------------------------------------------------------

/**
 * PRD's 4 holder states (locked 2026-05-19). The engine maps these into the
 * fee schedule's 3 pricing buckets via `_holder_state_mapping` in config —
 * never hardcoded.
 */
export type HolderState =
  | "resident-owner"
  | "resident-renter"
  | "non-resident-owner"
  | "non-resident";

export type LeaseType = "FULL_SEASON" | "HALF_SEASON_1" | "HALF_SEASON_2" | "TRANSIENT";

export type SlipTier = "Premium" | "Standard" | "Restricted";

/**
 * Pricing bucket name as keyed in `holder_multipliers`. The schedule may
 * define more or fewer than three — the engine just looks them up by name.
 */
export type PricingBucket = string;

export interface Holder {
  /** PRD holder state (4 values). Mapped to a bucket by the schedule. */
  state: HolderState;
}

export interface Slip {
  tier: SlipTier;
  /** Per-slip multiplier, typically 0.90–1.10. Applied to base only. */
  fee_modifier: number;
}

export interface Vessel {
  loa_ft: number;
}

export interface Season {
  year: number;
  /** For TRANSIENT only: stay length, in nights. */
  nights?: number;
  /**
   * For TRANSIENT only: vessel LOA, in feet. Architecture §7.3 transient
   * pricing keys off vessel LOA, but the `resolveFee` signature locked in
   * §7.1 takes (holder, slip, leaseType, schedule, season) — no vessel
   * param. We thread vessel LOA through `season` for the transient branch
   * to keep the signature stable. The annual branch ignores this field.
   */
  vesselLoaFt?: number;
  /**
   * For BUY_IN gating: whether this is the holder's first season. The
   * engine doesn't reach into the DB to figure this out; the caller has
   * that context.
   */
  isFirstSeason?: boolean;
}

export interface BaseRatesByTier {
  [tier: string]: { annual: number };
}

export interface HolderMultipliers {
  [bucket: string]: number | string | undefined;
}

export interface LeaseTypeMultipliers {
  FULL_SEASON: number;
  HALF_SEASON_1: number;
  HALF_SEASON_2: number;
  TRANSIENT: number | null;
}

export interface AmenityFee {
  annual: number;
  waived_for_resident: boolean;
  /** Multiplier applied to amenity when leaseType is a half-season. Defaults to 1 (no proration). */
  half_season_proration?: number;
}

export interface BuyIn {
  amount: number;
  /** List of buckets (NOT raw PRD states) the buy-in applies to. */
  applies_to: PricingBucket[];
}

export interface FeeSchedule {
  model: string;
  base_rates_by_tier: BaseRatesByTier;
  holder_multipliers: HolderMultipliers;
  lease_type_multipliers: LeaseTypeMultipliers;
  transient_per_foot_per_night: number;
  amenity_fee: AmenityFee;
  buy_in: BuyIn;
  premium_surcharge_uses_slip_fee_modifier: boolean;
  _holder_state_mapping: { [state: string]: string };
}

export type LineItemKind =
  | "BASE"
  | "AMENITY"
  | "BUY_IN"
  | "TRANSIENT";

export interface LineItem {
  kind: LineItemKind;
  description: string;
  amount: number;
}

export interface ResolveFeeResult {
  total: number;
  lineItems: LineItem[];
}

// ---------------------------------------------------------------------------
// Typed errors — never throw strings.
// ---------------------------------------------------------------------------

export class FeeResolutionError extends Error {
  override readonly name = "FeeResolutionError";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the fee for an assignment.
 *
 * Pure function: no DB, no clock, no environment access. Same inputs →
 * same outputs forever. This is the property that makes the Scenario
 * Modeler honest.
 *
 * Algorithm — Architecture §7.3:
 *
 *   TRANSIENT:
 *     total = vessel.loa_ft × transient_per_foot_per_night × nights
 *
 *   Annual (FULL_SEASON | HALF_SEASON_1 | HALF_SEASON_2):
 *     base    = base_rates_by_tier[slip.tier].annual
 *             × holder_multipliers[mapped_state]
 *             × lease_type_multipliers[leaseType]
 *             × slip.fee_modifier  (if premium_surcharge_uses_slip_fee_modifier)
 *     amenity = amenity_fee.annual, waived for the 'resident' bucket
 *               (× half_season_proration if leaseType is a half-season)
 *     buy_in  = buy_in.amount if applies and isFirstSeason, else 0
 *     total   = base + amenity + buy_in
 *
 * Banker's rounding is applied to the final total only; line item amounts
 * carry their pre-rounding values for transparency, but `total` is rounded.
 */
export function resolveFee(
  holder: Holder,
  slip: Slip,
  leaseType: LeaseType,
  feeSchedule: FeeSchedule,
  season: Season,
): ResolveFeeResult {
  // ---- Branch 1: TRANSIENT --------------------------------------------------
  if (leaseType === "TRANSIENT") {
    return resolveTransient(holder, slip, feeSchedule, season);
  }

  // ---- Branch 2: Annual -----------------------------------------------------
  return resolveAnnual(holder, slip, leaseType, feeSchedule, season);
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

function resolveTransient(
  _holder: Holder,
  _slip: Slip,
  feeSchedule: FeeSchedule,
  season: Season,
): ResolveFeeResult {
  const nights = season.nights;
  if (typeof nights !== "number" || !Number.isFinite(nights) || nights <= 0) {
    throw new FeeResolutionError(
      `TRANSIENT lease requires season.nights > 0, got ${String(nights)}`,
    );
  }

  // Transient pricing keys off vessel LOA, which we receive via the
  // season payload (see Season.vesselLoaFt for the rationale).
  const loaFt = season.vesselLoaFt;
  if (typeof loaFt !== "number" || !Number.isFinite(loaFt) || loaFt <= 0) {
    throw new FeeResolutionError(
      "TRANSIENT lease requires season.vesselLoaFt > 0 (the per-foot pricing input)",
    );
  }

  const perFoot = feeSchedule.transient_per_foot_per_night;
  if (typeof perFoot !== "number" || perFoot <= 0) {
    throw new FeeResolutionError(
      `Fee schedule missing transient_per_foot_per_night (got ${String(perFoot)})`,
    );
  }

  const raw = loaFt * perFoot * nights;
  const total = roundToCents(raw);

  return {
    total,
    lineItems: [
      {
        kind: "TRANSIENT",
        description: `Transient: ${loaFt}ft × $${perFoot.toFixed(2)}/ft × ${nights} nights`,
        amount: total,
      },
    ],
  };
}

function resolveAnnual(
  holder: Holder,
  slip: Slip,
  leaseType: Exclude<LeaseType, "TRANSIENT">,
  feeSchedule: FeeSchedule,
  season: Season,
): ResolveFeeResult {
  // 1. Resolve pricing bucket from PRD holder state via config mapping.
  const bucket = mapHolderStateToBucket(holder.state, feeSchedule);

  // 2. Base.
  const tierRate = feeSchedule.base_rates_by_tier[slip.tier];
  if (!tierRate || typeof tierRate.annual !== "number") {
    throw new FeeResolutionError(
      `Fee schedule has no annual rate for tier '${slip.tier}'`,
    );
  }
  const holderMult = readNumericMultiplier(
    feeSchedule.holder_multipliers,
    bucket,
    `holder_multipliers['${bucket}']`,
  );
  const leaseMult = feeSchedule.lease_type_multipliers[leaseType];
  if (typeof leaseMult !== "number") {
    throw new FeeResolutionError(
      `Fee schedule has no numeric multiplier for leaseType '${leaseType}'`,
    );
  }

  let base = tierRate.annual * holderMult * leaseMult;
  if (feeSchedule.premium_surcharge_uses_slip_fee_modifier) {
    if (typeof slip.fee_modifier !== "number" || !Number.isFinite(slip.fee_modifier)) {
      throw new FeeResolutionError(
        `Slip fee_modifier must be a finite number, got ${String(slip.fee_modifier)}`,
      );
    }
    base = base * slip.fee_modifier;
  }

  // 3. Amenity.
  const amenityFee = feeSchedule.amenity_fee;
  let amenity = 0;
  const amenityWaived = amenityFee.waived_for_resident && bucket === "resident";
  if (!amenityWaived) {
    amenity = amenityFee.annual;
    if (leaseType === "HALF_SEASON_1" || leaseType === "HALF_SEASON_2") {
      const proration = amenityFee.half_season_proration ?? 1;
      amenity = amenity * proration;
    }
  }

  // 4. Buy-in.
  let buyIn = 0;
  if (
    season.isFirstSeason === true &&
    feeSchedule.buy_in.applies_to.includes(bucket) &&
    feeSchedule.buy_in.amount > 0
  ) {
    buyIn = feeSchedule.buy_in.amount;
  }

  // 5. Total — banker's rounding applied to the FINAL total only.
  const rawTotal = base + amenity + buyIn;
  const total = roundToCents(rawTotal);

  const lineItems: LineItem[] = [
    {
      kind: "BASE",
      description: `${slip.tier} ${leaseType} base (bucket=${bucket}, holderMult=${holderMult}, leaseMult=${leaseMult}, feeMod=${slip.fee_modifier})`,
      amount: roundToCents(base),
    },
  ];
  if (amenity !== 0) {
    lineItems.push({
      kind: "AMENITY",
      description: amenityFee.half_season_proration && leaseType !== "FULL_SEASON"
        ? `Amenity (half-season prorated ×${amenityFee.half_season_proration})`
        : "Amenity",
      amount: roundToCents(amenity),
    });
  }
  if (buyIn !== 0) {
    lineItems.push({
      kind: "BUY_IN",
      description: `Buy-in (${bucket}, first season)`,
      amount: roundToCents(buyIn),
    });
  }

  return { total, lineItems };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapHolderStateToBucket(state: HolderState, schedule: FeeSchedule): PricingBucket {
  const mapping = schedule._holder_state_mapping;
  if (!mapping || typeof mapping !== "object") {
    throw new FeeResolutionError(
      "Fee schedule missing _holder_state_mapping (cannot map PRD state → pricing bucket)",
    );
  }
  const bucket = mapping[state];
  if (typeof bucket !== "string" || bucket.length === 0) {
    throw new FeeResolutionError(
      `No pricing bucket configured for holder state '${state}' in _holder_state_mapping`,
    );
  }
  return bucket;
}

function readNumericMultiplier(
  source: HolderMultipliers,
  key: string,
  contextLabel: string,
): number {
  const raw = source[key];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new FeeResolutionError(
      `${contextLabel} must be a finite number, got ${String(raw)}`,
    );
  }
  return raw;
}
