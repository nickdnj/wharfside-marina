/**
 * Dev DB seeder for Wharfside Marina.
 *
 *   pnpm tsx scripts/seed-dev.ts            # interactive (prompts before truncating non-empty DB)
 *   SEED_FORCE=1 pnpm tsx scripts/seed-dev.ts  # skip confirmation
 *
 * Reads fixture JSON files from `scripts/seed-data/` and populates a fresh dev DB
 * with realistic data: 86 slips, 50 holders, 30 vessels, ~100 assignments across
 * 2025/2026/2027 seasons, 5 fee schedules, ~17 transient requests, ~54 documents,
 * 10 app users, 2 marina configs.
 *
 * Transactional — wraps everything in `db.transaction()`. If any insert violates
 * a constraint (CHECK / FK / EXCLUDE / UNIQUE), the whole seed rolls back cleanly.
 *
 * Idempotent-ish — detects if data exists in any populated table and asks for
 * confirmation before truncating. Use SEED_FORCE=1 to skip the prompt.
 *
 * Notes on key derivation:
 *   The fixture JSONs reference entities by natural keys (slip_number, holder_email,
 *   vessel_name, _key for transient requests) since IDs aren't known at fixture-write
 *   time. The script inserts in dependency order and builds lookup Maps as it goes.
 */

// Load .env.local then .env so DATABASE_URL is available when the db module imports.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";

const {
  appUser,
  marinaConfig,
  slip,
  holder,
  vessel,
  transientRequest,
  assignment,
  document,
  feeSchedule,
} = schema;

// ---------- fixture loading ----------

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "seed-data");

function loadFixture<T = unknown>(filename: string): T {
  const raw = readFileSync(join(DATA_DIR, filename), "utf8");
  return JSON.parse(raw) as T;
}

// ---------- typed fixtures ----------

interface MarinaConfigFixture {
  configs: Array<{
    name: string;
    effective_date: string;
    is_active: boolean;
    notes?: string | null;
    _created_by_email?: string | null;
  }>;
}

interface SlipFixture {
  slips: Array<{
    slip_number: string;
    tier: string;
    slip_type: string;
    loa_limit_ft: string;
    beam_limit_ft: string;
    min_depth_at_mlw_ft: string;
    fee_modifier: string;
    amenities: Record<string, boolean>;
    position_polygon: Array<{ x: number; y: number }>;
    notes?: string | null;
  }>;
}

interface HolderFixture {
  holders: Array<{
    legal_name: string;
    holder_type: string;
    email: string;
    phone?: string | null;
    wharfside_unit_number: string | null;
    mailing_address: Record<string, string> | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
    status: string;
    notes?: string | null;
  }>;
}

interface VesselFixture {
  vessels: Array<{
    holder_email: string;
    name: string;
    loa_ft: string;
    beam_ft: string;
    draft_ft: string;
    hull_color?: string | null;
    propulsion?: string | null;
    registration?: string | null;
    status: string;
  }>;
}

interface AssignmentFixture {
  assignments: Array<{
    slip_number: string;
    holder_email: string | null;
    vessel_name: string | null;
    lease_type: string;
    start_date: string;
    end_date: string;
    season_year: number;
    status: string;
    override_reason?: string | null;
    _transient_request_link?: string | null;
  }>;
}

interface FeeScheduleFixture {
  schedules: Array<{
    name: string;
    state: string;
    effective_start: string | null;
    effective_end: string | null;
    approval_reference: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    activated_at: string | null;
    archived_at: string | null;
    _created_by_email: string | null;
    base_config: Record<string, unknown>;
  }>;
}

interface TransientRequestFixture {
  requests: Array<{
    _key: string;
    requester_name: string;
    requester_email: string;
    requester_phone?: string | null;
    vessel_name?: string | null;
    vessel_loa_ft?: string | null;
    vessel_beam_ft?: string | null;
    vessel_draft_ft?: string | null;
    requested_start: string;
    requested_end: string;
    purpose?: string | null;
    status: string;
    decision_reason?: string | null;
    _decided_by_email?: string | null;
    decided_at?: string | null;
    upload_token?: string | null;
    upload_expires_at?: string | null;
  }>;
}

interface AppUserFixture {
  users: Array<{
    email: string;
    name: string;
    role: string;
    status: string;
    _holder_email: string | null;
    password_hash: string | null;
    totp_secret: string | null;
  }>;
}

interface DocumentFixture {
  documents: Array<{
    doc_type: string;
    vessel_name: string | null;
    holder_email: string | null;
    file_key: string;
    file_name: string;
    file_size_bytes: number;
    mime_type: string;
    expiration_date: string | null;
    status: string;
    version: number;
    _reviewer_email?: string | null;
  }>;
}

// ---------- helpers ----------

async function confirmTruncate(): Promise<boolean> {
  if (process.env.SEED_FORCE === "1") {
    console.log("[seed] SEED_FORCE=1 — skipping confirmation, truncating.");
    return true;
  }
  const rl = createInterface({ input, output });
  const answer = await rl.question(
    "[seed] Existing data detected. Truncate ALL tables and reseed? Type 'yes' to confirm: ",
  );
  rl.close();
  return answer.trim().toLowerCase() === "yes";
}

async function dbIsEmpty(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM marina_config) +
      (SELECT COUNT(*) FROM slip) +
      (SELECT COUNT(*) FROM holder) +
      (SELECT COUNT(*) FROM vessel) +
      (SELECT COUNT(*) FROM assignment) +
      (SELECT COUNT(*) FROM transient_request) +
      (SELECT COUNT(*) FROM document) +
      (SELECT COUNT(*) FROM fee_schedule) +
      (SELECT COUNT(*) FROM app_user) AS total
  `);
  const total = Number((result as unknown as Array<{ total: number }>)[0]?.total ?? 0);
  return total === 0;
}

async function truncateAll(): Promise<void> {
  // Order chosen so FK references unwind cleanly. RESTART IDENTITY resets bigserial
  // sequences so re-runs produce stable IDs.
  await db.execute(sql`
    TRUNCATE TABLE
      audit_log,
      scenario,
      document,
      assignment,
      transient_request,
      vessel,
      holder,
      slip,
      marina_config,
      fee_schedule,
      auth_session,
      app_user
    RESTART IDENTITY CASCADE
  `);
}

// ---------- main seed ----------

async function main() {
  console.log("[seed] Connecting to DATABASE_URL...");
  if (!process.env.DATABASE_URL) {
    console.error("[seed] DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  // pre-flight: confirm btree_gist + EXCLUDE constraint are present
  console.log("[seed] Verifying btree_gist extension and no_slip_overlap constraint...");
  const extCheck = await db.execute(sql`
    SELECT extname FROM pg_extension WHERE extname = 'btree_gist'
  `);
  if ((extCheck as unknown as unknown[]).length === 0) {
    console.error(
      "[seed] ABORT: btree_gist extension is missing. Run `pnpm db:migrate` first to apply drizzle/0001_exclude_constraint.sql.",
    );
    process.exit(1);
  }
  const conCheck = await db.execute(sql`
    SELECT conname FROM pg_constraint WHERE conname = 'no_slip_overlap'
  `);
  if ((conCheck as unknown as unknown[]).length === 0) {
    console.error(
      "[seed] ABORT: no_slip_overlap EXCLUDE constraint is missing. Run `pnpm db:migrate` first.",
    );
    process.exit(1);
  }

  if (!(await dbIsEmpty())) {
    const ok = await confirmTruncate();
    if (!ok) {
      console.log("[seed] Aborted.");
      process.exit(0);
    }
    console.log("[seed] Truncating existing data...");
    await truncateAll();
  }

  console.log("[seed] Loading fixtures...");
  const configsFx = loadFixture<MarinaConfigFixture>("marina-configs.json");
  const slipsFx = loadFixture<SlipFixture>("slips.json");
  const holdersFx = loadFixture<HolderFixture>("holders.json");
  const vesselsFx = loadFixture<VesselFixture>("vessels.json");
  const assignmentsFx = loadFixture<AssignmentFixture>("assignments.json");
  const feesFx = loadFixture<FeeScheduleFixture>("fee-schedules.json");
  const transientsFx = loadFixture<TransientRequestFixture>("transient-requests.json");
  const usersFx = loadFixture<AppUserFixture>("app-users.json");
  const docsFx = loadFixture<DocumentFixture>("documents.json");

  // Counters for the final report
  const counts: Record<string, number> = {};

  await db.transaction(async (tx) => {
    // ---------- 1. app_user (no FK deps) ----------
    // Insert users in two passes: first without holder_id (since holder doesn't exist yet),
    // then UPDATE holder_id after holders are inserted.
    console.log("[seed] Inserting app_users (pass 1 — no holder_id yet)...");
    const userIdByEmail = new Map<string, bigint>();
    for (const u of usersFx.users) {
      const [row] = await tx
        .insert(appUser)
        .values({
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          passwordHash: u.password_hash,
          totpSecret: u.totp_secret,
        })
        .returning({ id: appUser.id });
      userIdByEmail.set(u.email, row.id);
    }
    counts.app_user = usersFx.users.length;

    // ---------- 2. marina_config ----------
    console.log("[seed] Inserting marina_configs...");
    const configIdByName = new Map<string, bigint>();
    for (const c of configsFx.configs) {
      const createdBy = c._created_by_email
        ? userIdByEmail.get(c._created_by_email) ?? null
        : null;
      const [row] = await tx
        .insert(marinaConfig)
        .values({
          name: c.name,
          effectiveDate: c.effective_date,
          isActive: c.is_active,
          notes: c.notes ?? null,
          createdBy,
        })
        .returning({ id: marinaConfig.id });
      configIdByName.set(c.name, row.id);
    }
    counts.marina_config = configsFx.configs.length;

    // The active config is where every seeded slip lives.
    const activeConfig = configsFx.configs.find((c) => c.is_active);
    if (!activeConfig) throw new Error("No active marina_config in fixtures.");
    const activeConfigId = configIdByName.get(activeConfig.name)!;

    // ---------- 3. slip ----------
    console.log("[seed] Inserting slips...");
    const slipIdByNumber = new Map<string, bigint>();
    for (const s of slipsFx.slips) {
      const [row] = await tx
        .insert(slip)
        .values({
          configId: activeConfigId,
          slipNumber: s.slip_number,
          positionPolygon: s.position_polygon,
          loaLimitFt: s.loa_limit_ft,
          beamLimitFt: s.beam_limit_ft,
          minDepthAtMlwFt: s.min_depth_at_mlw_ft,
          slipType: s.slip_type,
          amenities: s.amenities,
          status: "active",
          tier: s.tier,
          feeModifier: s.fee_modifier,
          notes: s.notes ?? null,
        })
        .returning({ id: slip.id });
      slipIdByNumber.set(s.slip_number, row.id);
    }
    counts.slip = slipsFx.slips.length;

    // ---------- 4. holder ----------
    console.log("[seed] Inserting holders...");
    const holderIdByEmail = new Map<string, bigint>();
    for (const h of holdersFx.holders) {
      const [row] = await tx
        .insert(holder)
        .values({
          holderType: h.holder_type,
          legalName: h.legal_name,
          email: h.email,
          phone: h.phone ?? null,
          mailingAddress: h.mailing_address,
          wharfsideUnitNumber: h.wharfside_unit_number,
          emergencyContactName: h.emergency_contact_name ?? null,
          emergencyContactPhone: h.emergency_contact_phone ?? null,
          status: h.status,
          notes: h.notes ?? null,
        })
        .returning({ id: holder.id });
      holderIdByEmail.set(h.email, row.id);
    }
    counts.holder = holdersFx.holders.length;

    // ---------- 4b. backfill app_user.holder_id ----------
    console.log("[seed] Backfilling app_user.holder_id...");
    for (const u of usersFx.users) {
      if (!u._holder_email) continue;
      const hid = holderIdByEmail.get(u._holder_email);
      if (!hid) {
        throw new Error(
          `app_user.${u.email}._holder_email='${u._holder_email}' has no matching holder row`,
        );
      }
      await tx
        .update(appUser)
        .set({ holderId: hid })
        .where(sql`${appUser.email} = ${u.email}`);
    }

    // ---------- 5. vessel ----------
    console.log("[seed] Inserting vessels...");
    const vesselIdByName = new Map<string, bigint>();
    for (const v of vesselsFx.vessels) {
      const hid = holderIdByEmail.get(v.holder_email);
      if (!hid) {
        throw new Error(`vessel.${v.name}.holder_email='${v.holder_email}' not found`);
      }
      const [row] = await tx
        .insert(vessel)
        .values({
          holderId: hid,
          name: v.name,
          loaFt: v.loa_ft,
          beamFt: v.beam_ft,
          draftFt: v.draft_ft,
          hullColor: v.hull_color ?? null,
          propulsion: v.propulsion ?? null,
          registration: v.registration ?? null,
          status: v.status,
        })
        .returning({ id: vessel.id });
      vesselIdByName.set(v.name, row.id);
    }
    counts.vessel = vesselsFx.vessels.length;

    // ---------- 6. transient_request ----------
    // Insert BEFORE assignments so the FK assignment.transient_request_id is valid.
    console.log("[seed] Inserting transient_requests...");
    const transientIdByKey = new Map<string, bigint>();
    for (const r of transientsFx.requests) {
      const decidedBy = r._decided_by_email
        ? userIdByEmail.get(r._decided_by_email) ?? null
        : null;
      const [row] = await tx
        .insert(transientRequest)
        .values({
          requesterName: r.requester_name,
          requesterEmail: r.requester_email,
          requesterPhone: r.requester_phone ?? null,
          vesselName: r.vessel_name ?? null,
          vesselLoaFt: r.vessel_loa_ft ?? null,
          vesselBeamFt: r.vessel_beam_ft ?? null,
          vesselDraftFt: r.vessel_draft_ft ?? null,
          requestedStart: r.requested_start,
          requestedEnd: r.requested_end,
          purpose: r.purpose ?? null,
          status: r.status,
          decisionReason: r.decision_reason ?? null,
          decidedBy,
          decidedAt: r.decided_at ? new Date(r.decided_at) : null,
          uploadToken: r.upload_token ?? null,
          uploadExpiresAt: r.upload_expires_at ? new Date(r.upload_expires_at) : null,
        })
        .returning({ id: transientRequest.id });
      transientIdByKey.set(r._key, row.id);
    }
    counts.transient_request = transientsFx.requests.length;

    // ---------- 7. assignment ----------
    // Per the EXCLUDE constraint, no two confirmed/proposed assignments on the same slip
    // can overlap. Fixtures are authored to honor this; if violated, the insert throws
    // and the whole transaction rolls back.
    console.log("[seed] Inserting assignments...");
    let assignmentCount = 0;
    for (const a of assignmentsFx.assignments) {
      const sid = slipIdByNumber.get(a.slip_number);
      if (!sid) throw new Error(`assignment.slip_number='${a.slip_number}' not found`);

      const hid = a.holder_email ? holderIdByEmail.get(a.holder_email) ?? null : null;
      if (a.holder_email && !hid) {
        throw new Error(`assignment.holder_email='${a.holder_email}' not found`);
      }

      const vid = a.vessel_name ? vesselIdByName.get(a.vessel_name) ?? null : null;
      if (a.vessel_name && !vid) {
        throw new Error(`assignment.vessel_name='${a.vessel_name}' not found`);
      }

      const trId = a._transient_request_link
        ? transientIdByKey.get(a._transient_request_link) ?? null
        : null;
      if (a._transient_request_link && !trId) {
        throw new Error(
          `assignment._transient_request_link='${a._transient_request_link}' not found`,
        );
      }

      await tx.insert(assignment).values({
        slipId: sid,
        holderId: hid,
        vesselId: vid,
        leaseType: a.lease_type,
        startDate: a.start_date,
        endDate: a.end_date,
        seasonYear: a.season_year,
        status: a.status,
        overrideReason: a.override_reason ?? null,
        transientRequestId: trId,
      });
      assignmentCount++;
    }
    counts.assignment = assignmentCount;

    // ---------- 8. document ----------
    console.log("[seed] Inserting documents...");
    for (const d of docsFx.documents) {
      const hid = d.holder_email ? holderIdByEmail.get(d.holder_email) ?? null : null;
      const vid = d.vessel_name ? vesselIdByName.get(d.vessel_name) ?? null : null;
      if (d.holder_email && !hid) {
        throw new Error(`document.holder_email='${d.holder_email}' not found`);
      }
      if (d.vessel_name && !vid) {
        throw new Error(`document.vessel_name='${d.vessel_name}' not found`);
      }
      // XOR check (also enforced by DB CHECK):
      if ((hid !== null) === (vid !== null)) {
        throw new Error(
          `document XOR violation: file_key=${d.file_key} must target exactly one of holder|vessel`,
        );
      }
      const reviewerId = d._reviewer_email
        ? userIdByEmail.get(d._reviewer_email) ?? null
        : null;
      const reviewedAt = d.status === "approved" || d.status === "rejected"
        ? new Date()
        : null;

      await tx.insert(document).values({
        holderId: hid,
        vesselId: vid,
        docType: d.doc_type,
        fileKey: d.file_key,
        fileName: d.file_name,
        fileSizeBytes: BigInt(d.file_size_bytes),
        mimeType: d.mime_type,
        expirationDate: d.expiration_date,
        status: d.status,
        reviewerId,
        reviewedAt,
        version: d.version,
      });
    }
    counts.document = docsFx.documents.length;

    // ---------- 9. fee_schedule ----------
    console.log("[seed] Inserting fee_schedules...");
    for (const f of feesFx.schedules) {
      const createdBy = f._created_by_email
        ? userIdByEmail.get(f._created_by_email) ?? null
        : null;
      await tx.insert(feeSchedule).values({
        name: f.name,
        state: f.state,
        baseConfig: f.base_config,
        effectiveStart: f.effective_start,
        effectiveEnd: f.effective_end,
        approvalReference: f.approval_reference,
        submittedAt: f.submitted_at ? new Date(f.submitted_at) : null,
        approvedAt: f.approved_at ? new Date(f.approved_at) : null,
        activatedAt: f.activated_at ? new Date(f.activated_at) : null,
        archivedAt: f.archived_at ? new Date(f.archived_at) : null,
        createdBy,
      });
    }
    counts.fee_schedule = feesFx.schedules.length;
  });

  console.log("\n[seed] OK — committed. Record counts:");
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(20)} ${n}`);
  }
  console.log("\n[seed] Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n[seed] FAILED:", err);
    if (err?.cause) console.error("[seed] cause:", err.cause);
    process.exit(1);
  });
