import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing the audit module so the insert chain
// is captured. We use vi.hoisted so the mock factory can reference the
// spy from the test.
const { insertSpy, valuesSpy } = vi.hoisted(() => {
  const valuesSpy = vi.fn(async () => undefined);
  const insertSpy = vi.fn(() => ({ values: valuesSpy }));
  return { insertSpy, valuesSpy };
});

vi.mock("@/db", () => ({
  db: { insert: insertSpy },
  schema: {
    auditLog: { __tableName: "audit_log" }, // sentinel so we can assert table identity
  },
}));

import { audit, AUDIT_ACTIONS, AuditLogError, type AuditAction } from "../log";

beforeEach(() => {
  insertSpy.mockClear();
  valuesSpy.mockClear();
});

describe("audit.write — happy path", () => {
  it("inserts a single row with the correct shape", async () => {
    await audit.write({
      actorId: 42,
      action: "fee_schedule.submit",
      entityType: "fee_schedule",
      entityId: 7,
      before: { state: "draft" },
      after: { state: "submitted" },
      metadata: { ip: "10.0.0.1", userAgent: "Mozilla/5.0", justification: "Annual rate review" },
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith({ __tableName: "audit_log" });
    expect(valuesSpy).toHaveBeenCalledTimes(1);

    const row = valuesSpy.mock.calls[0]?.[0];
    expect(row).toMatchObject({
      actorId: 42n,
      action: "fee_schedule.submit",
      entityType: "fee_schedule",
      entityId: 7n,
      beforeData: { state: "draft" },
      afterData: { state: "submitted" },
      metadata: { ip: "10.0.0.1", userAgent: "Mozilla/5.0", justification: "Annual rate review" },
    });
  });

  it("accepts bigint ids without re-coercing", async () => {
    await audit.write({
      actorId: 9_007_199_254_740_993n, // > MAX_SAFE_INTEGER — only expressible as bigint
      action: "auth.login",
      entityType: "app_user",
      entityId: 1n,
    });

    const row = valuesSpy.mock.calls[0]?.[0];
    expect(row?.actorId).toBe(9_007_199_254_740_993n);
    expect(row?.entityId).toBe(1n);
  });

  it("nulls out beforeData/afterData/metadata when not provided", async () => {
    await audit.write({
      actorId: 1,
      action: "auth.logout",
      entityType: "app_user",
      entityId: 1,
    });

    const row = valuesSpy.mock.calls[0]?.[0];
    expect(row?.beforeData).toBeNull();
    expect(row?.afterData).toBeNull();
    expect(row?.metadata).toBeNull();
  });
});

describe("audit.write — defensive validation", () => {
  it("throws AuditLogError when action is not in the enum (runtime guard)", async () => {
    await expect(
      audit.write({
        actorId: 1,
        // Force an invalid action through TS; the runtime should still catch it.
        action: "fee_schedule.delete" as AuditAction,
        entityType: "fee_schedule",
        entityId: 1,
      }),
    ).rejects.toThrow(AuditLogError);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("throws when actorId is not an integer", async () => {
    await expect(
      audit.write({
        actorId: 1.5,
        action: "auth.login",
        entityType: "app_user",
        entityId: 1,
      }),
    ).rejects.toThrow(AuditLogError);
  });

  it("throws when entityId is NaN", async () => {
    await expect(
      audit.write({
        actorId: 1,
        action: "auth.login",
        entityType: "app_user",
        entityId: NaN,
      }),
    ).rejects.toThrow(AuditLogError);
  });
});

describe("AUDIT_ACTIONS — enum sanity", () => {
  it("contains the spec-required actions from Architecture §6/§7/§10", () => {
    const required: AuditAction[] = [
      "fee_schedule.submit",
      "fee_schedule.approve",
      "fee_schedule.activate",
      "assignment.override",
      "document.approve",
      "scenario.compute",
    ];
    for (const action of required) {
      expect(AUDIT_ACTIONS).toContain(action);
    }
  });

  it("has no duplicates", () => {
    const set = new Set<string>(AUDIT_ACTIONS);
    expect(set.size).toBe(AUDIT_ACTIONS.length);
  });

  it("has at least ~25 entries (per PRD coverage)", () => {
    expect(AUDIT_ACTIONS.length).toBeGreaterThanOrEqual(25);
  });
});
