#!/usr/bin/env tsx
/**
 * Tripwire: verifies the `no_slip_overlap` EXCLUDE constraint is in place and
 * actually rejects overlapping assignments.
 *
 * Run in CI on every PR, and manually before each season's slip assignments are
 * locked. If this script ever exits non-zero, do NOT deploy — investigate
 * immediately.
 *
 * Per QA-STRATEGY §3.2 and RUNBOOK §5.3.
 *
 * Usage:
 *   pnpm tsx scripts/tripwire-exclude.ts
 *
 * Exits:
 *   0 — constraint present AND enforces overlap rejection
 *   1 — constraint missing OR overlap accepted (SEVERE)
 */

import { sql } from "drizzle-orm";
import { db } from "../src/db";

let errors = 0;

function fail(msg: string): void {
  console.error(`✘ ${msg}`);
  errors++;
}

function pass(msg: string): void {
  console.log(`✓ ${msg}`);
}

async function checkExtension(): Promise<void> {
  const result = await db.execute(sql`
    SELECT extname FROM pg_extension WHERE extname = 'btree_gist'
  `);
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
  if (rows.length === 0) {
    fail("btree_gist extension NOT installed");
  } else {
    pass("btree_gist extension installed");
  }
}

async function checkConstraintDefinition(): Promise<void> {
  const result = await db.execute(sql`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conname = 'no_slip_overlap'
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    conname: string;
    def: string;
  }>;
  if (rows.length === 0) {
    fail("no_slip_overlap constraint NOT FOUND on assignment table");
    return;
  }
  pass("no_slip_overlap constraint present");
  const def = rows[0].def;
  if (!def.includes("EXCLUDE USING gist")) {
    fail(`constraint exists but isn't an EXCLUDE constraint: ${def}`);
  } else {
    pass(`constraint shape OK: ${def}`);
  }
  if (!def.includes("daterange") || !def.includes("slip_id")) {
    fail(`constraint missing expected columns (slip_id, daterange): ${def}`);
  }
}

async function liveOverlapTest(): Promise<void> {
  // Use a transient schema to avoid polluting real data.
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS tripwire_test`);
  try {
    await db.execute(sql`
      CREATE TEMP TABLE tripwire_assignment (LIKE assignment INCLUDING ALL) ON COMMIT DROP
    `);
    // Can't easily replicate EXCLUDE in a TEMP TABLE clone via INCLUDING ALL —
    // exclusion constraints aren't included. Instead, verify by attempting a real
    // overlap on a fresh slip/holder pair and rolling back the transaction.
  } catch {
    // ignore; we'll do the live test below
  }

  // Live test: insert two overlapping rows for a freshly-created slip,
  // wrapped in a transaction that we always roll back.
  try {
    await db.transaction(async (tx) => {
      // Need a marina_config + slip to FK against
      const configResult = await tx.execute(sql`
        INSERT INTO marina_config (name, effective_date, is_active)
        VALUES ('TRIPWIRE_TEST', CURRENT_DATE, false)
        RETURNING id
      `);
      const configRows = (Array.isArray(configResult)
        ? configResult
        : (configResult as { rows?: unknown[] }).rows ?? []) as Array<{ id: string | number }>;
      const configId = configRows[0].id;

      const slipResult = await tx.execute(sql`
        INSERT INTO slip (config_id, slip_number, position_polygon, loa_limit_ft, beam_limit_ft, min_depth_at_mlw_ft, slip_type, tier)
        VALUES (${configId}, 'TRIPWIRE-1', '[]'::jsonb, 40, 14, 6, 'open', 'Standard')
        RETURNING id
      `);
      const slipRows = (Array.isArray(slipResult)
        ? slipResult
        : (slipResult as { rows?: unknown[] }).rows ?? []) as Array<{ id: string | number }>;
      const slipId = slipRows[0].id;

      await tx.execute(sql`
        INSERT INTO assignment (slip_id, lease_type, start_date, end_date, season_year, status)
        VALUES (${slipId}, 'FULL_SEASON', '2099-04-15', '2099-10-31', 2099, 'confirmed')
      `);

      let rejected = false;
      try {
        await tx.execute(sql`
          INSERT INTO assignment (slip_id, lease_type, start_date, end_date, season_year, status)
          VALUES (${slipId}, 'TRANSIENT', '2099-06-01', '2099-06-03', 2099, 'confirmed')
        `);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("no_slip_overlap") || msg.includes("exclusion")) {
          rejected = true;
        } else {
          throw err;
        }
      }

      if (rejected) {
        pass("overlap correctly rejected by no_slip_overlap");
      } else {
        fail("OVERLAP ACCEPTED — constraint is not enforcing. DO NOT DEPLOY.");
      }

      // Force rollback so we don't leave test rows behind
      throw new Error("__rollback_tripwire__");
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("__rollback_tripwire__")) {
      // Real error (not our rollback signal)
      throw err;
    }
  }
}

async function main() {
  console.log("Tripwire: EXCLUDE constraint check\n");
  await checkExtension();
  await checkConstraintDefinition();

  if (errors === 0) {
    await liveOverlapTest();
  } else {
    console.log("skipping live overlap test — fix constraint first");
  }

  console.log();
  if (errors > 0) {
    console.error(`FAIL: ${errors} check(s) failed`);
    process.exit(1);
  } else {
    console.log("PASS: all checks passed");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Tripwire crashed:", err);
  process.exit(2);
});
