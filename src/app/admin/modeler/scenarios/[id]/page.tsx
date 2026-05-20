// /admin/modeler/scenarios/[id] — main scenario editor
//
// Server component: loads the scenario + paired fee_schedule + the
// initial projection (so the right pane shows numbers immediately on
// first paint), then hands all of it to <ScenarioEditor /> (client).
//
// We also run a baseline comparison against the current Active schedule
// so the delta header is populated on first render.

import { eq, notInArray } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/helpers";
import { feeBaseConfigSchema, scenarioSeasonOverridesSchema } from "@/lib/zod/schemas";
import { loadProjectionAssignments } from "@/lib/modeler/assignments";
import {
  compareScenarios,
  projectScenario,
  type CompareResult,
  type ProjectionResult,
} from "@/lib/modeler/projection";
import { ScenarioEditor } from "@/components/modeler/ScenarioEditor";
import type { FeeSchedule as PricingFeeSchedule } from "@/lib/pricing/resolve";

export default async function ScenarioEditorPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("board", "eci_admin", "super_admin");

  const [scenarioRow] = await db
    .select()
    .from(schema.scenario)
    .where(eq(schema.scenario.id, BigInt(params.id)))
    .limit(1);
  if (!scenarioRow) notFound();

  const [feeScheduleRow] = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.id, scenarioRow.feeScheduleId))
    .limit(1);
  if (!feeScheduleRow) notFound();

  const baseConfig = feeBaseConfigSchema.parse(feeScheduleRow.baseConfig);
  const overrides = scenarioRow.seasonOverrides
    ? scenarioSeasonOverridesSchema.parse(scenarioRow.seasonOverrides)
    : undefined;
  const seasonYear = overrides?.seasonStartDate
    ? Number(overrides.seasonStartDate.slice(0, 4))
    : 2027;

  // Compute initial projection (server-side, fast).
  const assignments = await loadProjectionAssignments(seasonYear);

  let projection: ProjectionResult | null = null;
  try {
    projection = projectScenario({
      feeSchedule: baseConfig as unknown as PricingFeeSchedule,
      assignments,
      occupancy: overrides?.occupancyAssumptions,
      seasonYear,
    });
  } catch {
    projection = null;
  }

  // Diff vs. current Active for the delta header.
  let compare: CompareResult | null = null;
  if (projection) {
    const [activeRow] = await db
      .select()
      .from(schema.feeSchedule)
      .where(eq(schema.feeSchedule.state, "active"))
      .limit(1);
    if (activeRow && activeRow.id !== feeScheduleRow.id) {
      try {
        const activeConfig = feeBaseConfigSchema.parse(activeRow.baseConfig);
        const activeProjection = projectScenario({
          feeSchedule: activeConfig as unknown as PricingFeeSchedule,
          assignments,
          seasonYear,
        });
        compare = compareScenarios(activeProjection, projection);
      } catch {
        // Active schedule has drifted from current schema — skip compare.
      }
    }
  }

  // Bit of housekeeping — make sure the type narrows on the client.
  void notInArray; // unused import guard

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <ScenarioEditor
        scenarioId={String(scenarioRow.id)}
        scenarioName={scenarioRow.name}
        scenarioStatus={
          scenarioRow.status as
            | "draft"
            | "under_review"
            | "submitted"
            | "approved_superseded"
            | "archived"
        }
        feeScheduleId={String(feeScheduleRow.id)}
        feeScheduleState={
          feeScheduleRow.state as
            | "draft"
            | "submitted"
            | "approved"
            | "active"
            | "archived"
        }
        initialBaseConfig={baseConfig}
        initialProjection={projection}
        initialCompare={compare}
      />
    </main>
  );
}
