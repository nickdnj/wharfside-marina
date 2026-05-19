# Pricing Engine Test Fixtures

**Purpose:** Lock down `resolveFee()` correctness with deterministic test cases. Per QA-STRATEGY §3.1, this is the **single highest-value test investment** in the project — wrong money is the most damaging class of bug.

**Engine spec:** `lib/pricing/resolve.ts` — Architecture §7.3
**Schedule loaded for all cases:** `docs/pricing/fee-schedule-fy26-seed.json`
**Companion test file:** `src/lib/pricing/__tests__/resolve.test.ts` (TODO, EPIC-1B)

---

## Algorithm recap (from Architecture §7.3)

```
TRANSIENT:
  total = vessel.loa_ft × $4.50 × nights

Annual (FULL_SEASON | HALF_SEASON_1 | HALF_SEASON_2):
  base    = base_rates_by_tier[slip.tier].annual
          × holder_multipliers[mapped_state]    (resident=0.75, non_resident=1.00)
          × lease_type_multipliers[leaseType]   (FULL=1.00, HALF=0.55)
          × slip.fee_modifier                   (per-slip, typically 0.90–1.10)
  amenity = 350 if mapped_state == 'non_resident' else 0
            × 0.50 if leaseType is HALF_SEASON_*  ← LOCKED 2026-05-19 (Q-AMENPRO1 resolved)
  total   = base + amenity + buy_in (currently 0)
```

Holder state → multiplier mapping (locked 2026-05-19; see `fee-schedule-fy26-seed.json` `_holder_state_mapping`):

| PRD holder state | Pricing bucket | Multiplier |
|---|---|---|
| resident-owner | resident | 0.75 |
| resident-renter | resident | 0.75 |
| non-resident-owner | non_resident_owner | 0.85 *(Modeler-driven placeholder)* |
| non-resident | non_resident | 1.00 |

**Note:** The non_resident_owner multiplier 0.85 is a placeholder. The board will set the final value via Scenario Modeler simulation before FY27. The engine reads it from `fee_schedule.base_config.holder_multipliers.non_resident_owner` — never hardcoded. All fixture cases for non_resident_owner below assume the placeholder; regenerate expected totals when the board sets the real value.

---

## Fixture cases (17)

### Group A — Annual matrix on Standard slip (fee_modifier=1.00)

Covers 4 holder states × FULL + HALF lease types. Validates: holder multiplier, lease-type multiplier, amenity waiver, amenity half-proration. Amenity is waived for `resident` only — non_resident_owner pays amenity like non_resident.

| # | Holder state | Slip tier | fee_mod | Lease type | Base calc | Base | Amenity | **Total** |
|---|---|---|---|---|---|---|---|---|
| A1 | resident-owner | Standard | 1.00 | FULL_SEASON | 3500 × 0.75 × 1.00 × 1.00 | 2625.00 | 0.00 | **$2,625.00** |
| A2 | resident-renter | Standard | 1.00 | FULL_SEASON | 3500 × 0.75 × 1.00 × 1.00 | 2625.00 | 0.00 | **$2,625.00** |
| A3 | non-resident-owner | Standard | 1.00 | FULL_SEASON | 3500 × 0.85 × 1.00 × 1.00 | 2975.00 | 350.00 | **$3,325.00** |
| A4 | non-resident | Standard | 1.00 | FULL_SEASON | 3500 × 1.00 × 1.00 × 1.00 | 3500.00 | 350.00 | **$3,850.00** |
| A5 | resident-owner | Standard | 1.00 | HALF_SEASON_1 | 3500 × 0.75 × 0.55 × 1.00 | 1443.75 | 0.00 | **$1,443.75** |
| A6a | non-resident-owner | Standard | 1.00 | HALF_SEASON_1 | 3500 × 0.85 × 0.55 × 1.00 | 1636.25 | 175.00 | **$1,811.25** |
| A6 | non-resident | Standard | 1.00 | HALF_SEASON_1 | 3500 × 1.00 × 0.55 × 1.00 | 1925.00 | 175.00 | **$2,100.00** |
| A7 | resident-owner | Standard | 1.00 | HALF_SEASON_2 | 3500 × 0.75 × 0.55 × 1.00 | 1443.75 | 0.00 | **$1,443.75** |
| A8 | non-resident | Standard | 1.00 | HALF_SEASON_2 | 3500 × 1.00 × 0.55 × 1.00 | 1925.00 | 175.00 | **$2,100.00** |

**Invariants asserted:**
- A1 == A2 (resident-owner and resident-renter price identically under locked mapping)
- A3 < A4 (non-resident-owner gets discount vs. pure non-resident — "owners always get a discount")
- A1 < A3 < A4 (resident < non_resident_owner < non_resident — the ordering reflects the discount hierarchy)
- A5 == A7 (half-1 and half-2 same-priced; midpoint date irrelevant to formula)
- A6 < A8 — wait, A6 is the non-resident-OWNER half-season case (renamed A6a) — A6 with renaming: A6a < A6, paralleling A3 < A4
- Amenity is waived for `resident` only; non_resident_owner pays amenity (A3, A6a both have $350/$175 amenity)

### Group B — Premium tier with slip fee_modifier (surcharge stacking)

Covers: tier-specific base rate, slip-level fee_modifier multiplied on top of holder + lease multipliers.

| # | Holder state | Slip tier | fee_mod | Lease type | Base calc | Base | Amenity | **Total** |
|---|---|---|---|---|---|---|---|---|
| B1 | resident-owner | Premium | 1.10 (corner) | FULL_SEASON | 4500 × 0.75 × 1.00 × 1.10 | 3712.50 | 0.00 | **$3,712.50** |
| B2 | non-resident | Premium | 1.00 | FULL_SEASON | 4500 × 1.00 × 1.00 × 1.00 | 4500.00 | 350.00 | **$4,850.00** |
| B3 | non-resident | Premium | 1.10 (corner) | HALF_SEASON_1 | 4500 × 1.00 × 0.55 × 1.10 | 2722.50 | 175.00 | **$2,897.50** |

**Invariants asserted:**
- B1 > A1 (Premium with corner surcharge > Standard for same holder)
- B2 - A4 == 1000 (Premium full-season minus Standard full-season for same non-resident == $1000 raw delta)
- B3 fee_modifier stacks correctly: 4500 × 0.55 = 2475, then × 1.10 = 2722.50 (proves order of operations)

### Group C — Restricted tier with discount fee_modifier

Covers: low-tier base rate, fee_modifier < 1.00 (a tidal-limited slip).

| # | Holder state | Slip tier | fee_mod | Lease type | Base calc | Base | Amenity | **Total** |
|---|---|---|---|---|---|---|---|---|
| C1 | resident-owner | Restricted | 0.90 (tidal) | FULL_SEASON | 2800 × 0.75 × 1.00 × 0.90 | 1890.00 | 0.00 | **$1,890.00** |
| C2 | non-resident | Restricted | 1.00 | HALF_SEASON_2 | 2800 × 1.00 × 0.55 × 1.00 | 1540.00 | 175.00 | **$1,715.00** |

**Invariants asserted:**
- C1 < A1 (Restricted tidal < Standard for same holder)
- fee_modifier 0.90 correctly reduces base (not amenity)

### Group D — Transient (per-foot per-night, branch 1 of algorithm)

Covers: TRANSIENT bypasses all tier/holder/lease multipliers; uses LOA × per_foot × nights.

| # | Vessel LOA | Nights | Holder state | Slip tier | Slip fee_mod | Calc | **Total** |
|---|---|---|---|---|---|---|---|
| D1 | 24.0 ft | 2 | (any) | (any) | (any) | 24 × 4.50 × 2 | **$216.00** |
| D2 | 38.0 ft | 3 | non-resident | Standard | 1.00 | 38 × 4.50 × 3 | **$513.00** |
| D3 | 45.0 ft | 7 | non-resident | Premium | 1.10 | 45 × 4.50 × 7 | **$1,417.50** |

**Invariants asserted:**
- D3 confirms: even on a Premium slip with fee_modifier 1.10, transient pricing does NOT multiply by tier or fee_modifier. If the engine returns ~$1,559, it's wrong.
- D2 calculated total to assert exactly: `2025 / 4` doesn't apply — straight multiplication.
- Holder state irrelevant for transient (engine should not even read `holder` in this branch beyond logging).

### Group E — Edge cases

#### E1. Rounding to cents — banker's rounding (half-to-even), LOCKED 2026-05-19

Standard slip with unusual fee_modifier (1.075), resident-owner, HALF_SEASON_1:
- Calc: 3500 × 0.75 × 0.55 × 1.075 = 1552.03125
- Banker's rounding (half-to-even): 1552.03**125** → third decimal is 1, round down → **$1,552.03**
- Edge case to also test: any total ending in exactly .xx5 where xx is even should round DOWN (e.g., 100.005 → 100.00), and ending in .xx5 where xx is odd should round UP (e.g., 100.015 → 100.02).

**Implementation:** JavaScript's `Math.round` is half-away-from-zero, NOT half-to-even, so don't use it. Either use a small helper or pull in `decimal.js` with `ROUND_HALF_EVEN`. Apply rounding to the FINAL total only — intermediate base/amenity values stay at full precision.

```ts
// Helper for half-to-even at 2 decimals
function roundToCentsBanker(x: number): number {
  const scaled = x * 100;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  if (diff < 0.5) return floor / 100;
  if (diff > 0.5) return (floor + 1) / 100;
  // exactly .5 → round to even
  return (floor % 2 === 0 ? floor : floor + 1) / 100;
}
```

#### E2. Transient on Premium slip ignores tier and fee_modifier

Vessel 38ft, 3 nights, on Premium-corner slip (fee_modifier 1.10):
- Wrong (if engine accidentally multiplies): 38 × 4.50 × 3 × 1.10 = 564.30
- Right: **$513.00** (same as D2)
- This is a regression test against a plausible future bug.

#### E3. Amenity waiver for resident-renter (mapped to resident)

resident-renter on any non-Premium slip, FULL_SEASON, $0 amenity:
- A2 already covers this (total $2,625.00, amenity 0.00). E3 is documentation that the lookup `mapped_state == 'resident' → amenity = 0` works regardless of whether the holder owns at WMCA or rents.

---

## Suggested Vitest skeleton

```ts
// src/lib/pricing/__tests__/resolve.test.ts
import { describe, it, expect } from "vitest";
import { resolveFee } from "../resolve";
import schedule from "@/../docs/pricing/fee-schedule-fy26-seed.json";

const cases = [
  { id: "A1", holder: { state: "resident-owner" }, slip: { tier: "Standard", fee_modifier: 1.00 }, leaseType: "FULL_SEASON", expectTotal: 2625.00 },
  { id: "A2", holder: { state: "resident-renter" }, slip: { tier: "Standard", fee_modifier: 1.00 }, leaseType: "FULL_SEASON", expectTotal: 2625.00 },
  { id: "A3", holder: { state: "non-resident-owner" }, slip: { tier: "Standard", fee_modifier: 1.00 }, leaseType: "FULL_SEASON", expectTotal: 3325.00 },
  { id: "A4", holder: { state: "non-resident" }, slip: { tier: "Standard", fee_modifier: 1.00 }, leaseType: "FULL_SEASON", expectTotal: 3850.00 },
  { id: "A5", holder: { state: "resident-owner" }, slip: { tier: "Standard", fee_modifier: 1.00 }, leaseType: "HALF_SEASON_1", expectTotal: 1443.75 },
  { id: "A6a", holder: { state: "non-resident-owner" }, slip: { tier: "Standard", fee_modifier: 1.00 }, leaseType: "HALF_SEASON_1", expectTotal: 1811.25 },
  { id: "A6", holder: { state: "non-resident" }, slip: { tier: "Standard", fee_modifier: 1.00 }, leaseType: "HALF_SEASON_1", expectTotal: 2100.00 },
  { id: "A7", holder: { state: "resident-owner" }, slip: { tier: "Standard", fee_modifier: 1.00 }, leaseType: "HALF_SEASON_2", expectTotal: 1443.75 },
  { id: "A8", holder: { state: "non-resident" }, slip: { tier: "Standard", fee_modifier: 1.00 }, leaseType: "HALF_SEASON_2", expectTotal: 2100.00 },
  { id: "B1", holder: { state: "resident-owner" }, slip: { tier: "Premium", fee_modifier: 1.10 }, leaseType: "FULL_SEASON", expectTotal: 3712.50 },
  { id: "B2", holder: { state: "non-resident" }, slip: { tier: "Premium", fee_modifier: 1.00 }, leaseType: "FULL_SEASON", expectTotal: 4850.00 },
  { id: "B3", holder: { state: "non-resident" }, slip: { tier: "Premium", fee_modifier: 1.10 }, leaseType: "HALF_SEASON_1", expectTotal: 2897.50 },
  { id: "C1", holder: { state: "resident-owner" }, slip: { tier: "Restricted", fee_modifier: 0.90 }, leaseType: "FULL_SEASON", expectTotal: 1890.00 },
  { id: "C2", holder: { state: "non-resident" }, slip: { tier: "Restricted", fee_modifier: 1.00 }, leaseType: "HALF_SEASON_2", expectTotal: 1715.00 },
];

describe("resolveFee — annual leases", () => {
  it.each(cases)("$id → $$expectTotal", ({ holder, slip, leaseType, expectTotal }) => {
    const { total } = resolveFee(holder as any, slip as any, leaseType as any, schedule as any, { year: 2026 } as any);
    expect(total).toBeCloseTo(expectTotal, 2);
  });
});

describe("resolveFee — transient", () => {
  it("D1: 24ft × 2 nights = $216", () => { /* ... */ });
  it("D2: 38ft × 3 nights = $513", () => { /* ... */ });
  it("D3: 45ft × 7 nights, Premium slip → still $1,417.50 (no tier multiplier)", () => { /* ... */ });
});

describe("resolveFee — edge cases", () => {
  it("E1: rounds to 2 decimals consistently", () => { /* ... */ });
  it("E2: transient ignores slip.fee_modifier", () => { /* ... */ });
  it("E3: resident-renter gets amenity waiver same as resident-owner", () => { /* ... */ });
});
```

---

## Decision log

**Locked 2026-05-19 (Nick):**

1. ✅ **Q-AMENPRO1 — Half-season amenity proration.** RESOLVED: 0.50× of annual amenity (used in A6, A6a, A8, B3, C2).
2. ✅ **Resident-renter vs resident-owner pricing.** RESOLVED: identical (A1 == A2). Both map to `resident` bucket (0.75×).
3. ✅ **Owners always get a discount.** RESOLVED: schema expanded from 2 to 3 buckets: `resident` (0.75), `non_resident_owner` (0.85 placeholder), `non_resident` (1.00). Non-resident-owners get a discount vs. pure non-residents.
4. ✅ **Non-resident-owner discount magnitude.** RESOLVED: intentionally **Modeler-driven** — board sets via Scenario Modeler simulation before FY27. Placeholder 0.85 used in fixtures; engine reads from config, never hardcoded. When the board locks the real value, regenerate the expected totals in A3, A6a, and any other non_resident_owner cases.
5. ✅ **Rounding rule.** RESOLVED: banker's rounding (half-to-even, IEEE 754). Applied to final total only; intermediates stay at full precision. See E1 for helper code.

## Schema implication — RESOLVED 2026-05-19

**Updated:** `holder.holder_type` now stores 4 values: `resident_owner`, `resident_renter`, `non_resident_owner`, `non_resident`. The CHECK constraint was tightened to `holder_type = 'non_resident' OR wharfside_unit_number IS NOT NULL` — any WMCA connection (residency or ownership) requires a unit number; only pure outsiders may omit it.

Pricing-bucket lookup happens in the engine via `_holder_state_mapping` in the fee schedule (4 holder_types → 3 pricing buckets). Engine never hardcodes the mapping — read from config.

Changes applied:
- `src/db/schema.ts` — holder table CHECK constraints updated
- `docs/architecture/ARCHITECTURE.md` §4.1 — holder table SQL updated, pricing-bucket mapping table added

## Still open

1. **Buy-in.** Currently $0. If board reintroduces, add buy-in cases (and decide if non_resident_owner is subject — likely yes per the "applies_to: non_resident*" pattern).

2. **Premium surcharge for transient.** Architecture §7.3 step 1: transient = LOA × per_foot × nights with no tier multiplier. A Premium slip is structurally worth more for a transient too. Decide for v2.

3. **Does amenity waiver extend to non_resident_owner?** Currently no — only `resident` gets the waiver. If the board wants ownership to confer amenity-waiver status (parallel to the base-rate discount), update `amenity_fee.waived_for` to include `non_resident_owner`. Currently treated as a separate axis: ownership = base-rate discount, residency = amenity waiver.
