import { describe, it, expect } from "vitest";
import {
  resolveFee,
  FeeResolutionError,
  type FeeSchedule,
  type HolderState,
  type LeaseType,
  type SlipTier,
} from "../resolve";
import { roundToCents } from "@/lib/utils/round";
import schedule from "../../../../docs/pricing/fee-schedule-fy26-seed.json";

// Cast the JSON to our schedule contract. The fixture has _meta keys we
// don't care about for resolution; the runtime ignores them.
const FY26 = schedule as unknown as FeeSchedule;

// Small builder helpers to make table-driven cases legible.
function holderOf(state: HolderState) {
  return { state };
}
function slipOf(tier: SlipTier, feeMod: number) {
  return { tier, fee_modifier: feeMod };
}

interface AnnualCase {
  id: string;
  state: HolderState;
  tier: SlipTier;
  feeMod: number;
  leaseType: Exclude<LeaseType, "TRANSIENT">;
  expectTotal: number;
}

const annualCases: AnnualCase[] = [
  // ---- Group A: Annual matrix on Standard (fee_modifier = 1.00) ------------
  { id: "A1", state: "resident-owner", tier: "Standard", feeMod: 1.0, leaseType: "FULL_SEASON", expectTotal: 2625.0 },
  { id: "A2", state: "resident-renter", tier: "Standard", feeMod: 1.0, leaseType: "FULL_SEASON", expectTotal: 2625.0 },
  { id: "A3", state: "non-resident-owner", tier: "Standard", feeMod: 1.0, leaseType: "FULL_SEASON", expectTotal: 3325.0 },
  { id: "A4", state: "non-resident", tier: "Standard", feeMod: 1.0, leaseType: "FULL_SEASON", expectTotal: 3850.0 },
  { id: "A5", state: "resident-owner", tier: "Standard", feeMod: 1.0, leaseType: "HALF_SEASON_1", expectTotal: 1443.75 },
  { id: "A6a", state: "non-resident-owner", tier: "Standard", feeMod: 1.0, leaseType: "HALF_SEASON_1", expectTotal: 1811.25 },
  { id: "A6", state: "non-resident", tier: "Standard", feeMod: 1.0, leaseType: "HALF_SEASON_1", expectTotal: 2100.0 },
  { id: "A7", state: "resident-owner", tier: "Standard", feeMod: 1.0, leaseType: "HALF_SEASON_2", expectTotal: 1443.75 },
  { id: "A8", state: "non-resident", tier: "Standard", feeMod: 1.0, leaseType: "HALF_SEASON_2", expectTotal: 2100.0 },
  // ---- Group B: Premium tier with slip fee_modifier ------------------------
  { id: "B1", state: "resident-owner", tier: "Premium", feeMod: 1.1, leaseType: "FULL_SEASON", expectTotal: 3712.5 },
  { id: "B2", state: "non-resident", tier: "Premium", feeMod: 1.0, leaseType: "FULL_SEASON", expectTotal: 4850.0 },
  { id: "B3", state: "non-resident", tier: "Premium", feeMod: 1.1, leaseType: "HALF_SEASON_1", expectTotal: 2897.5 },
  // ---- Group C: Restricted tier with discount fee_modifier -----------------
  { id: "C1", state: "resident-owner", tier: "Restricted", feeMod: 0.9, leaseType: "FULL_SEASON", expectTotal: 1890.0 },
  { id: "C2", state: "non-resident", tier: "Restricted", feeMod: 1.0, leaseType: "HALF_SEASON_2", expectTotal: 1715.0 },
];

describe("resolveFee — Group A/B/C: annual lease matrix (14 cases)", () => {
  for (const c of annualCases) {
    it(`${c.id}: ${c.state} on ${c.tier} (×${c.feeMod}) ${c.leaseType} → $${c.expectTotal.toFixed(2)}`, () => {
      const result = resolveFee(
        holderOf(c.state),
        slipOf(c.tier, c.feeMod),
        c.leaseType,
        FY26,
        { year: 2026 },
      );
      expect(result.total).toBeCloseTo(c.expectTotal, 2);
      // Stronger: exact match at 2dp (banker's rounding makes this safe).
      expect(Math.round(result.total * 100)).toBe(Math.round(c.expectTotal * 100));
    });
  }
});

describe("resolveFee — Group A invariants (the cross-case properties)", () => {
  const standardFull = (s: HolderState) =>
    resolveFee(holderOf(s), slipOf("Standard", 1.0), "FULL_SEASON", FY26, { year: 2026 }).total;
  const standardHalf1 = (s: HolderState) =>
    resolveFee(holderOf(s), slipOf("Standard", 1.0), "HALF_SEASON_1", FY26, { year: 2026 }).total;
  const standardHalf2 = (s: HolderState) =>
    resolveFee(holderOf(s), slipOf("Standard", 1.0), "HALF_SEASON_2", FY26, { year: 2026 }).total;

  it("A1 == A2 (resident-owner and resident-renter price identically)", () => {
    expect(standardFull("resident-owner")).toBe(standardFull("resident-renter"));
  });

  it("A1 < A3 < A4 (resident < non_resident_owner < non_resident — owners discount)", () => {
    expect(standardFull("resident-owner")).toBeLessThan(standardFull("non-resident-owner"));
    expect(standardFull("non-resident-owner")).toBeLessThan(standardFull("non-resident"));
  });

  it("A5 == A7 (half-1 and half-2 same-priced for same holder)", () => {
    expect(standardHalf1("resident-owner")).toBe(standardHalf2("resident-owner"));
  });

  it("A6a < A6 (non-resident-owner half-season < non-resident half-season)", () => {
    expect(standardHalf1("non-resident-owner")).toBeLessThan(standardHalf1("non-resident"));
  });

  it("amenity is waived for resident bucket only — resident_renter pays $0 amenity", () => {
    const { lineItems } = resolveFee(
      holderOf("resident-renter"),
      slipOf("Standard", 1.0),
      "FULL_SEASON",
      FY26,
      { year: 2026 },
    );
    const amenity = lineItems.find((li) => li.kind === "AMENITY");
    expect(amenity).toBeUndefined();
  });

  it("non_resident_owner pays amenity (not waived) — line item present", () => {
    const { lineItems } = resolveFee(
      holderOf("non-resident-owner"),
      slipOf("Standard", 1.0),
      "FULL_SEASON",
      FY26,
      { year: 2026 },
    );
    const amenity = lineItems.find((li) => li.kind === "AMENITY");
    expect(amenity).toBeDefined();
    expect(amenity?.amount).toBe(350.0);
  });

  it("half-season amenity is prorated to $175 for non-resident", () => {
    const { lineItems } = resolveFee(
      holderOf("non-resident"),
      slipOf("Standard", 1.0),
      "HALF_SEASON_1",
      FY26,
      { year: 2026 },
    );
    const amenity = lineItems.find((li) => li.kind === "AMENITY");
    expect(amenity?.amount).toBe(175.0);
  });
});

describe("resolveFee — Group B invariants", () => {
  it("B1 > A1 (Premium corner > Standard for same holder)", () => {
    const b1 = resolveFee(holderOf("resident-owner"), slipOf("Premium", 1.1), "FULL_SEASON", FY26, { year: 2026 }).total;
    const a1 = resolveFee(holderOf("resident-owner"), slipOf("Standard", 1.0), "FULL_SEASON", FY26, { year: 2026 }).total;
    expect(b1).toBeGreaterThan(a1);
  });

  it("B2 - A4 == 1000 (Premium full-season minus Standard full-season for non-resident == $1000)", () => {
    const b2 = resolveFee(holderOf("non-resident"), slipOf("Premium", 1.0), "FULL_SEASON", FY26, { year: 2026 }).total;
    const a4 = resolveFee(holderOf("non-resident"), slipOf("Standard", 1.0), "FULL_SEASON", FY26, { year: 2026 }).total;
    expect(b2 - a4).toBeCloseTo(1000, 2);
  });

  it("B3 order-of-operations: fee_modifier applied to base after holder+lease (not amenity)", () => {
    // 4500 × 1.00 × 0.55 = 2475, then × 1.10 = 2722.50; amenity 175 → 2897.50
    const { lineItems, total } = resolveFee(
      holderOf("non-resident"),
      slipOf("Premium", 1.1),
      "HALF_SEASON_1",
      FY26,
      { year: 2026 },
    );
    expect(total).toBe(2897.5);
    const base = lineItems.find((li) => li.kind === "BASE");
    const amenity = lineItems.find((li) => li.kind === "AMENITY");
    expect(base?.amount).toBe(2722.5);
    expect(amenity?.amount).toBe(175.0); // proves fee_modifier did NOT touch amenity
  });
});

describe("resolveFee — Group C: Restricted tier", () => {
  it("C1 < A1 (Restricted tidal < Standard)", () => {
    const c1 = resolveFee(holderOf("resident-owner"), slipOf("Restricted", 0.9), "FULL_SEASON", FY26, { year: 2026 }).total;
    const a1 = resolveFee(holderOf("resident-owner"), slipOf("Standard", 1.0), "FULL_SEASON", FY26, { year: 2026 }).total;
    expect(c1).toBeLessThan(a1);
  });

  it("fee_modifier 0.90 reduces base but NOT amenity (proven by non-resident half-season case C2)", () => {
    // C2 has feeMod 1.00 so we use a hypothetical to assert the property.
    const { lineItems } = resolveFee(
      holderOf("non-resident"),
      slipOf("Restricted", 0.9),
      "HALF_SEASON_2",
      FY26,
      { year: 2026 },
    );
    const amenity = lineItems.find((li) => li.kind === "AMENITY");
    // Amenity is half-prorated to 175.00 regardless of slip fee_modifier.
    expect(amenity?.amount).toBe(175.0);
  });
});

describe("resolveFee — Group D: Transient (3 cases, per-foot per-night)", () => {
  // The contract: pass vesselLoaFt and nights via the season payload. The
  // engine ignores holder + slip tier + fee_modifier for transient pricing.
  function transient(vesselLoaFt: number, nights: number, slipTier: SlipTier = "Standard", feeMod = 1.0, state: HolderState = "non-resident") {
    return resolveFee(
      holderOf(state),
      slipOf(slipTier, feeMod),
      "TRANSIENT",
      FY26,
      { year: 2026, nights, vesselLoaFt },
    );
  }

  it("D1: 24ft × $4.50 × 2 nights = $216.00 (holder/slip ignored)", () => {
    const { total } = transient(24.0, 2);
    expect(total).toBe(216.0);
  });

  it("D2: 38ft × $4.50 × 3 nights = $513.00 on Standard slip", () => {
    const { total } = transient(38.0, 3, "Standard", 1.0);
    expect(total).toBe(513.0);
  });

  it("D3: 45ft × $4.50 × 7 nights = $1,417.50 on PREMIUM slip with feeMod 1.10 — tier ignored", () => {
    const { total } = transient(45.0, 7, "Premium", 1.1);
    expect(total).toBe(1417.5);
    // Regression sentinel: the bug-shape would multiply by feeMod → 1559.25.
    expect(total).not.toBeCloseTo(1559.25, 2);
  });

  it("emits a single TRANSIENT line item, no AMENITY/BUY_IN", () => {
    const { lineItems } = transient(30, 1);
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]?.kind).toBe("TRANSIENT");
  });

  it("throws if nights missing or non-positive", () => {
    expect(() =>
      resolveFee(holderOf("non-resident"), slipOf("Standard", 1.0), "TRANSIENT", FY26, { year: 2026, vesselLoaFt: 30 }),
    ).toThrow(FeeResolutionError);
    expect(() =>
      resolveFee(holderOf("non-resident"), slipOf("Standard", 1.0), "TRANSIENT", FY26, { year: 2026, nights: 0, vesselLoaFt: 30 }),
    ).toThrow(FeeResolutionError);
  });

  it("throws if vesselLoaFt missing", () => {
    expect(() =>
      resolveFee(holderOf("non-resident"), slipOf("Standard", 1.0), "TRANSIENT", FY26, { year: 2026, nights: 1 }),
    ).toThrow(FeeResolutionError);
  });
});

describe("resolveFee — Group E: edge cases", () => {
  it("E1: banker's rounding on unusual fee_modifier — 3500 × 0.75 × 0.55 × 1.075 → $1,552.03", () => {
    // FIXTURES.md §E1 lists the expected total as 1551.89, but the literal
    // product 3500 × 0.75 × 0.55 × 1.075 = 1552.03125 (verify by hand:
    // 1443.75 × 1.075 = 1443.75 + 1443.75 × 0.075 = 1443.75 + 108.28125 = 1552.03125).
    // Banker's at 2dp: 3rd-decimal digit is 1 (< 5) → rounds down to 1552.03.
    //
    // We assert the arithmetically correct total. The fixture document has
    // a stated-vs-computed mismatch (flagged to author); a correct engine
    // cannot match both the listed math and the listed total. The point of
    // E1 is to exercise the rounding helper, which is verified below at
    // the boundary the fixture intended (the exactly-.005 third-decimal case).
    const { total } = resolveFee(
      holderOf("resident-owner"),
      slipOf("Standard", 1.075),
      "HALF_SEASON_1",
      FY26,
      { year: 2026 },
    );
    expect(total).toBe(1552.03);
  });

  it("E1 (rounding helper): demonstrates banker's-rounding at the .005 boundary used by the engine", () => {
    // The actual purpose of E1 is to lock in banker's rounding behavior.
    // Verify directly via a synthetic total that hits the exact boundary.
    // The pricing engine routes its final total through roundToCents; the
    // helper's own tests cover the half-to-even semantics exhaustively
    // (see utils/__tests__/round.test.ts).
    expect(roundToCents(100.005)).toBe(100.0); // floor 10000 even → stays
    expect(roundToCents(100.015)).toBe(100.02); // floor 10001 odd → up
  });

  it("E2: TRANSIENT on Premium-corner slip ignores fee_modifier — $513, not $564.30", () => {
    const { total } = resolveFee(
      holderOf("non-resident"),
      slipOf("Premium", 1.1),
      "TRANSIENT",
      FY26,
      { year: 2026, nights: 3, vesselLoaFt: 38 },
    );
    expect(total).toBe(513.0);
    expect(total).not.toBeCloseTo(564.3, 2);
  });

  it("E3: amenity waiver applies to resident-renter (mapped to resident), $0 amenity, total $2625", () => {
    const { total, lineItems } = resolveFee(
      holderOf("resident-renter"),
      slipOf("Standard", 1.0),
      "FULL_SEASON",
      FY26,
      { year: 2026 },
    );
    expect(total).toBe(2625.0);
    expect(lineItems.find((li) => li.kind === "AMENITY")).toBeUndefined();
  });
});

describe("resolveFee — error paths (defensive contract)", () => {
  it("throws on unknown tier", () => {
    expect(() =>
      resolveFee(
        holderOf("non-resident"),
        { tier: "Unknown" as SlipTier, fee_modifier: 1.0 },
        "FULL_SEASON",
        FY26,
        { year: 2026 },
      ),
    ).toThrow(FeeResolutionError);
  });

  it("throws when holder state not mapped in schedule", () => {
    const broken = {
      ...FY26,
      _holder_state_mapping: { "non-resident": "non_resident" }, // missing others
    };
    expect(() =>
      resolveFee(
        holderOf("resident-owner"),
        slipOf("Standard", 1.0),
        "FULL_SEASON",
        broken,
        { year: 2026 },
      ),
    ).toThrow(FeeResolutionError);
  });
});
