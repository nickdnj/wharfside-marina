import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
  },
  schema: {},
}));

import {
  APPFOLIO_CSV_HEADERS,
  APPFOLIO_CHARGE_TYPES,
  buildRows,
  rowsToCsv,
  mapLineItemToChargeType,
  mapHolderTypeToState,
  AppFolioExportError,
  type DenormalizedAssignment,
} from "../export";
import type { FeeSchedule } from "@/lib/pricing/resolve";
import schedule from "../../../../docs/pricing/fee-schedule-fy26-seed.json";

const FY26 = schedule as unknown as FeeSchedule;

function makeAssignment(overrides: Partial<DenormalizedAssignment> = {}): DenormalizedAssignment {
  return {
    assignmentId: 1,
    leaseType: "FULL_SEASON",
    chargeDate: "2026-04-15",
    holder: { id: 100, state: "non-resident", unit_code: null },
    slip: { slip_number: "B12", tier: "Standard", fee_modifier: 1.0 },
    vessel: { loa_ft: 32 },
    ...overrides,
  };
}

describe("APPFOLIO_CSV_HEADERS — locked schema", () => {
  it("matches the locked column order exactly", () => {
    expect([...APPFOLIO_CSV_HEADERS]).toEqual([
      "holder_id",
      "unit_code",
      "slip_number",
      "season_year",
      "charge_type",
      "charge_date",
      "amount",
      "description",
    ]);
  });

  it("contains no PII column names (no email, phone, registration, policy, name)", () => {
    const pii = /email|phone|registration|policy|ssn|insurance_/i;
    for (const h of APPFOLIO_CSV_HEADERS) {
      expect(h).not.toMatch(pii);
    }
  });
});

describe("rowsToCsv", () => {
  it("emits headers, one row, trailing newline", () => {
    const csv = rowsToCsv([
      {
        holder_id: "100",
        unit_code: "",
        slip_number: "B12",
        season_year: "2026",
        charge_type: "SLIP_FULL_SEASON",
        charge_date: "2026-04-15",
        amount: "3500.00",
        description: "Standard FULL_SEASON base",
      },
    ]);
    const expected =
      "holder_id,unit_code,slip_number,season_year,charge_type,charge_date,amount,description\n" +
      "100,,B12,2026,SLIP_FULL_SEASON,2026-04-15,3500.00,Standard FULL_SEASON base\n";
    expect(csv).toBe(expected);
  });

  it("quotes fields containing commas", () => {
    const csv = rowsToCsv([
      {
        holder_id: "1",
        unit_code: "",
        slip_number: "A1",
        season_year: "2026",
        charge_type: "AMENITY",
        charge_date: "2026-04-15",
        amount: "350.00",
        description: "Amenity, prorated",
      },
    ]);
    expect(csv).toContain(',"Amenity, prorated"\n');
  });

  it("escapes embedded double quotes", () => {
    const csv = rowsToCsv([
      {
        holder_id: "1",
        unit_code: "",
        slip_number: "A1",
        season_year: "2026",
        charge_type: "AMENITY",
        charge_date: "2026-04-15",
        amount: "350.00",
        description: 'He said "hi"',
      },
    ]);
    expect(csv).toContain('"He said ""hi"""');
  });
});

describe("buildRows — fixture-driven row generation", () => {
  it("FULL_SEASON non-resident: 2 rows (base + amenity) on same slip", () => {
    const rows = buildRows({
      assignments: [makeAssignment({ holder: { id: 100, state: "non-resident", unit_code: null } })],
      schedule: FY26,
      seasonYear: 2026,
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.charge_type).sort()).toEqual(["AMENITY", "SLIP_FULL_SEASON"]);
    const baseRow = rows.find((r) => r.charge_type === "SLIP_FULL_SEASON");
    const amenityRow = rows.find((r) => r.charge_type === "AMENITY");
    expect(baseRow?.amount).toBe("3500.00");
    expect(amenityRow?.amount).toBe("350.00");
  });

  it("FULL_SEASON resident-owner: 1 row (base only — amenity waived)", () => {
    const rows = buildRows({
      assignments: [
        makeAssignment({
          holder: { id: 101, state: "resident-owner", unit_code: "204" },
        }),
      ],
      schedule: FY26,
      seasonYear: 2026,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.charge_type).toBe("SLIP_FULL_SEASON");
    expect(rows[0]?.amount).toBe("2625.00");
    expect(rows[0]?.unit_code).toBe("204");
  });

  it("HALF_SEASON_1 non-resident: 2 rows with HALF_1 base + prorated amenity", () => {
    const rows = buildRows({
      assignments: [
        makeAssignment({
          leaseType: "HALF_SEASON_1",
          holder: { id: 102, state: "non-resident", unit_code: null },
        }),
      ],
      schedule: FY26,
      seasonYear: 2026,
    });
    expect(rows).toHaveLength(2);
    const baseRow = rows.find((r) => r.charge_type === "SLIP_HALF_SEASON_1");
    const amenityRow = rows.find((r) => r.charge_type === "AMENITY");
    expect(baseRow?.amount).toBe("1925.00");
    expect(amenityRow?.amount).toBe("175.00");
  });

  it("TRANSIENT: 1 row, charge_type TRANSIENT, computed from vessel LOA + nights", () => {
    const rows = buildRows({
      assignments: [
        makeAssignment({
          leaseType: "TRANSIENT",
          nights: 3,
          vessel: { loa_ft: 38 },
        }),
      ],
      schedule: FY26,
      seasonYear: 2026,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.charge_type).toBe("TRANSIENT");
    expect(rows[0]?.amount).toBe("513.00"); // 38 × 4.50 × 3
  });

  it("multiple assignments → flat row list (no duplicates per holder×slip×charge_type)", () => {
    const a1 = makeAssignment({
      assignmentId: 1,
      holder: { id: 100, state: "non-resident", unit_code: null },
      slip: { slip_number: "B12", tier: "Standard", fee_modifier: 1.0 },
    });
    const a2 = makeAssignment({
      assignmentId: 2,
      holder: { id: 101, state: "resident-owner", unit_code: "204" },
      slip: { slip_number: "C03", tier: "Premium", fee_modifier: 1.1 },
    });
    const rows = buildRows({ assignments: [a1, a2], schedule: FY26, seasonYear: 2026 });
    expect(rows).toHaveLength(3); // a1: 2 rows (base+amenity), a2: 1 row (base only, amenity waived)

    // No duplicate (holder_id, slip_number, charge_type) keys.
    const keys = rows.map((r) => `${r.holder_id}|${r.slip_number}|${r.charge_type}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("resident holders show unit_code, non-resident shows empty string (NOT null)", () => {
    const rows = buildRows({
      assignments: [
        makeAssignment({
          holder: { id: 1, state: "resident-renter", unit_code: "501" },
        }),
        makeAssignment({
          holder: { id: 2, state: "non-resident", unit_code: null },
        }),
      ],
      schedule: FY26,
      seasonYear: 2026,
    });
    const residentRow = rows.find((r) => r.holder_id === "1");
    const nonresRow = rows.find((r) => r.holder_id === "2");
    expect(residentRow?.unit_code).toBe("501");
    expect(nonresRow?.unit_code).toBe("");
    // It must literally be the empty string, not "null" or "undefined".
    expect(nonresRow?.unit_code).not.toBe("null");
  });
});

describe("buildRows — output value contracts (QA §3.6)", () => {
  function makeAllRows() {
    return buildRows({
      assignments: [
        makeAssignment({ holder: { id: 100, state: "non-resident", unit_code: null }, leaseType: "FULL_SEASON" }),
        makeAssignment({ assignmentId: 2, holder: { id: 101, state: "resident-owner", unit_code: "204" }, leaseType: "HALF_SEASON_1" }),
        makeAssignment({ assignmentId: 3, leaseType: "TRANSIENT", nights: 2, vessel: { loa_ft: 24 } }),
      ],
      schedule: FY26,
      seasonYear: 2026,
    });
  }

  it("every charge_type is in the locked enum", () => {
    const rows = makeAllRows();
    const validSet: ReadonlySet<string> = new Set<string>(APPFOLIO_CHARGE_TYPES);
    for (const row of rows) {
      expect(validSet.has(row.charge_type)).toBe(true);
    }
  });

  it("every amount is exactly 2 decimal places (regex /^-?\\d+\\.\\d{2}$/)", () => {
    const rows = makeAllRows();
    for (const row of rows) {
      expect(row.amount).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it("season_year is the input year as string", () => {
    const rows = makeAllRows();
    for (const row of rows) {
      expect(row.season_year).toBe("2026");
    }
  });

  it("no row contains an @ symbol or 'policy' or 'phone' anywhere (PII scan)", () => {
    const rows = makeAllRows();
    const piiRe = /@|policy|phone|email|registration/i;
    for (const row of rows) {
      const concatenated = Object.values(row).join("|");
      expect(concatenated).not.toMatch(piiRe);
    }
  });
});

describe("mapLineItemToChargeType", () => {
  it("BASE + FULL_SEASON → SLIP_FULL_SEASON", () => {
    expect(mapLineItemToChargeType("BASE", "FULL_SEASON")).toBe("SLIP_FULL_SEASON");
  });
  it("BASE + HALF_SEASON_1 → SLIP_HALF_SEASON_1", () => {
    expect(mapLineItemToChargeType("BASE", "HALF_SEASON_1")).toBe("SLIP_HALF_SEASON_1");
  });
  it("BASE + HALF_SEASON_2 → SLIP_HALF_SEASON_2", () => {
    expect(mapLineItemToChargeType("BASE", "HALF_SEASON_2")).toBe("SLIP_HALF_SEASON_2");
  });
  it("TRANSIENT kind → TRANSIENT", () => {
    expect(mapLineItemToChargeType("TRANSIENT", "TRANSIENT")).toBe("TRANSIENT");
  });
  it("AMENITY → AMENITY", () => {
    expect(mapLineItemToChargeType("AMENITY", "FULL_SEASON")).toBe("AMENITY");
  });
  it("BUY_IN → BUY_IN", () => {
    expect(mapLineItemToChargeType("BUY_IN", "FULL_SEASON")).toBe("BUY_IN");
  });
});

describe("mapHolderTypeToState", () => {
  it("maps all four DB holder_type values to PRD states", () => {
    expect(mapHolderTypeToState("resident_owner")).toBe("resident-owner");
    expect(mapHolderTypeToState("resident_renter")).toBe("resident-renter");
    expect(mapHolderTypeToState("non_resident_owner")).toBe("non-resident-owner");
    expect(mapHolderTypeToState("non_resident")).toBe("non-resident");
  });

  it("throws on unknown holder_type", () => {
    expect(() => mapHolderTypeToState("intruder")).toThrow(AppFolioExportError);
  });
});

describe("buildRows — defensive error paths", () => {
  it("throws when slip tier is unknown", () => {
    expect(() =>
      buildRows({
        assignments: [
          makeAssignment({
            slip: { slip_number: "X1", tier: "Mystery", fee_modifier: 1 },
          }),
        ],
        schedule: FY26,
        seasonYear: 2026,
      }),
    ).toThrow(AppFolioExportError);
  });
});
