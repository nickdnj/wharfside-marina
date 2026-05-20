// /admin/modeler/scenarios/[id]/holders — per-holder impact view
//
// Server component. Loads the same projection as the editor, diffs against
// the current Active schedule, and hands the rows to PerHolderTable (client).
//
// CSV export is a button that opens /api/exports/scenario/[id]?format=csv.

import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/helpers";
import {
  feeBaseConfigSchema,
  scenarioSeasonOverridesSchema,
} from "@/lib/zod/schemas";
import { loadProjectionAssignments } from "@/lib/modeler/assignments";
import {
  compareScenarios,
  projectScenario,
} from "@/lib/modeler/projection";
import { PerHolderTable } from "@/components/modeler/PerHolderTable";
import { Button } from "@/components/ui/primitives";
import type { FeeSchedule as PricingFeeSchedule } from "@/lib/pricing/resolve";

export default async function PerHolderImpactPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole("board", "eci_admin", "super_admin");

  const [scn] = await db
    .select()
    .from(schema.scenario)
    .where(eq(schema.scenario.id, BigInt(params.id)))
    .limit(1);
  if (!scn) notFound();

  const [sched] = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.id, scn.feeScheduleId))
    .limit(1);
  if (!sched) notFound();

  const baseConfig = feeBaseConfigSchema.parse(sched.baseConfig);
  const overrides = scn.seasonOverrides
    ? scenarioSeasonOverridesSchema.parse(scn.seasonOverrides)
    : undefined;
  const seasonYear = overrides?.seasonStartDate
    ? Number(overrides.seasonStartDate.slice(0, 4))
    : 2027;

  const assignments = await loadProjectionAssignments(seasonYear);
  const scenarioProj = projectScenario({
    feeSchedule: baseConfig as unknown as PricingFeeSchedule,
    assignments,
    occupancy: overrides?.occupancyAssumptions,
    seasonYear,
  });

  let rows: React.ComponentProps<typeof PerHolderTable>["rows"];
  let showDelta = false;

  const [activeRow] = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.state, "active"))
    .limit(1);

  if (activeRow && activeRow.id !== sched.id) {
    const activeConfig = feeBaseConfigSchema.parse(activeRow.baseConfig);
    const activeProj = projectScenario({
      feeSchedule: activeConfig as unknown as PricingFeeSchedule,
      assignments,
      seasonYear,
    });
    const cmp = compareScenarios(activeProj, scenarioProj);
    rows = cmp.perHolderDeltas.map((d) => ({
      holderId: d.holderId,
      holderName: d.holderName,
      slipNumber: d.slipNumber,
      currentFee: d.baselineFee,
      scenarioFee: d.scenarioFee,
      delta: d.delta,
      deltaPct: d.deltaPct,
    }));
    showDelta = true;
  } else {
    rows = scenarioProj.perHolder.map((h) => ({
      holderId: h.holderId,
      holderName: h.holderName,
      slipNumber: h.slipNumber,
      scenarioFee: h.fee,
    }));
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">
            Per-holder impact — {scn.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Shows fee per holder under this scenario
            {showDelta ? ", with delta vs. the current Active schedule" : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/modeler/scenarios/${params.id}`}>
            <Button variant="secondary">Back to editor</Button>
          </Link>
          <a
            href={`/api/exports/scenario/${params.id}?format=csv`}
            target="_blank"
            rel="noopener"
          >
            <Button>Export CSV</Button>
          </a>
        </div>
      </header>

      <PerHolderTable rows={rows} showDelta={showDelta} />
    </main>
  );
}
