// Test helpers for verifying the Postgres EXCLUDE USING gist constraint
// on the `assignment` table — QA-STRATEGY §3.2.
//
// These helpers require a LIVE Postgres connection (the constraint is
// enforced by the DB engine, not by application code; a mocked DB would
// silently pass and defeat the whole point of the test).
//
// Tests using these helpers MUST be gated on `process.env.TEST_DATABASE_URL`
// so they skip cleanly in CI environments without a DB.
//
// Each helper:
//   - Uses a dedicated `postgres-js` client built from TEST_DATABASE_URL
//     (not the production `db` import, to avoid contaminating any pooled
//     transaction state).
//   - Wraps work in a SAVEPOINT/ROLLBACK or TRUNCATE-based cleanup so it
//     leaves no rows behind.

import postgres from "postgres";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRangeInput {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  leaseType: "FULL_SEASON" | "HALF_SEASON_1" | "HALF_SEASON_2" | "TRANSIENT";
  status?: "proposed" | "confirmed" | "canceled";
  seasonYear?: number;
  holderId?: number;
}

export interface AttemptResult {
  /** True iff the FIRST insert succeeded. */
  firstOk: boolean;
  /**
   * The Postgres error code/message for the SECOND insert, or null if the
   * second insert also succeeded. Constraint violations surface as
   * code='23P01' (exclusion_violation).
   */
  secondError: string | null;
}

export class ExcludeTestHarnessError extends Error {
  override readonly name = "ExcludeTestHarnessError";
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let _sql: ReturnType<typeof postgres> | null = null;

function getSql(): ReturnType<typeof postgres> {
  if (_sql) return _sql;
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new ExcludeTestHarnessError(
      "TEST_DATABASE_URL is not set — these helpers require a live test DB",
    );
  }
  _sql = postgres(url, { max: 2, idle_timeout: 5 });
  return _sql;
}

/** Test-only: dispose the cached connection (used in afterAll hooks). */
export async function closeTestSqlConnection(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt to insert two assignment rows on the same slip in a single
 * transaction, ROLLBACK on completion. Returns:
 *
 *   { firstOk: true, secondError: null }  → both inserts succeeded
 *   { firstOk: true, secondError: "..." } → first ok, second blocked
 *   { firstOk: false, secondError: ... }  → first itself failed
 *
 * Use this in tests like:
 *
 *   const r = await attemptOverlappingInsert(slipId, range1, range2);
 *   expect(r.firstOk).toBe(true);
 *   expect(r.secondError).toMatch(/exclusion_violation|no_slip_overlap/);
 */
export async function attemptOverlappingInsert(
  slipId: number,
  range1: DateRangeInput,
  range2: DateRangeInput,
): Promise<AttemptResult> {
  const sql = getSql();
  let firstOk = false;
  let secondError: string | null = null;

  try {
    await sql.begin(async (tx) => {
      try {
        await insertAssignmentRow(tx, slipId, range1);
        firstOk = true;
      } catch (err) {
        secondError = errorMessage(err);
        // Re-throw so the outer transaction rolls back; the second insert
        // is skipped by design (no overlap to test if the first failed).
        throw err;
      }
      try {
        await insertAssignmentRow(tx, slipId, range2);
      } catch (err) {
        secondError = errorMessage(err);
        // Don't re-throw the SECOND error — we expect it in many cases and
        // want a clean rollback either way.
      }
      // Force rollback to keep the test DB clean.
      throw new RollbackSignal();
    });
  } catch (err) {
    if (err instanceof RollbackSignal) {
      // expected — the begin block uses throw-to-rollback semantics.
    } else if (!firstOk) {
      // First insert failed for a non-exclusion reason; surface it.
      return { firstOk: false, secondError };
    }
    // Anything else: the second insert (or commit) reported an error we
    // already captured in `secondError`. Continue.
  }

  return { firstOk, secondError };
}

/**
 * Assert helper: fails the test if two ranges WERE both accepted on the
 * same slip. Use to lock down: "this pair MUST be rejected by the DB".
 */
export async function assertNoOverlapAccepted(
  slipId: number,
  range1: DateRangeInput,
  range2: DateRangeInput,
): Promise<void> {
  const result = await attemptOverlappingInsert(slipId, range1, range2);
  if (!result.firstOk) {
    throw new ExcludeTestHarnessError(
      `Sanity check failed: first insert was rejected unexpectedly (${result.secondError ?? "unknown"})`,
    );
  }
  if (result.secondError === null) {
    throw new ExcludeTestHarnessError(
      `EXCLUDE constraint did NOT reject overlapping ranges on slip ${slipId}: ${JSON.stringify(range1)} vs ${JSON.stringify(range2)}`,
    );
  }
}

/** Skip helper for Vitest: pass to `describe.skipIf` / `it.skipIf`. */
export function noTestDb(): boolean {
  return !process.env.TEST_DATABASE_URL;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

class RollbackSignal extends Error {
  override readonly name = "RollbackSignal";
}

async function insertAssignmentRow(
  tx: postgres.TransactionSql,
  slipId: number,
  range: DateRangeInput,
): Promise<void> {
  await tx`
    INSERT INTO assignment
      (slip_id, lease_type, start_date, end_date, season_year, status, holder_id)
    VALUES
      (${slipId},
       ${range.leaseType},
       ${range.startDate}::date,
       ${range.endDate}::date,
       ${range.seasonYear ?? new Date(range.startDate).getUTCFullYear()},
       ${range.status ?? "confirmed"},
       ${range.holderId ?? null})
  `;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    // postgres-js attaches `code` and `constraint_name` on PostgresError.
    const anyErr = err as Error & { code?: string; constraint_name?: string };
    const code = anyErr.code ?? "";
    const constraint = anyErr.constraint_name ?? "";
    const parts = [code, constraint, err.message].filter((s) => s && s.length > 0);
    return parts.join(" / ");
  }
  return String(err);
}
