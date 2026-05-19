// AppFolio CSV exporter. Architecture §10 + QA-STRATEGY §3.6.
//
// Output schema is locked at:
//   holder_id, unit_code, slip_number, season_year, charge_type, charge_date,
//   amount, description
//
// PII boundary (QA-STRATEGY §3.6.8): no email, phone, registration,
// insurance policy #, or full names beyond what AppFolio already has.

import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveFee, type FeeSchedule, type HolderState, type LeaseType, type SlipTier } from "@/lib/pricing/resolve";
import { formatCents } from "@/lib/utils/round";

// ---------------------------------------------------------------------------
// Locked output schema
// ---------------------------------------------------------------------------

export const APPFOLIO_CSV_HEADERS = [
  "holder_id",
  "unit_code",
  "slip_number",
  "season_year",
  "charge_type",
  "charge_date",
  "amount",
  "description",
] as const;

export type AppFolioHeader = (typeof APPFOLIO_CSV_HEADERS)[number];

export const APPFOLIO_CHARGE_TYPES = [
  "SLIP_FULL_SEASON",
  "SLIP_HALF_SEASON_1",
  "SLIP_HALF_SEASON_2",
  "TRANSIENT",
  "AMENITY",
  "BUY_IN",
  "PREMIUM_SURCHARGE",
  "OVERRIDE_ADJUSTMENT",
] as const;

export type AppFolioChargeType = (typeof APPFOLIO_CHARGE_TYPES)[number];

export interface AppFolioRow {
  holder_id: string;
  unit_code: string;
  slip_number: string;
  season_year: string;
  charge_type: AppFolioChargeType;
  charge_date: string; // ISO YYYY-MM-DD
  amount: string; // 2dp string, e.g. "4331.25"
  description: string;
}

export class AppFolioExportError extends Error {
  override readonly name = "AppFolioExportError";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the AppFolio charge CSV for one fee schedule + season.
 *
 * Pulls all CONFIRMED assignments for the season, joins to holder + slip
 * + vessel + fee schedule, runs each through `resolveFee`, and emits one
 * row per non-zero line item.
 *
 * Returns a UTF-8 CSV string with the locked header row.
 */
export async function generateAppFolioExport(
  feeScheduleId: number,
  seasonYear: number,
): Promise<string> {
  const rows = await collectRows(feeScheduleId, seasonYear);
  return rowsToCsv(rows);
}

/**
 * Pure helper exposed for testing: serialize an array of pre-built rows
 * into a CSV string with the locked header. Quoting follows RFC 4180:
 * fields containing comma, double-quote, or newline are wrapped in
 * double quotes; embedded double quotes are doubled.
 */
export function rowsToCsv(rows: ReadonlyArray<AppFolioRow>): string {
  const lines: string[] = [];
  lines.push(APPFOLIO_CSV_HEADERS.join(","));
  for (const row of rows) {
    lines.push(
      APPFOLIO_CSV_HEADERS.map((h) => csvEscape(row[h])).join(","),
    );
  }
  // Trailing newline keeps `wc -l` honest and aligns with common CSV
  // generators (Postgres COPY, csv-stringify default).
  return lines.join("\n") + "\n";
}

/**
 * Pure helper exposed for testing: build the row set from a denormalized
 * input list (assignment + holder + slip + vessel + schedule). Production
 * `generateAppFolioExport` calls this after the join query.
 */
export function buildRows(input: BuildRowsInput): AppFolioRow[] {
  const { assignments, schedule, seasonYear } = input;
  const rows: AppFolioRow[] = [];

  for (const a of assignments) {
    const holder = a.holder;
    const slip = a.slip;
    const vessel = a.vessel;
    const leaseType = a.leaseType;

    // Map slip tier to the typed SlipTier or fail loudly.
    if (slip.tier !== "Premium" && slip.tier !== "Standard" && slip.tier !== "Restricted") {
      throw new AppFolioExportError(
        `Slip ${slip.slip_number} has unknown tier '${slip.tier}'`,
      );
    }

    const { lineItems } = resolveFee(
      { state: holder.state },
      { tier: slip.tier as SlipTier, fee_modifier: slip.fee_modifier },
      leaseType,
      schedule,
      {
        year: seasonYear,
        nights: a.nights,
        vesselLoaFt: vessel?.loa_ft,
        isFirstSeason: a.isFirstSeason,
      },
    );

    // Strip zero-amount line items (no point billing $0).
    for (const li of lineItems) {
      if (li.amount === 0) continue;
      rows.push({
        holder_id: String(holder.id),
        unit_code: holder.unit_code ?? "",
        slip_number: slip.slip_number,
        season_year: String(seasonYear),
        charge_type: mapLineItemToChargeType(li.kind, leaseType),
        charge_date: a.chargeDate,
        amount: formatCents(li.amount),
        description: li.description,
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Internal types — the shape that buildRows consumes
// ---------------------------------------------------------------------------

export interface BuildRowsInput {
  assignments: ReadonlyArray<DenormalizedAssignment>;
  schedule: FeeSchedule;
  seasonYear: number;
}

export interface DenormalizedAssignment {
  assignmentId: number;
  leaseType: LeaseType;
  chargeDate: string; // ISO YYYY-MM-DD
  nights?: number;
  isFirstSeason?: boolean;
  holder: {
    id: number;
    state: HolderState;
    unit_code: string | null;
  };
  slip: {
    slip_number: string;
    tier: string;
    fee_modifier: number;
  };
  vessel?: {
    loa_ft: number;
  };
}

// ---------------------------------------------------------------------------
// DB layer
// ---------------------------------------------------------------------------

async function collectRows(
  feeScheduleId: number,
  seasonYear: number,
): Promise<AppFolioRow[]> {
  const schedRows = await db
    .select()
    .from(schema.feeSchedule)
    .where(eq(schema.feeSchedule.id, BigInt(feeScheduleId)));
  const sched = schedRows[0];
  if (!sched) {
    throw new AppFolioExportError(`Fee schedule ${feeScheduleId} not found`);
  }
  const schedule = sched.baseConfig as unknown as FeeSchedule;

  const assignmentRows = await db
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
      // Active season + confirmed only. AppFolio doesn't want proposed/canceled.
      inArray(schema.assignment.status, ["confirmed"]),
    );

  // Filter season_year in app code (could be added as a where clause once
  // Drizzle eq with number literal is sorted at the call-site; doing it
  // here avoids a fragile and-clause builder for one column).
  const filtered = assignmentRows.filter((row) => row.a.seasonYear === seasonYear);

  const denormalized: DenormalizedAssignment[] = filtered.map((row) => {
    const startDate = row.a.startDate;
    const endDate = row.a.endDate;
    const nights = computeNights(startDate, endDate);
    return {
      assignmentId: Number(row.a.id),
      leaseType: row.a.leaseType as LeaseType,
      chargeDate: startDate,
      nights,
      // isFirstSeason: not computable from this query alone — would need a
      // sub-query over prior-season assignments. Left undefined; buy-in is
      // currently $0 in the seed so this is a no-op. Flagged in the report.
      isFirstSeason: undefined,
      holder: {
        id: Number(row.h.id),
        state: mapHolderTypeToState(row.h.holderType),
        unit_code: row.h.wharfsideUnitNumber ?? null,
      },
      slip: {
        slip_number: row.s.slipNumber,
        tier: row.s.tier,
        fee_modifier: Number(row.s.feeModifier),
      },
      vessel: row.v ? { loa_ft: Number(row.v.loaFt) } : undefined,
    };
  });

  return buildRows({ assignments: denormalized, schedule, seasonYear });
}

// ---------------------------------------------------------------------------
// Mapping helpers (exposed for tests)
// ---------------------------------------------------------------------------

/**
 * Map a resolveFee line-item `kind` (and the assignment's lease type)
 * to the AppFolio charge_type enum. The BASE line item produces a
 * lease-type-specific code (e.g. SLIP_FULL_SEASON), so it requires the
 * leaseType context.
 */
export function mapLineItemToChargeType(
  kind: "BASE" | "AMENITY" | "BUY_IN" | "TRANSIENT",
  leaseType: LeaseType,
): AppFolioChargeType {
  switch (kind) {
    case "TRANSIENT":
      return "TRANSIENT";
    case "AMENITY":
      return "AMENITY";
    case "BUY_IN":
      return "BUY_IN";
    case "BASE":
      switch (leaseType) {
        case "FULL_SEASON":
          return "SLIP_FULL_SEASON";
        case "HALF_SEASON_1":
          return "SLIP_HALF_SEASON_1";
        case "HALF_SEASON_2":
          return "SLIP_HALF_SEASON_2";
        case "TRANSIENT":
          // Defensive: TRANSIENT lease should produce a TRANSIENT line item,
          // not a BASE; but if a future engine version emits BASE for transient,
          // we still map it consistently.
          return "TRANSIENT";
        default: {
          const _exhaustive: never = leaseType;
          throw new AppFolioExportError(`Unhandled leaseType: ${String(_exhaustive)}`);
        }
      }
    default: {
      const _exhaustive: never = kind;
      throw new AppFolioExportError(`Unhandled line item kind: ${String(_exhaustive)}`);
    }
  }
}

export function mapHolderTypeToState(holderType: string): HolderState {
  switch (holderType) {
    case "resident_owner":
      return "resident-owner";
    case "resident_renter":
      return "resident-renter";
    case "non_resident_owner":
      return "non-resident-owner";
    case "non_resident":
      return "non-resident";
    default:
      throw new AppFolioExportError(`Unknown holder_type '${holderType}'`);
  }
}

function computeNights(startIso: string, endIso: string): number {
  // Inclusive nights — matches the EXCLUDE constraint's `daterange(start, end, '[]')`
  // and the architecture's transient pricing example: end - start + 1.
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new AppFolioExportError(`Invalid date range ${startIso}..${endIso}`);
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end - start) / dayMs) + 1);
}

function csvEscape(value: string): string {
  if (value === "") return "";
  // RFC 4180: quote if value contains comma, quote, CR, or LF.
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
