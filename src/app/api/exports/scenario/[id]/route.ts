// GET /api/exports/scenario/:id?format=csv|pdf
//
// Single route handler that branches on the `format` query string. Cleaner
// than two parallel route files for what is essentially the same auth +
// load + transform pipeline. Both formats:
//   1. Require admin/board access (Modeler audience).
//   2. Load the scenario + paired fee_schedule.
//   3. Generate the artifact.
//   4. Write a `scenario.compute` (CSV) / `scenario.compute` (PDF) audit row.
//
// CSV: per-holder impact (FR-3.6.2.3 "Excel-killer feature").
// PDF: board-ready branded fee schedule (FR-3.6.4.2).

import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { audit } from "@/lib/audit/log";
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
import { generateFeeSchedulePDF } from "@/lib/pdf/fee-schedule";
import { isScenarioError, ScenarioError } from "@/lib/modeler/errors";
import type { FeeSchedule as PricingFeeSchedule } from "@/lib/pricing/resolve";

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
): Promise<Response> {
  try {
    const user = await requireRole("board", "eci_admin", "super_admin");
    const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
    const scenarioId = ctx.params.id;

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
      throw new ScenarioError("NOT_FOUND", `Paired fee schedule not found`);
    }

    if (format === "pdf") {
      const buffer = await generateFeeSchedulePDF({
        feeScheduleId: feeScheduleRow.id,
        scenarioId: scenarioRow.id,
      });
      const fname = pdfFilename(scenarioRow.name, scenarioRow.status);

      await audit.write({
        actorId: BigInt(user.id),
        action: "scenario.compute",
        entityType: "scenario",
        entityId: scenarioRow.id,
        metadata: { export: "pdf", filename: fname },
      });

      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fname}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // ---- CSV branch ----
    const baseConfig = feeBaseConfigSchema.parse(feeScheduleRow.baseConfig);
    const overrides = scenarioRow.seasonOverrides
      ? scenarioSeasonOverridesSchema.parse(scenarioRow.seasonOverrides)
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

    // Diff against current Active so the CSV includes deltas.
    const [activeRow] = await db
      .select()
      .from(schema.feeSchedule)
      .where(eq(schema.feeSchedule.state, "active"))
      .limit(1);

    let csv = "";
    if (activeRow && activeRow.id !== feeScheduleRow.id) {
      const activeConfig = feeBaseConfigSchema.parse(activeRow.baseConfig);
      const activeProjection = projectScenario({
        feeSchedule: activeConfig as unknown as PricingFeeSchedule,
        assignments,
        seasonYear,
      });
      const cmp = compareScenarios(activeProjection, projection, { topN: 1000 });
      csv = perHolderCsvWithDelta(cmp.perHolderDeltas);
    } else {
      csv = perHolderCsvNoDelta(projection.perHolder);
    }

    const fname = csvFilename(scenarioRow.name, scenarioRow.status);

    await audit.write({
      actorId: BigInt(user.id),
      action: "scenario.compute",
      entityType: "scenario",
      entityId: scenarioRow.id,
      metadata: { export: "csv", filename: fname, rowCount: projection.perHolder.length },
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (isScenarioError(err)) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: err.toHttpStatus() },
      );
    }
    if (err instanceof Error && err.name === "ForbiddenError") {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: err.message } }, { status: 403 });
    }
    if (err instanceof Error && err.name === "UnauthorizedError") {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: err.message } }, { status: 401 });
    }
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "unknown" } },
      { status: 500 },
    );
  }
}

/* ============================================================
 * CSV builders
 * ============================================================ */

function perHolderCsvWithDelta(
  rows: ReadonlyArray<{
    holderName: string;
    slipNumber: string;
    baselineFee: number;
    scenarioFee: number;
    delta: number;
    deltaPct: number;
  }>,
): string {
  const out: string[] = [
    ["Holder", "Slip", "Current Fee", "Scenario Fee", "Delta $", "Delta %"]
      .map(csvEscape)
      .join(","),
  ];
  for (const r of rows) {
    out.push(
      [
        r.holderName,
        r.slipNumber,
        r.baselineFee.toFixed(2),
        r.scenarioFee.toFixed(2),
        r.delta.toFixed(2),
        r.deltaPct.toFixed(2),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return out.join("\n") + "\n";
}

function perHolderCsvNoDelta(
  rows: ReadonlyArray<{
    holderName: string;
    slipNumber: string;
    fee: number;
  }>,
): string {
  const out: string[] = [
    ["Holder", "Slip", "Scenario Fee"].map(csvEscape).join(","),
  ];
  for (const r of rows) {
    out.push(
      [r.holderName, r.slipNumber, r.fee.toFixed(2)].map(csvEscape).join(","),
    );
  }
  return out.join("\n") + "\n";
}

function csvEscape(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function pdfFilename(scenarioName: string, status: string): string {
  const safe = scenarioName.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60);
  const date = new Date().toISOString().slice(0, 10);
  return `wharfside-${safe}-${status}-${date}.pdf`;
}

function csvFilename(scenarioName: string, status: string): string {
  const safe = scenarioName.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60);
  const date = new Date().toISOString().slice(0, 10);
  return `wharfside-${safe}-${status}-${date}.csv`;
}
