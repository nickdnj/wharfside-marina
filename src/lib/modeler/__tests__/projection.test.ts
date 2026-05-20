import { describe, it, expect } from "vitest";

import {
  projectScenario,
  compareScenarios,
  DEFAULT_OCCUPANCY,
  type ProjectionAssignment,
} from "../projection";
import type { FeeSchedule } from "@/lib/pricing/resolve";

// FY26 seed schedule (matches docs/pricing/fee-schedule-fy26-seed.json).
const FY26_SCHEDULE: FeeSchedule = {
  model: "tier_based",
  base_rates_by_tier: {
    Premium: { annual: 4500 },
    Standard: { annual: 3500 },
    Restricted: { annual: 2800 },
  },
  holder_multipliers: {
    resident: 0.75,
    non_resident_owner: 0.85,
    non_resident: 1.0,
  },
  lease_type_multipliers: {
    FULL_SEASON: 1.0,
    HALF_SEASON_1: 0.55,
    HALF_SEASON_2: 0.55,
    TRANSIENT: null,
  },
  transient_per_foot_per_night: 4.5,
  amenity_fee: {
    annual: 350,
    waived_for_resident: true,
    half_season_proration: 0.5,
  },
  buy_in: { amount: 0, applies_to: ["non_resident"] },
  premium_surcharge_uses_slip_fee_modifier: true,
  _holder_state_mapping: {
    "resident-owner": "resident",
    "resident-renter": "resident",
    "non-resident-owner": "non_resident_owner",
    "non-resident": "non_resident",
  },
};

function asg(overrides: Partial<ProjectionAssignment> = {}): ProjectionAssignment {
  return {
    holderId: "h1",
    holderName: "Joe Petracco",
    holderState: "resident-owner",
    slipNumber: "47",
    slipTier: "Standard",
    slipFeeModifier: 1.0,
    vesselLoaFt: 27,
    leaseType: "FULL_SEASON",
    isFirstSeason: false,
    ...overrides,
  };
}

describe("projectScenario — totals and breakdowns", () => {
  it("computes total = sum of per-assignment fees at 100% occupancy", () => {
    const assignments = [asg(), asg({ holderId: "h2", slipNumber: "48" })];
    const result = projectScenario({
      feeSchedule: FY26_SCHEDULE,
      assignments,
      occupancy: { ...DEFAULT_OCCUPANCY, fullSeasonPct: 1 },
      seasonYear: 2027,
    });
    // Standard resident full-season: 3500 * 0.75 * 1.0 * 1.0 = 2625; amenity waived; 2 holders = 5250.
    expect(result.total).toBe(5250);
    expect(result.byTier.Standard).toBe(5250);
    expect(result.byHolderState["resident-owner"]).toBe(5250);
    expect(result.byLeaseType.FULL_SEASON).toBe(5250);
  });

  it("scales by occupancy assumption (88% half-2)", () => {
    const assignments = [asg({ leaseType: "HALF_SEASON_2" })];
    const result = projectScenario({
      feeSchedule: FY26_SCHEDULE,
      assignments,
      occupancy: { ...DEFAULT_OCCUPANCY, halfSeason2Pct: 0.5 },
      seasonYear: 2027,
    });
    // Half-2 resident: 3500 * 0.75 * 0.55 * 1.0 = 1443.75; amenity waived (resident); × 0.5 occupancy = 721.88.
    expect(result.total).toBeGreaterThan(700);
    expect(result.total).toBeLessThan(730);
  });

  it("non-resident pays amenity fee", () => {
    const assignments = [
      asg({ holderState: "non-resident", holderId: "n1" }),
    ];
    const result = projectScenario({
      feeSchedule: FY26_SCHEDULE,
      assignments,
      occupancy: { ...DEFAULT_OCCUPANCY, fullSeasonPct: 1 },
      seasonYear: 2027,
    });
    // Standard non-resident full-season: 3500 * 1.0 * 1.0 * 1.0 + 350 amenity = 3850.
    expect(result.total).toBe(3850);
  });

  it("captures resolveFee failures in `skipped` without aborting", () => {
    const assignments = [
      asg(), // good
      asg({
        // TRANSIENT without vessel LOA → resolveFee throws.
        leaseType: "TRANSIENT",
        vesselLoaFt: null,
        holderId: "h2",
        nights: 3,
      }),
    ];
    const result = projectScenario({
      feeSchedule: FY26_SCHEDULE,
      assignments,
      occupancy: DEFAULT_OCCUPANCY,
      seasonYear: 2027,
    });
    expect(result.skippedCount).toBe(1);
    expect(result.skipped[0]?.holderId).toBe("h2");
    // The valid row still contributed to the total.
    expect(result.total).toBeGreaterThan(0);
  });

  it("emits perHolder row per assignment", () => {
    const assignments = [
      asg({ holderId: "h1" }),
      asg({ holderId: "h2", slipNumber: "48" }),
    ];
    const result = projectScenario({
      feeSchedule: FY26_SCHEDULE,
      assignments,
      occupancy: DEFAULT_OCCUPANCY,
      seasonYear: 2027,
    });
    expect(result.perHolder).toHaveLength(2);
    expect(result.perHolder[0]?.holderId).toBe("h1");
    expect(result.perHolder[0]?.fee).toBeGreaterThan(0);
  });
});

describe("compareScenarios", () => {
  it("computes per-holder deltas and total delta", () => {
    const a = projectScenario({
      feeSchedule: FY26_SCHEDULE,
      assignments: [asg()],
      occupancy: DEFAULT_OCCUPANCY,
      seasonYear: 2027,
    });
    // Bump base rates 10% → scenario should be higher.
    const bumped: FeeSchedule = {
      ...FY26_SCHEDULE,
      base_rates_by_tier: {
        Premium: { annual: 4500 * 1.1 },
        Standard: { annual: 3500 * 1.1 },
        Restricted: { annual: 2800 * 1.1 },
      },
    };
    const b = projectScenario({
      feeSchedule: bumped,
      assignments: [asg()],
      occupancy: DEFAULT_OCCUPANCY,
      seasonYear: 2027,
    });
    const cmp = compareScenarios(a, b);
    expect(cmp.delta).toBeGreaterThan(0);
    expect(cmp.perHolderDeltas).toHaveLength(1);
    expect(cmp.perHolderDeltas[0]?.delta).toBeGreaterThan(0);
    expect(cmp.topLosers).toHaveLength(1); // pays more
    expect(cmp.topWinners).toHaveLength(0);
  });

  it("classifies winners (negative delta) and losers (positive delta)", () => {
    const baseA = projectScenario({
      feeSchedule: FY26_SCHEDULE,
      assignments: [
        asg({ holderId: "a", holderName: "Alpha" }),
        asg({ holderId: "b", holderName: "Beta" }),
      ],
      seasonYear: 2027,
    });

    // Drop the resident multiplier from 0.75 to 0.50 — residents pay less.
    const cheaperResidents: FeeSchedule = {
      ...FY26_SCHEDULE,
      holder_multipliers: { ...FY26_SCHEDULE.holder_multipliers, resident: 0.5 },
    };
    const baseB = projectScenario({
      feeSchedule: cheaperResidents,
      assignments: [
        asg({ holderId: "a", holderName: "Alpha" }),
        asg({ holderId: "b", holderName: "Beta" }),
      ],
      seasonYear: 2027,
    });
    const cmp = compareScenarios(baseA, baseB);
    expect(cmp.delta).toBeLessThan(0);
    expect(cmp.topWinners.length).toBeGreaterThan(0);
    expect(cmp.topLosers.length).toBe(0);
  });
});
