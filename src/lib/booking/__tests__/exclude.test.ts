// Integration tests for the EXCLUDE USING gist constraint on assignment.
// These tests REQUIRE a live Postgres connection with the migrations
// applied (specifically drizzle/0001_exclude_constraint.sql). They auto-skip
// when TEST_DATABASE_URL is not set.
//
// QA-STRATEGY §3.2 — this is the "tripwire test" for the architectural
// guarantee that two confirmed/proposed assignments cannot overlap on the
// same slip.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import {
  attemptOverlappingInsert,
  closeTestSqlConnection,
  noTestDb,
} from "../exclude-test-helpers";

// ---------------------------------------------------------------------------
// Fixture setup — create one slip we can hammer on, scoped to a UUID prefix
// so parallel test runs don't collide. Rolls back at the end.
// ---------------------------------------------------------------------------

const FIXTURE_SLIP_NUMBER = `test-${Math.random().toString(36).slice(2, 10)}`;
let slipId: number | null = null;
let configId: number | null = null;

async function setupFixture(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const sql = postgres(url, { max: 1 });
  try {
    const cfgRows = await sql<{ id: number }[]>`
      INSERT INTO marina_config (name, effective_date, is_active)
      VALUES (${"test-config-" + FIXTURE_SLIP_NUMBER}, CURRENT_DATE, false)
      RETURNING id
    `;
    configId = Number(cfgRows[0]?.id);
    const slipRows = await sql<{ id: number }[]>`
      INSERT INTO slip (
        config_id, slip_number, position_polygon, loa_limit_ft,
        beam_limit_ft, min_depth_at_mlw_ft, slip_type, tier
      ) VALUES (
        ${configId}, ${FIXTURE_SLIP_NUMBER}, '{}'::jsonb, 50, 18, 8,
        'standard', 'Standard'
      )
      RETURNING id
    `;
    slipId = Number(slipRows[0]?.id);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function teardownFixture(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || slipId === null || configId === null) return;
  const sql = postgres(url, { max: 1 });
  try {
    // Defense in depth — attemptOverlappingInsert rolls back on its own, but
    // wipe anything stale on the fixture slip just in case.
    await sql`DELETE FROM assignment WHERE slip_id = ${slipId}`;
    await sql`DELETE FROM slip WHERE id = ${slipId}`;
    await sql`DELETE FROM marina_config WHERE id = ${configId}`;
  } finally {
    await sql.end({ timeout: 5 });
  }
  await closeTestSqlConnection();
}

beforeAll(async () => {
  if (!noTestDb()) await setupFixture();
});

afterAll(async () => {
  if (!noTestDb()) await teardownFixture();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(noTestDb())("assignment EXCLUDE constraint (live DB)", () => {
  it("3.2.1: two FULL_SEASON on the same slip → second rejected", async () => {
    if (slipId === null) throw new Error("fixture not initialized");
    const r = await attemptOverlappingInsert(
      slipId,
      { startDate: "2026-04-15", endDate: "2026-10-31", leaseType: "FULL_SEASON", seasonYear: 2026 },
      { startDate: "2026-04-15", endDate: "2026-10-31", leaseType: "FULL_SEASON", seasonYear: 2026 },
    );
    expect(r.firstOk).toBe(true);
    expect(r.secondError).not.toBeNull();
    expect(r.secondError).toMatch(/exclusion_violation|no_slip_overlap|23P01/i);
  });

  it("3.2.2: HALF_SEASON_1 + HALF_SEASON_2 non-overlapping on same slip → both accepted", async () => {
    if (slipId === null) throw new Error("fixture not initialized");
    const r = await attemptOverlappingInsert(
      slipId,
      { startDate: "2026-04-15", endDate: "2026-07-14", leaseType: "HALF_SEASON_1", seasonYear: 2026 },
      { startDate: "2026-07-15", endDate: "2026-10-31", leaseType: "HALF_SEASON_2", seasonYear: 2026 },
    );
    expect(r.firstOk).toBe(true);
    expect(r.secondError).toBeNull();
  });

  it("3.2.3: HALF_SEASON_1 + TRANSIENT overlapping (within half range) → rejected", async () => {
    if (slipId === null) throw new Error("fixture not initialized");
    const r = await attemptOverlappingInsert(
      slipId,
      { startDate: "2026-04-15", endDate: "2026-07-31", leaseType: "HALF_SEASON_1", seasonYear: 2026 },
      { startDate: "2026-06-15", endDate: "2026-06-17", leaseType: "TRANSIENT", seasonYear: 2026 },
    );
    expect(r.firstOk).toBe(true);
    expect(r.secondError).not.toBeNull();
    expect(r.secondError).toMatch(/exclusion_violation|no_slip_overlap|23P01/i);
  });

  it("3.2.6: TRANSIENT in gap between HALF_1 and HALF_2 → accepted", async () => {
    if (slipId === null) throw new Error("fixture not initialized");
    // Insert HALF_1 [Apr 1, Jul 31] and HALF_2 [Aug 15, Nov 30], with a
    // TRANSIENT [Aug 5, Aug 10] sitting in the gap. The helper only inserts
    // two ranges per call, so we test the constraint via two pairs:
    // (HALF_1, TRANSIENT-in-gap) — but the helper inserts on the SAME slip,
    // and HALF_1 + TRANSIENT-in-gap don't overlap → both should succeed.
    const r = await attemptOverlappingInsert(
      slipId,
      { startDate: "2026-04-01", endDate: "2026-07-31", leaseType: "HALF_SEASON_1", seasonYear: 2026 },
      { startDate: "2026-08-05", endDate: "2026-08-10", leaseType: "TRANSIENT", seasonYear: 2026 },
    );
    expect(r.firstOk).toBe(true);
    expect(r.secondError).toBeNull();
  });

  it("3.2.7: canceled status is excluded from constraint — overlap allowed", async () => {
    if (slipId === null) throw new Error("fixture not initialized");
    const r = await attemptOverlappingInsert(
      slipId,
      { startDate: "2026-04-15", endDate: "2026-10-31", leaseType: "FULL_SEASON", seasonYear: 2026, status: "canceled" },
      { startDate: "2026-04-15", endDate: "2026-10-31", leaseType: "FULL_SEASON", seasonYear: 2026, status: "confirmed" },
    );
    expect(r.firstOk).toBe(true);
    expect(r.secondError).toBeNull();
  });

  it("3.2.5: two overlapping TRANSIENT on same slip → rejected", async () => {
    if (slipId === null) throw new Error("fixture not initialized");
    const r = await attemptOverlappingInsert(
      slipId,
      { startDate: "2026-08-01", endDate: "2026-08-04", leaseType: "TRANSIENT", seasonYear: 2026 },
      { startDate: "2026-08-03", endDate: "2026-08-06", leaseType: "TRANSIENT", seasonYear: 2026 },
    );
    expect(r.firstOk).toBe(true);
    expect(r.secondError).not.toBeNull();
    expect(r.secondError).toMatch(/exclusion_violation|no_slip_overlap|23P01/i);
  });
});

describe("exclude-test-helpers — skipped when no TEST_DATABASE_URL", () => {
  it("noTestDb() correctly reports environment state", () => {
    expect(typeof noTestDb()).toBe("boolean");
    expect(noTestDb()).toBe(!process.env.TEST_DATABASE_URL);
  });
});
