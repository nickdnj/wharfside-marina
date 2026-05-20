// Load the denormalized assignment set used by the projection engine.
//
// Pulled out of the server actions so:
//   1) It's reusable by the route handlers (CSV / PDF exports).
//   2) It's mockable in tests (vi.mock("@/lib/modeler/assignments")).
//
// Returns lightweight `ProjectionAssignment` rows joined across
// assignment ⋈ slip ⋈ holder ⋈ vessel for the season year, status=confirmed.
// Buy-in / isFirstSeason is left undefined — the seed config has buy_in.amount=0
// so this is a no-op in practice. When buy-in is re-enabled, plug in a
// per-holder prior-season check here.

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { mapHolderTypeToState } from "@/lib/appfolio/export";
import type {
  ProjectionAssignment,
} from "@/lib/modeler/projection";
import type {
  HolderState,
  LeaseType,
  SlipTier,
} from "@/lib/pricing/resolve";

export async function loadProjectionAssignments(
  seasonYear: number,
): Promise<ProjectionAssignment[]> {
  const rows = await db
    .select({
      a: schema.assignment,
      h: schema.holder,
      s: schema.slip,
      v: schema.vessel,
    })
    .from(schema.assignment)
    .innerJoin(schema.holder, eq(schema.holder.id, schema.assignment.holderId))
    .innerJoin(schema.slip, eq(schema.slip.id, schema.assignment.slipId))
    .leftJoin(schema.vessel, eq(schema.vessel.id, schema.assignment.vesselId))
    .where(
      and(
        eq(schema.assignment.status, "confirmed"),
        eq(schema.assignment.seasonYear, seasonYear),
      ),
    );

  return rows.map((row) => {
    // The DB tier string is a free-text column with a check constraint;
    // narrow to SlipTier or fall back to Standard (resolveFee will throw
    // if the schedule has no rate for the tier — that's caught upstream).
    const slipTier: SlipTier =
      row.s.tier === "Premium" || row.s.tier === "Standard" || row.s.tier === "Restricted"
        ? (row.s.tier as SlipTier)
        : "Standard";

    const holderState: HolderState = mapHolderTypeToState(row.h.holderType);
    const leaseType = row.a.leaseType as LeaseType;
    const nights = computeNights(row.a.startDate, row.a.endDate);

    return {
      holderId: String(row.h.id),
      holderName: row.h.legalName,
      holderState,
      slipNumber: row.s.slipNumber,
      slipTier,
      slipFeeModifier: Number(row.s.feeModifier),
      vesselLoaFt: row.v ? Number(row.v.loaFt) : null,
      leaseType,
      nights: leaseType === "TRANSIENT" ? nights : undefined,
      isFirstSeason: undefined,
    };
  });
}

function computeNights(startIso: string, endIso: string): number {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 1;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end - start) / dayMs) + 1);
}
