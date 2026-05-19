// Append-only audit log writer. Architecture §4 audit_log schema.
//
// The DB role for the app has INSERT-only on this table (see drizzle
// migration 0001 note). This module never updates or deletes audit rows;
// that property is enforced both here (no update/delete export) and at
// the DB level.

import { db, schema } from "@/db";

// ---------------------------------------------------------------------------
// Action enum — derived from PRD + Architecture §6, §7, §10 + QA-STRATEGY.
// New actions must be added here (and reviewed) before they can be logged.
// ---------------------------------------------------------------------------

/**
 * Closed set of audit actions. Adding a new value here is a deliberate
 * governance decision — keep this list tight so reports stay queryable.
 */
export const AUDIT_ACTIONS = [
  // Fee schedule state machine (Architecture §7, QA §3.3).
  "fee_schedule.create",
  "fee_schedule.update",
  "fee_schedule.submit",
  "fee_schedule.approve",
  "fee_schedule.activate",
  "fee_schedule.archive",
  "fee_schedule.transition",

  // Scenario modeling.
  "scenario.create",
  "scenario.compute",
  "scenario.submit",
  "scenario.delete",

  // Holder management.
  "holder.create",
  "holder.update",
  "holder.deactivate",

  // Slip management.
  "slip.create",
  "slip.update",
  "slip.deactivate",

  // Assignment (booking calendar) — Architecture §5, §6.
  "assignment.create",
  "assignment.update",
  "assignment.cancel",
  "assignment.override",

  // Document review (FR-3.5).
  "document.upload",
  "document.approve",
  "document.reject",
  "document.expire",

  // Transient request workflow.
  "transient_request.create",
  "transient_request.approve",
  "transient_request.deny",

  // Auth events worth logging (FR-3.7.1).
  "auth.login",
  "auth.logout",
  "auth.role_change",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const AUDIT_ACTION_SET: ReadonlySet<string> = new Set<string>(AUDIT_ACTIONS);

export const AUDIT_ENTITY_TYPES = [
  "fee_schedule",
  "scenario",
  "holder",
  "slip",
  "vessel",
  "assignment",
  "document",
  "transient_request",
  "app_user",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AuditWriteInput {
  actorId: number | bigint;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: number | bigint;
  /** Snapshot of the row(s) BEFORE the action. JSON-serializable. */
  before?: Record<string, unknown>;
  /** Snapshot of the row(s) AFTER the action. JSON-serializable. */
  after?: Record<string, unknown>;
  /** Free-form contextual data (ip, user agent, justification, etc). */
  metadata?: AuditMetadata;
}

export interface AuditMetadata {
  ip?: string;
  userAgent?: string;
  justification?: string;
  // Free-form additional keys; constrained to JSON-serializable values.
  [key: string]: unknown;
}

export class AuditLogError extends Error {
  override readonly name = "AuditLogError";
}

/**
 * Append a row to the audit log.
 *
 * - Throws `AuditLogError` if `action` is not in the enum (defense in depth
 *   over the TypeScript literal check, in case a caller does an unsafe cast).
 * - Throws `AuditLogError` if `actorId` or `entityId` are not coerceable to
 *   BigInt (Drizzle's bigint columns require BigInt at the SDK boundary).
 * - Does NOT throw on duplicate rows — audit log is append-only by design;
 *   the same action on the same entity may legitimately be logged twice.
 */
export const audit = {
  async write(input: AuditWriteInput): Promise<void> {
    // Runtime guard — paranoid even though TS literal types should catch this.
    if (!AUDIT_ACTION_SET.has(input.action)) {
      throw new AuditLogError(
        `Unknown audit action '${String(input.action)}' — not in AUDIT_ACTIONS`,
      );
    }

    const actorId = coerceBigInt(input.actorId, "actorId");
    const entityId = coerceBigInt(input.entityId, "entityId");

    await db.insert(schema.auditLog).values({
      actorId,
      action: input.action,
      entityType: input.entityType,
      entityId,
      beforeData: input.before ?? null,
      afterData: input.after ?? null,
      metadata: input.metadata ?? null,
    });
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coerceBigInt(value: number | bigint, label: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value) && Number.isFinite(value)) {
    return BigInt(value);
  }
  throw new AuditLogError(
    `${label} must be a safe integer or bigint, got ${String(value)}`,
  );
}
