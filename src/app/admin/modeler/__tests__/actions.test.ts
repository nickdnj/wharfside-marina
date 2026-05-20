// Server-action tests for the Modeler.
//
// We mock the auth helper, the audit writer, the db, and the assignments
// loader. The tests assert:
//   • Auth: holder is rejected; unauthenticated is rejected.
//   • Validation: malformed input throws ScenarioError("VALIDATION").
//   • State machine: illegal transitions throw INVALID_TRANSITION.
//   • Audit: the action writes the expected audit row.
//
// Per QA strategy we DO NOT test components, only the actions/logic.

import { describe, it, expect, beforeEach, vi } from "vitest";

/* ============================================================
 * Hoisted mocks
 * ============================================================ */

const {
  requireRoleMock,
  forbiddenError,
  unauthorizedError,
  auditWriteMock,
  loadAssignmentsMock,
  dbSelectChain,
  dbInsertChain,
  dbUpdateChain,
  dbTransactionMock,
  sendEmailMock,
} = vi.hoisted(() => {
  class ForbiddenError extends Error {
    statusCode = 403;
    constructor(m = "Forbidden") {
      super(m);
      this.name = "ForbiddenError";
    }
  }
  class UnauthorizedError extends Error {
    statusCode = 401;
    constructor(m = "Auth required") {
      super(m);
      this.name = "UnauthorizedError";
    }
  }

  const requireRoleMock = vi.fn();
  const auditWriteMock = vi.fn(async () => undefined);
  const loadAssignmentsMock = vi.fn(async () => []);

  // db.select chain
  const dbSelectChain = {
    rows: [] as unknown[],
    select: vi.fn(),
  };
  const fromMock = vi.fn(function (this: unknown) {
    return this;
  });
  const whereMock = vi.fn(function (this: unknown) {
    return this;
  });
  const limitMock = vi.fn(async function (this: unknown) {
    return dbSelectChain.rows;
  });
  const orderByMock = vi.fn(async function (this: unknown) {
    return dbSelectChain.rows;
  });
  dbSelectChain.select = vi.fn(() => ({
    from: () => ({
      where: () => ({
        limit: limitMock,
        orderBy: orderByMock,
      }),
      orderBy: orderByMock,
      limit: limitMock,
    }),
  }));
  // expose for individual asserts:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (dbSelectChain as any).fromMock = fromMock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (dbSelectChain as any).whereMock = whereMock;

  const returningMock = vi.fn(async () => [{ id: 999n }]);
  const valuesMock = vi.fn(() => ({ returning: returningMock }));
  const dbInsertChain = vi.fn(() => ({ values: valuesMock }));

  const updateSetMock = vi.fn(() => ({
    where: vi.fn(async () => undefined),
  }));
  const dbUpdateChain = vi.fn(() => ({ set: updateSetMock }));

  // Transaction passes a tx with the same shape.
  const dbTransactionMock = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: dbInsertChain,
      update: dbUpdateChain,
      select: dbSelectChain.select,
    };
    return fn(tx);
  });

  const sendEmailMock = vi.fn(async () => ({ id: "x" }));

  return {
    requireRoleMock,
    forbiddenError: ForbiddenError,
    unauthorizedError: UnauthorizedError,
    auditWriteMock,
    loadAssignmentsMock,
    dbSelectChain,
    dbInsertChain,
    dbUpdateChain,
    dbTransactionMock,
    sendEmailMock,
  };
});

vi.mock("@/lib/auth/helpers", () => ({
  requireRole: requireRoleMock,
  ForbiddenError: forbiddenError,
  UnauthorizedError: unauthorizedError,
  getCurrentUser: vi.fn(),
  requireAdmin: vi.fn(),
  requireAdminOrBoard: vi.fn(),
}));

vi.mock("@/lib/audit/log", () => ({
  audit: { write: auditWriteMock },
}));

vi.mock("@/lib/modeler/assignments", () => ({
  loadProjectionAssignments: loadAssignmentsMock,
}));

vi.mock("@/lib/emails/send", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@/db", () => ({
  db: {
    select: dbSelectChain.select,
    insert: dbInsertChain,
    update: dbUpdateChain,
    transaction: dbTransactionMock,
  },
  schema: {
    scenario: {
      id: "scenario.id",
      feeScheduleId: "scenario.feeScheduleId",
      status: "scenario.status",
    },
    feeSchedule: {
      id: "feeSchedule.id",
      state: "feeSchedule.state",
    },
  },
}));

// Now import the SUT — after all mocks are wired.
import {
  createScenario,
  transitionScenario,
  transitionFeeSchedule,
  updateScenarioConfig,
  projectScenarioById,
} from "../actions";
import { ScenarioError } from "@/lib/modeler/errors";

/* ============================================================
 * Helpers
 * ============================================================ */

const FAKE_USER = {
  id: "42",
  email: "linda@wharfsidemb.com",
  name: "Linda",
  role: "board" as const,
  holderId: null,
};

const FY26_BASE_CONFIG = {
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

beforeEach(() => {
  vi.clearAllMocks();
  dbSelectChain.rows = [];
  requireRoleMock.mockResolvedValue(FAKE_USER);
  loadAssignmentsMock.mockResolvedValue([]);
});

/* ============================================================
 * Auth boundary
 * ============================================================ */

describe("auth boundary", () => {
  it("rejects holders with FORBIDDEN", async () => {
    requireRoleMock.mockRejectedValue(new forbiddenError("holder not allowed"));
    try {
      await createScenario({ name: "x", baseFeeScheduleId: "1" });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ScenarioError);
      expect((err as ScenarioError).code).toBe("FORBIDDEN");
    }
  });

  it("rejects unauthenticated", async () => {
    requireRoleMock.mockRejectedValue(new unauthorizedError());
    await expect(
      createScenario({ name: "x", baseFeeScheduleId: "1" }),
    ).rejects.toBeTruthy();
  });
});

/* ============================================================
 * Input validation
 * ============================================================ */

describe("input validation", () => {
  it("createScenario rejects empty name", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createScenario({ name: "", baseFeeScheduleId: "1" } as any),
    ).rejects.toThrow(ScenarioError);
  });

  it("createScenario rejects unknown extra keys (.strict)", async () => {
    await expect(
      createScenario({
        name: "ok",
        baseFeeScheduleId: "1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evil: "data",
      } as any),
    ).rejects.toThrow(ScenarioError);
  });

  it("transitionFeeSchedule rejects active without confirmation phrase", async () => {
    dbSelectChain.rows = [
      {
        id: 10n,
        state: "approved",
        baseConfig: FY26_BASE_CONFIG,
      },
    ];
    await expect(
      transitionFeeSchedule({
        feeScheduleId: "10",
        to: "active",
        effectiveStart: "2027-04-15",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("transitionFeeSchedule rejects approve without approvalReference", async () => {
    dbSelectChain.rows = [
      { id: 10n, state: "submitted", baseConfig: FY26_BASE_CONFIG },
    ];
    await expect(
      transitionFeeSchedule({ feeScheduleId: "10", to: "approved" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

/* ============================================================
 * State machine
 * ============================================================ */

describe("state machine", () => {
  it("rejects illegal scenario transition (draft → submitted)", async () => {
    dbSelectChain.rows = [
      // scenario row
      { id: 1n, feeScheduleId: 10n, status: "draft", seasonOverrides: null },
    ];
    // second select: fee_schedule
    // sequencing: we need to return scenario then fee_schedule. Cheat: have a small queue.
    const queue: unknown[][] = [
      [{ id: 1n, feeScheduleId: 10n, status: "draft", seasonOverrides: null }],
      [{ id: 10n, state: "draft", baseConfig: FY26_BASE_CONFIG }],
    ];
    dbSelectChain.select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => queue.shift() ?? [],
          orderBy: async () => queue.shift() ?? [],
        }),
        orderBy: async () => queue.shift() ?? [],
        limit: async () => queue.shift() ?? [],
      }),
    })) as unknown as typeof dbSelectChain.select;
    // Re-mount the mocked db.select reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await import("@/db")).db.select = dbSelectChain.select as any;

    await expect(
      transitionScenario({ id: "1", to: "submitted" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("rejects illegal fee schedule transition (draft → active)", async () => {
    dbSelectChain.rows = [
      { id: 10n, state: "draft", baseConfig: FY26_BASE_CONFIG },
    ];
    dbSelectChain.select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => dbSelectChain.rows,
          orderBy: async () => dbSelectChain.rows,
        }),
        limit: async () => dbSelectChain.rows,
        orderBy: async () => dbSelectChain.rows,
      }),
    })) as unknown as typeof dbSelectChain.select;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await import("@/db")).db.select = dbSelectChain.select as any;

    await expect(
      transitionFeeSchedule({
        feeScheduleId: "10",
        to: "active",
        confirmationPhrase: "APPROVED",
        effectiveStart: "2027-04-15",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

/* ============================================================
 * Audit log
 * ============================================================ */

describe("audit log", () => {
  it("createScenario writes scenario.create audit row", async () => {
    dbSelectChain.rows = [
      { id: 1n, name: "src", state: "active", baseConfig: FY26_BASE_CONFIG },
    ];
    dbSelectChain.select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => dbSelectChain.rows,
          orderBy: async () => dbSelectChain.rows,
        }),
        limit: async () => dbSelectChain.rows,
        orderBy: async () => dbSelectChain.rows,
      }),
    })) as unknown as typeof dbSelectChain.select;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await import("@/db")).db.select = dbSelectChain.select as any;

    await createScenario({ name: "My new scenario", baseFeeScheduleId: "1" });

    expect(auditWriteMock).toHaveBeenCalledTimes(1);
    const call = auditWriteMock.mock.calls[0]?.[0] as {
      action: string;
      entityType: string;
      actorId: bigint;
    };
    expect(call?.action).toBe("scenario.create");
    expect(call?.entityType).toBe("scenario");
    expect(call?.actorId).toBe(42n);
  });
});

/* ============================================================
 * Pricing — uses resolveFee correctly
 * ============================================================ */

describe("projectScenarioById uses pricing engine", () => {
  it("calls resolveFee through projectScenario and returns totals", async () => {
    // Set up scenario + fee_schedule rows.
    const queue: unknown[][] = [
      [{ id: 1n, feeScheduleId: 10n, seasonOverrides: null, status: "draft" }],
      [{ id: 10n, state: "draft", baseConfig: FY26_BASE_CONFIG }],
    ];
    dbSelectChain.select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => queue.shift() ?? [],
        }),
        limit: async () => queue.shift() ?? [],
      }),
    })) as unknown as typeof dbSelectChain.select;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await import("@/db")).db.select = dbSelectChain.select as any;

    loadAssignmentsMock.mockResolvedValueOnce([
      {
        holderId: "h1",
        holderName: "Resident A",
        holderState: "resident-owner",
        slipNumber: "10",
        slipTier: "Standard",
        slipFeeModifier: 1.0,
        vesselLoaFt: 27,
        leaseType: "FULL_SEASON",
      },
    ]);

    const res = await projectScenarioById({ id: "1" });
    // Standard resident full-season = 3500 * 0.75 = 2625, amenity waived.
    // Default occupancy 100% for full-season → 2625.
    expect(res.projection.total).toBe(2625);
  });
});

/* ============================================================
 * updateScenarioConfig — happy path writes audit + returns projection
 * ============================================================ */

describe("updateScenarioConfig", () => {
  it("rejects when scenario status is not editable", async () => {
    const queue: unknown[][] = [
      // scenario in 'submitted' (locked)
      [{ id: 1n, feeScheduleId: 10n, seasonOverrides: null, status: "submitted" }],
      [{ id: 10n, state: "submitted", baseConfig: FY26_BASE_CONFIG }],
    ];
    dbSelectChain.select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => queue.shift() ?? [],
        }),
        limit: async () => queue.shift() ?? [],
      }),
    })) as unknown as typeof dbSelectChain.select;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await import("@/db")).db.select = dbSelectChain.select as any;

    await expect(
      updateScenarioConfig({
        id: "1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        baseConfig: FY26_BASE_CONFIG as any,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});
