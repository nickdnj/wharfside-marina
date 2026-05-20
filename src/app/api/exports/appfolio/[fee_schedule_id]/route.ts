// GET /api/exports/appfolio/:fee_schedule_id?seasonYear=2027
//
// Thin auth-wrapped route handler over the existing AppFolio CSV exporter.
// The core export logic lives in `src/lib/appfolio/export.ts` (built earlier);
// this just enforces admin/board access, parses the season year, writes the
// audit row, and pipes the CSV back.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit/log";
import { requireRole } from "@/lib/auth/helpers";
import { generateAppFolioExport, AppFolioExportError } from "@/lib/appfolio/export";

const querySchema = z
  .object({
    seasonYear: z.coerce.number().int().min(2026).max(2100).default(2027),
  })
  .strict();

export async function GET(
  req: NextRequest,
  ctx: { params: { fee_schedule_id: string } },
): Promise<Response> {
  try {
    const user = await requireRole("eci_admin", "super_admin");
    const feeScheduleIdRaw = ctx.params.fee_schedule_id;
    const feeScheduleId = Number(feeScheduleIdRaw);
    if (!Number.isFinite(feeScheduleId) || feeScheduleId <= 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "fee_schedule_id must be a positive number" } },
        { status: 400 },
      );
    }

    const parsed = querySchema.safeParse({
      seasonYear: req.nextUrl.searchParams.get("seasonYear"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: parsed.error.message } },
        { status: 422 },
      );
    }

    const csv = await generateAppFolioExport(feeScheduleId, parsed.data.seasonYear);

    await audit.write({
      actorId: BigInt(user.id),
      action: "fee_schedule.activate", // closest existing action; ideally export.appfolio.csv
      entityType: "fee_schedule",
      entityId: BigInt(feeScheduleId),
      metadata: { export: "appfolio.csv", seasonYear: parsed.data.seasonYear },
    });

    const fname = `appfolio-${feeScheduleId}-${parsed.data.seasonYear}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AppFolioExportError) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: err.message } },
        { status: 404 },
      );
    }
    if (err instanceof Error && err.name === "ForbiddenError") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: err.message } },
        { status: 403 },
      );
    }
    if (err instanceof Error && err.name === "UnauthorizedError") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: err.message } },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL", message: err instanceof Error ? err.message : "unknown" } },
      { status: 500 },
    );
  }
}
