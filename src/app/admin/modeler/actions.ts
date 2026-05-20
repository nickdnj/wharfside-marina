"use server";

// Server actions for the Pricing Modeler (EPIC-1B).
//
// Every action:
//   1. requireRole at the top (auth boundary)
//   2. Zod-validates input with .strict()
//   3. Loads the row + checks state-machine legality
//   4. Mutates inside a transaction where the action involves >1 write
//   5. Writes an audit_log row before returning
//
// Errors are thrown as typed `ScenarioError` so the UI / route handlers
// can map to the right HTTP status (see lib/modeler/errors.ts).
//
// References:
//   • docs/api/ENDPOINTS.md §9 (scenarios)
//   • docs/api/ENDPOINTS.md §8 (fee schedules)
//   • docs/planning/BACKLOG.md EPIC-1B-STORY-19..30
//   • docs/architecture/ARCHITECTURE.md §7.4 (projection)

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import {
  feeBaseConfigSchema,
  feeScheduleStateEnum,
  scenarioSeasonOverridesSchema,
  scenarioStatusEnum,
  type FeeBaseConfig,
  type FeeScheduleState,
  type ScenarioStatus,
} from "@/lib/zod/schemas";
import { requireRole, type CurrentUser } from "@/lib/auth/helpers";
import { audit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/emails/send";
import {
  projectScenario,
  compareScenarios as compareProjections,
  type ProjectionResult,
  type CompareResult,
} from "@/lib/modeler/projection";
import { loadProjectionAssignments } from "@/lib/modeler/assignments";
import {
  assertFeeScheduleTransition,
  assertScenarioTransition,
  isScenarioEditable,
} from "@/lib/modeler/state-machine";
import { ScenarioError } from "@/lib/modeler/errors";
import type { FeeSchedule as PricingFeeSchedule } from "@/lib/pricing/resolve";

/* ============================================================
 * Auth wrapper — only board / eci_admin / super_admin reach the Modeler.
 * Holders are explicitly blocked (PRD §3.6 — board-only feature).
 * ============================================================ */

async function requireModelerAccess(): Promise<CurrentUser> {
  try {
    return await requireRole("board", "eci_admin", "super_admin");
  } catch (err) {
    // requireRole throws ForbiddenError; rewrap so the UI can pattern-match.
    if (err instanceof Error && err.name === "ForbiddenError") {
      throw new ScenarioError("FORBIDDEN", "Modeler access requires board or admin role");
    }
    throw err;
  }
}

/* ============================================================
 * Input shapes (strict Zod)
 * ============================================================ */

const idInput = z.string().min(1);

const createScenarioInputSchema = z
  .object({
    name: z.string().min(1).max(160),
    baseFeeScheduleId: idInput,
    notes: z.string().max(2000).optional(),
  })
  .strict();
export type CreateScenarioInput = z.infer<typeof createScenarioInputSchema>;

const updateConfigInputSchema = z
  .object({
    id: idInput,
    baseConfig: feeBaseConfigSchema,
    seasonOverrides: scenarioSeasonOverridesSchema.optional(),
  })
  .strict();
export type UpdateConfigInput = z.infer<typeof updateConfigInputSchema>;

const cloneScenarioInputSchema = z
  .object({
    id: idInput,
    newName: z.string().min(1).max(160),
  })
  .strict();

const transitionScenarioInputSchema = z
  .object({
    id: idInput,
    to: scenarioStatusEnum,
    note: z.string().max(1000).optional(),
  })
  .strict();

const transitionFeeScheduleInputSchema = z
  .object({
    feeScheduleId: idInput,
    to: feeScheduleStateEnum,
    /** Required for `approved`: human-readable source (email subject, minutes URL, etc). */
    approvalReference: z.string().min(3).max(500).optional(),
    /** Required for `active`: typed phrase "APPROVED" — UX §4.1 destructive confirm. */
    confirmationPhrase: z.string().optional(),
    /** Optional metadata for the activate transition. */
    effectiveStart: z.string().date().optional(),
    effectiveEnd: z.string().date().optional(),
    /** Optional reason captured on archive. */
    reason: z.string().max(500).optional(),
  })
  .strict();

const compareInputSchema = z
  .object({
    scenarioAId: idInput,
    scenarioBId: idInput.optional(),
    /** Defaults to current Active. */
    baselineFeeScheduleId: idInput.optional(),
  })
  .strict();

/* ============================================================
 * 1) createScenario
 * ============================================================ */

export async function createScenario(
  input: CreateScenarioInput,
): Promise<{ scenarioId: string; feeScheduleId: string }> {
  const user = await requireModelerAccess();
  const parsed = parseStrict(createScenarioInputSchema, input);

  // Load the schedule we're cloning from. May be any state — we just copy
  // its base_config into a brand-new draft schedule.
  const [sourceRow] = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.id, BigInt(parsed.baseFeeScheduleId)))
    .limit(1);
  if (!sourceRow) {
    throw new ScenarioError("NOT_FOUND", `Fee schedule ${parsed.baseFeeScheduleId} not found`);
  }

  // Validate that what's on disk for the source schedule is in fact a
  // legal base_config shape — protects against drift.
  const cloned = feeBaseConfigSchema.parse(sourceRow.baseConfig);

  // Two inserts inside a transaction (paired fee_schedule + scenario row).
  const result = await db.transaction(async (tx) => {
    const [newSched] = await tx
      .insert(schema.feeSchedule)
      .values({
        name: `${parsed.name} (draft)`,
        state: "draft",
        baseConfig: cloned,
        createdBy: BigInt(user.id),
      })
      .returning({ id: schema.feeSchedule.id });
    if (!newSched) throw new ScenarioError("VALIDATION", "Insert feeSchedule failed");

    const [newScn] = await tx
      .insert(schema.scenario)
      .values({
        name: parsed.name,
        feeScheduleId: newSched.id,
        notes: parsed.notes ?? null,
        status: "draft",
        createdBy: BigInt(user.id),
      })
      .returning({ id: schema.scenario.id });
    if (!newScn) throw new ScenarioError("VALIDATION", "Insert scenario failed");

    return { feeScheduleId: newSched.id, scenarioId: newScn.id };
  });

  await audit.write({
    actorId: BigInt(user.id),
    action: "scenario.create",
    entityType: "scenario",
    entityId: result.scenarioId,
    after: {
      name: parsed.name,
      feeScheduleId: String(result.feeScheduleId),
      baseFeeScheduleId: parsed.baseFeeScheduleId,
    },
  });

  return {
    scenarioId: String(result.scenarioId),
    feeScheduleId: String(result.feeScheduleId),
  };
}

/* ============================================================
 * 2) updateScenarioConfig
 *
 * Patches the underlying DRAFT fee_schedule's base_config + (optionally)
 * the scenario's season_overrides; re-projects revenue against current
 * assignments; writes projected_revenue + computed_at.
 *
 * Locked once scenario.status leaves draft/under_review.
 * ============================================================ */

export async function updateScenarioConfig(input: UpdateConfigInput): Promise<{
  projection: ProjectionResult;
}> {
  const user = await requireModelerAccess();
  const parsed = parseStrict(updateConfigInputSchema, input);

  const { scenarioRow, feeScheduleRow } = await loadScenarioBundle(parsed.id);

  if (!isScenarioEditable(scenarioRow.status as ScenarioStatus)) {
    throw new ScenarioError(
      "INVALID_TRANSITION",
      `Scenario is '${scenarioRow.status}' and locked for edits`,
    );
  }
  if (feeScheduleRow.state !== "draft") {
    throw new ScenarioError(
      "INVALID_TRANSITION",
      `Underlying fee_schedule is '${feeScheduleRow.state}' and locked`,
    );
  }

  // Project against the freshly-patched config (assignments are loaded by
  // the season year — fall back to the current calendar year if unset).
  const seasonYear = inferSeasonYear(parsed.seasonOverrides?.seasonStartDate);
  const projection = await runProjection(parsed.baseConfig, seasonYear, parsed.seasonOverrides);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.feeSchedule)
      .set({
        baseConfig: parsed.baseConfig,
        updatedAt: new Date(),
      })
      .where(eq(schema.feeSchedule.id, feeScheduleRow.id));

    await tx
      .update(schema.scenario)
      .set({
        seasonOverrides: parsed.seasonOverrides ?? null,
        projectedRevenue: String(projection.total),
        computedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.scenario.id, scenarioRow.id));
  });

  await audit.write({
    actorId: BigInt(user.id),
    action: "fee_schedule.update",
    entityType: "fee_schedule",
    entityId: feeScheduleRow.id,
    before: { baseConfig: feeScheduleRow.baseConfig },
    after: { baseConfig: parsed.baseConfig },
    metadata: { scenarioId: String(scenarioRow.id), projectedTotal: projection.total },
  });

  return { projection };
}

/* ============================================================
 * 3) transitionScenario
 *
 * Move a scenario through its workflow states. Distinct from the
 * underlying fee_schedule state machine (see #4).
 * ============================================================ */

export async function transitionScenario(input: {
  id: string;
  to: ScenarioStatus;
  note?: string;
}): Promise<{ status: ScenarioStatus }> {
  const user = await requireModelerAccess();
  const parsed = parseStrict(transitionScenarioInputSchema, input);

  const { scenarioRow } = await loadScenarioBundle(parsed.id);

  const from = scenarioRow.status as ScenarioStatus;
  assertScenarioTransition(from, parsed.to);

  await db
    .update(schema.scenario)
    .set({ status: parsed.to, updatedAt: new Date() })
    .where(eq(schema.scenario.id, scenarioRow.id));

  await audit.write({
    actorId: BigInt(user.id),
    action: "scenario.submit", // closest canonical action in AUDIT_ACTIONS
    entityType: "scenario",
    entityId: scenarioRow.id,
    before: { status: from },
    after: { status: parsed.to },
    metadata: parsed.note ? { note: parsed.note } : undefined,
  });

  return { status: parsed.to };
}

/* ============================================================
 * 4) transitionFeeSchedule
 *
 * Draft → Submitted → Approved → Active → Archived.
 * Activating archives the prior Active row inside the same transaction.
 * The `active` transition requires the typed confirmation phrase "APPROVED".
 * ============================================================ */

export async function transitionFeeSchedule(input: {
  feeScheduleId: string;
  to: FeeScheduleState;
  approvalReference?: string;
  confirmationPhrase?: string;
  effectiveStart?: string;
  effectiveEnd?: string;
  reason?: string;
}): Promise<{
  state: FeeScheduleState;
  previousActiveArchivedId: string | null;
}> {
  const user = await requireModelerAccess();
  const parsed = parseStrict(transitionFeeScheduleInputSchema, input);

  const [row] = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.id, BigInt(parsed.feeScheduleId)))
    .limit(1);
  if (!row) {
    throw new ScenarioError("NOT_FOUND", `Fee schedule ${parsed.feeScheduleId} not found`);
  }

  const from = row.state as FeeScheduleState;
  assertFeeScheduleTransition(from, parsed.to);

  // Per-transition required metadata.
  if (parsed.to === "approved" && !parsed.approvalReference) {
    throw new ScenarioError(
      "VALIDATION",
      "approvalReference is required to move to 'approved'",
    );
  }
  if (parsed.to === "active") {
    if (parsed.confirmationPhrase !== "APPROVED") {
      throw new ScenarioError(
        "VALIDATION",
        "confirmationPhrase must equal 'APPROVED' to promote to Active",
      );
    }
    if (!parsed.effectiveStart) {
      throw new ScenarioError("VALIDATION", "effectiveStart is required for 'active'");
    }
  }

  let previousActiveArchivedId: string | null = null;
  const now = new Date();

  await db.transaction(async (tx) => {
    if (parsed.to === "active") {
      // Archive prior Active (one_active_schedule partial-unique index will
      // otherwise reject our update).
      const [prior] = await tx
        .select({ id: schema.feeSchedule.id, name: schema.feeSchedule.name })
        .from(schema.feeSchedule)
        .where(eq(schema.feeSchedule.state, "active"))
        .limit(1);
      if (prior) {
        await tx
          .update(schema.feeSchedule)
          .set({
            state: "archived",
            archivedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.feeSchedule.id, prior.id));
        previousActiveArchivedId = String(prior.id);
      }
    }

    const patch: Partial<typeof schema.feeSchedule.$inferInsert> = {
      state: parsed.to,
      updatedAt: now,
    };
    if (parsed.to === "submitted") patch.submittedAt = now;
    if (parsed.to === "approved") {
      patch.approvedAt = now;
      patch.approvalReference = parsed.approvalReference ?? null;
    }
    if (parsed.to === "active") {
      patch.activatedAt = now;
      patch.effectiveStart = parsed.effectiveStart ?? null;
      patch.effectiveEnd = parsed.effectiveEnd ?? null;
    }
    if (parsed.to === "archived") patch.archivedAt = now;

    await tx
      .update(schema.feeSchedule)
      .set(patch)
      .where(eq(schema.feeSchedule.id, row.id));
  });

  await audit.write({
    actorId: BigInt(user.id),
    action: pickFeeScheduleAuditAction(parsed.to),
    entityType: "fee_schedule",
    entityId: row.id,
    before: { state: from },
    after: { state: parsed.to },
    metadata: {
      approvalReference: parsed.approvalReference,
      previousActiveArchivedId,
      reason: parsed.reason,
    },
  });

  // Fire-and-forget transactional emails. Wrapped in try/catch so a Resend
  // outage doesn't take down the action.
  void notifyOnFeeScheduleTransition(parsed.to, row, user, parsed).catch(() => {});

  return { state: parsed.to, previousActiveArchivedId };
}

/* ============================================================
 * 5) cloneScenario
 * ============================================================ */

export async function cloneScenario(input: {
  id: string;
  newName: string;
}): Promise<{ scenarioId: string; feeScheduleId: string }> {
  const user = await requireModelerAccess();
  const parsed = parseStrict(cloneScenarioInputSchema, input);

  const { scenarioRow, feeScheduleRow } = await loadScenarioBundle(parsed.id);

  const result = await db.transaction(async (tx) => {
    const [newSched] = await tx
      .insert(schema.feeSchedule)
      .values({
        name: `${parsed.newName} (draft)`,
        state: "draft",
        baseConfig: feeScheduleRow.baseConfig,
        createdBy: BigInt(user.id),
      })
      .returning({ id: schema.feeSchedule.id });
    if (!newSched) throw new ScenarioError("VALIDATION", "Clone insert failed");

    const [newScn] = await tx
      .insert(schema.scenario)
      .values({
        name: parsed.newName,
        feeScheduleId: newSched.id,
        seasonOverrides: scenarioRow.seasonOverrides,
        notes: scenarioRow.notes,
        status: "draft",
        createdBy: BigInt(user.id),
      })
      .returning({ id: schema.scenario.id });
    if (!newScn) throw new ScenarioError("VALIDATION", "Clone insert failed");

    return { feeScheduleId: newSched.id, scenarioId: newScn.id };
  });

  await audit.write({
    actorId: BigInt(user.id),
    action: "scenario.create",
    entityType: "scenario",
    entityId: result.scenarioId,
    after: {
      name: parsed.newName,
      clonedFromScenarioId: String(scenarioRow.id),
    },
  });

  return {
    scenarioId: String(result.scenarioId),
    feeScheduleId: String(result.feeScheduleId),
  };
}

/* ============================================================
 * 6) projectScenario (server action — wraps the pure projection)
 *
 * Stateless from the DB's POV (besides the load), so no audit. Rate-limited
 * upstream per ENDPOINTS.md 9.4 (Linda may iterate fast).
 * ============================================================ */

export async function projectScenarioById(input: {
  id: string;
}): Promise<{ projection: ProjectionResult }> {
  await requireModelerAccess();
  const parsed = parseStrict(z.object({ id: idInput }).strict(), input);

  const { scenarioRow, feeScheduleRow } = await loadScenarioBundle(parsed.id);
  const baseConfig = feeBaseConfigSchema.parse(feeScheduleRow.baseConfig);
  const overrides = scenarioRow.seasonOverrides
    ? scenarioSeasonOverridesSchema.parse(scenarioRow.seasonOverrides)
    : undefined;
  const seasonYear = inferSeasonYear(overrides?.seasonStartDate);

  const projection = await runProjection(baseConfig, seasonYear, overrides);
  return { projection };
}

/* ============================================================
 * 7) compareScenariosAction
 * ============================================================ */

export async function compareScenariosAction(input: {
  scenarioAId: string;
  scenarioBId?: string;
  baselineFeeScheduleId?: string;
}): Promise<{
  baselineProjection: ProjectionResult;
  scenarioAProjection: ProjectionResult;
  scenarioBProjection?: ProjectionResult;
  compareAvsBaseline: CompareResult;
  compareBvsBaseline?: CompareResult;
}> {
  await requireModelerAccess();
  const parsed = parseStrict(compareInputSchema, input);

  // Resolve baseline: explicit, else current Active, else fail.
  let baselineRow:
    | (typeof schema.feeSchedule.$inferSelect)
    | undefined;
  if (parsed.baselineFeeScheduleId) {
    const [r] = await db
      .select()
      .from(schema.feeSchedule)
      .where(eq(schema.feeSchedule.id, BigInt(parsed.baselineFeeScheduleId)))
      .limit(1);
    baselineRow = r;
  } else {
    const [r] = await db
      .select()
      .from(schema.feeSchedule)
      .where(eq(schema.feeSchedule.state, "active"))
      .limit(1);
    baselineRow = r;
  }
  if (!baselineRow) {
    throw new ScenarioError("NOT_FOUND", "No baseline fee schedule (Active) found");
  }

  const baselineBaseConfig = feeBaseConfigSchema.parse(baselineRow.baseConfig);

  // Scenario A is required.
  const { scenarioRow: scnA, feeScheduleRow: schedA } = await loadScenarioBundle(
    parsed.scenarioAId,
  );
  const aBaseConfig = feeBaseConfigSchema.parse(schedA.baseConfig);
  const aOverrides = scnA.seasonOverrides
    ? scenarioSeasonOverridesSchema.parse(scnA.seasonOverrides)
    : undefined;
  const seasonYear = inferSeasonYear(aOverrides?.seasonStartDate);

  const baselineProjection = await runProjection(baselineBaseConfig, seasonYear, undefined);
  const scenarioAProjection = await runProjection(aBaseConfig, seasonYear, aOverrides);
  const compareAvsBaseline = compareProjections(baselineProjection, scenarioAProjection);

  let scenarioBProjection: ProjectionResult | undefined;
  let compareBvsBaseline: CompareResult | undefined;
  if (parsed.scenarioBId) {
    const { scenarioRow: scnB, feeScheduleRow: schedB } = await loadScenarioBundle(
      parsed.scenarioBId,
    );
    const bBaseConfig = feeBaseConfigSchema.parse(schedB.baseConfig);
    const bOverrides = scnB.seasonOverrides
      ? scenarioSeasonOverridesSchema.parse(scnB.seasonOverrides)
      : undefined;
    scenarioBProjection = await runProjection(bBaseConfig, seasonYear, bOverrides);
    compareBvsBaseline = compareProjections(baselineProjection, scenarioBProjection);
  }

  return {
    baselineProjection,
    scenarioAProjection,
    scenarioBProjection,
    compareAvsBaseline,
    compareBvsBaseline,
  };
}

/* ============================================================
 * Shared helpers
 * ============================================================ */

function parseStrict<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ScenarioError(
      "VALIDATION",
      `Invalid input: ${result.error.issues.map((i) => i.message).join("; ")}`,
      result.error.format(),
    );
  }
  return result.data;
}

async function loadScenarioBundle(scenarioId: string): Promise<{
  scenarioRow: typeof schema.scenario.$inferSelect;
  feeScheduleRow: typeof schema.feeSchedule.$inferSelect;
}> {
  const [scenarioRow] = await db
    .select()
    .from(schema.scenario)
    .where(eq(schema.scenario.id, BigInt(scenarioId)))
    .limit(1);
  if (!scenarioRow) {
    throw new ScenarioError("NOT_FOUND", `Scenario ${scenarioId} not found`);
  }
  const [feeScheduleRow] = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.id, scenarioRow.feeScheduleId))
    .limit(1);
  if (!feeScheduleRow) {
    throw new ScenarioError("NOT_FOUND", `Fee schedule for scenario ${scenarioId} not found`);
  }
  return { scenarioRow, feeScheduleRow };
}

async function runProjection(
  baseConfig: FeeBaseConfig,
  seasonYear: number,
  overrides: z.infer<typeof scenarioSeasonOverridesSchema> | undefined,
): Promise<ProjectionResult> {
  const assignments = await loadProjectionAssignments(seasonYear);
  return projectScenario({
    feeSchedule: baseConfig as unknown as PricingFeeSchedule,
    assignments,
    occupancy: overrides?.occupancyAssumptions
      ? {
          fullSeasonPct: overrides.occupancyAssumptions.fullSeasonPct,
          halfSeason1Pct: overrides.occupancyAssumptions.halfSeason1Pct,
          halfSeason2Pct: overrides.occupancyAssumptions.halfSeason2Pct,
          transientNightsPerSlipPerYear:
            overrides.occupancyAssumptions.transientNightsPerSlipPerYear,
        }
      : undefined,
    seasonYear,
  });
}

function inferSeasonYear(start?: string): number {
  if (start) {
    const yr = Number(start.slice(0, 4));
    if (Number.isFinite(yr)) return yr;
  }
  // FY27 is the launch target per the spec.
  return 2027;
}

function pickFeeScheduleAuditAction(to: FeeScheduleState) {
  switch (to) {
    case "submitted":
      return "fee_schedule.submit" as const;
    case "approved":
      return "fee_schedule.approve" as const;
    case "active":
      return "fee_schedule.activate" as const;
    case "archived":
      return "fee_schedule.archive" as const;
    case "draft":
      return "fee_schedule.transition" as const;
  }
}

async function notifyOnFeeScheduleTransition(
  to: FeeScheduleState,
  row: typeof schema.feeSchedule.$inferSelect,
  user: CurrentUser,
  parsed: z.infer<typeof transitionFeeScheduleInputSchema>,
): Promise<void> {
  // Only "submitted", "approved", "active" send mail per ENDPOINTS §8.3.
  if (to === "submitted") {
    // We don't have a board mailing-list table yet — left as TODO; the
    // address resolution will be wired up by the board-roster service.
  } else if (to === "approved" && parsed.approvalReference) {
    // ditto
  } else if (to === "active" && parsed.effectiveStart) {
    // ditto — placeholder for the email fan-out once the recipients
    // resolver lands. The email templates themselves are already built.
  }
  // Avoid the unused-var lint while these are placeholders.
  void row;
  void user;
  void sendEmail;
}
