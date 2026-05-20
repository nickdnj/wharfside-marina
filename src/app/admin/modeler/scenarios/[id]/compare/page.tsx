// /admin/modeler/scenarios/[id]/compare — side-by-side compare
//
// Server component: reads ?b=<scenarioId> from the query string and renders
// the current scenario against either:
//   • Another scenario (when ?b= is present)
//   • The current Active schedule (default baseline)
//
// Layout: two projection panels side-by-side + a per-holder delta table
// underneath.

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";

import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/helpers";
import { feeBaseConfigSchema, scenarioSeasonOverridesSchema } from "@/lib/zod/schemas";
import { loadProjectionAssignments } from "@/lib/modeler/assignments";
import {
  compareScenarios,
  projectScenario,
  type ProjectionResult,
} from "@/lib/modeler/projection";
import { ProjectionPanel } from "@/components/modeler/ProjectionPanel";
import { PerHolderTable } from "@/components/modeler/PerHolderTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import type { FeeSchedule as PricingFeeSchedule } from "@/lib/pricing/resolve";

export default async function CompareScenarioPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { b?: string };
}) {
  await requireRole("board", "eci_admin", "super_admin");

  const projA = await projectScenarioByIdInPage(params.id);
  if (!projA) notFound();

  // Resolve baseline.
  let baselineLabel: string;
  let projBaseline: { projection: ProjectionResult; label: string };
  if (searchParams.b) {
    const second = await projectScenarioByIdInPage(searchParams.b);
    if (!second) notFound();
    projBaseline = second;
    baselineLabel = second.label;
  } else {
    // Default: current Active.
    const [activeRow] = await db
      .select()
      .from(schema.feeSchedule)
      .where(eq(schema.feeSchedule.state, "active"))
      .limit(1);
    if (!activeRow) {
      return (
        <main className="mx-auto max-w-3xl px-6 py-8">
          <h1 className="text-2xl font-semibold text-navy-900">Compare</h1>
          <p className="mt-2 text-sm text-amber-700">
            No Active schedule exists — pick a second scenario to compare
            against via ?b=&lt;scenarioId&gt;.
          </p>
        </main>
      );
    }
    const activeConfig = feeBaseConfigSchema.parse(activeRow.baseConfig);
    const seasonYear = projA.seasonYear;
    const assignments = await loadProjectionAssignments(seasonYear);
    const proj = projectScenario({
      feeSchedule: activeConfig as unknown as PricingFeeSchedule,
      assignments,
      seasonYear,
    });
    projBaseline = { projection: proj, label: `Active: ${activeRow.name}` };
    baselineLabel = projBaseline.label;
  }

  const cmp = compareScenarios(projBaseline.projection, projA.projection);

  const rows = cmp.perHolderDeltas.map((d) => ({
    holderId: d.holderId,
    holderName: d.holderName,
    slipNumber: d.slipNumber,
    currentFee: d.baselineFee,
    scenarioFee: d.scenarioFee,
    delta: d.delta,
    deltaPct: d.deltaPct,
  }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-navy-900">Compare</h1>
        <p className="mt-1 text-sm text-slate-600">
          <strong>{projA.label}</strong> vs. <strong>{baselineLabel}</strong>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Tip: append <code>?b=&lt;scenarioId&gt;</code> to pick a different
          comparator. <Link href={`/admin/modeler/scenarios/${params.id}`} className="text-navy-500 underline">Back to editor</Link>
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{baselineLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectionPanel projection={projBaseline.projection} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{projA.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectionPanel projection={projA.projection} compare={cmp} />
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">
          Per-holder delta
        </h2>
        <PerHolderTable rows={rows} showDelta />
      </section>
    </main>
  );
}

async function projectScenarioByIdInPage(scenarioId: string): Promise<{
  projection: ProjectionResult;
  label: string;
  seasonYear: number;
} | null> {
  const [scn] = await db
    .select()
    .from(schema.scenario)
    .where(eq(schema.scenario.id, BigInt(scenarioId)))
    .limit(1);
  if (!scn) return null;
  const [sched] = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.id, scn.feeScheduleId))
    .limit(1);
  if (!sched) return null;

  const baseConfig = feeBaseConfigSchema.parse(sched.baseConfig);
  const overrides = scn.seasonOverrides
    ? scenarioSeasonOverridesSchema.parse(scn.seasonOverrides)
    : undefined;
  const seasonYear = overrides?.seasonStartDate
    ? Number(overrides.seasonStartDate.slice(0, 4))
    : 2027;

  const assignments = await loadProjectionAssignments(seasonYear);
  const projection = projectScenario({
    feeSchedule: baseConfig as unknown as PricingFeeSchedule,
    assignments,
    occupancy: overrides?.occupancyAssumptions,
    seasonYear,
  });

  return { projection, label: scn.name, seasonYear };
}
