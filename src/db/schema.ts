import {
  bigserial,
  bigint,
  text,
  timestamp,
  date,
  boolean,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  pgTable,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------- app_user (referenced by most tables) ----------

export const appUser = pgTable("app_user", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull(),
  holderId: bigint("holder_id", { mode: "bigint" }),
  passwordHash: text("password_hash"),
  totpSecret: text("totp_secret"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const authSession = pgTable("auth_session", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  userId: bigint("user_id", { mode: "bigint" })
    .notNull()
    .references(() => appUser.id),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------- marina_config ----------

export const marinaConfig = pgTable(
  "marina_config",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    name: text("name").notNull(),
    effectiveDate: date("effective_date").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    createdBy: bigint("created_by", { mode: "bigint" }).references(() => appUser.id),
  },
  (t) => ({
    oneActive: uniqueIndex("one_active_config")
      .on(t.isActive)
      .where(sql`${t.isActive} = true`),
  }),
);

// ---------- slip ----------

export const slip = pgTable(
  "slip",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    configId: bigint("config_id", { mode: "bigint" })
      .notNull()
      .references(() => marinaConfig.id),
    slipNumber: text("slip_number").notNull(),
    positionPolygon: jsonb("position_polygon").notNull(),
    loaLimitFt: numeric("loa_limit_ft", { precision: 5, scale: 2 }).notNull(),
    beamLimitFt: numeric("beam_limit_ft", { precision: 5, scale: 2 }).notNull(),
    minDepthAtMlwFt: numeric("min_depth_at_mlw_ft", { precision: 5, scale: 2 }).notNull(),
    slipType: text("slip_type").notNull(),
    amenities: jsonb("amenities").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("active"),
    tier: text("tier").notNull(),
    feeModifier: numeric("fee_modifier", { precision: 4, scale: 3 }).notNull().default("1.000"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqSlipNumber: uniqueIndex("slip_config_number_uq").on(t.configId, t.slipNumber),
    byConfig: index("slip_config_idx").on(t.configId),
    byTier: index("slip_tier_idx").on(t.tier),
  }),
);

// ---------- holder ----------

export const holder = pgTable(
  "holder",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    holderType: text("holder_type").notNull(),
    legalName: text("legal_name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    mailingAddress: jsonb("mailing_address"),
    wharfsideUnitNumber: text("wharfside_unit_number"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byStatus: index("holder_status_idx").on(t.status),
    holderTypeCheck: check(
      "holder_type_check",
      sql`${t.holderType} IN ('resident_owner','resident_renter','non_resident_owner','non_resident')`,
    ),
    wmcaConnectionRequiresUnit: check(
      "wmca_connection_requires_unit",
      sql`${t.holderType} = 'non_resident' OR ${t.wharfsideUnitNumber} IS NOT NULL`,
    ),
  }),
);

// ---------- vessel ----------

export const vessel = pgTable(
  "vessel",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    holderId: bigint("holder_id", { mode: "bigint" })
      .notNull()
      .references(() => holder.id),
    name: text("name").notNull(),
    loaFt: numeric("loa_ft", { precision: 5, scale: 2 }).notNull(),
    beamFt: numeric("beam_ft", { precision: 5, scale: 2 }).notNull(),
    draftFt: numeric("draft_ft", { precision: 5, scale: 2 }).notNull(),
    hullColor: text("hull_color"),
    propulsion: text("propulsion"),
    registration: text("registration"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byHolder: index("vessel_holder_idx").on(t.holderId),
  }),
);

// ---------- transient_request ----------

export const transientRequest = pgTable("transient_request", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  requesterPhone: text("requester_phone"),
  vesselName: text("vessel_name"),
  vesselLoaFt: numeric("vessel_loa_ft", { precision: 5, scale: 2 }),
  vesselBeamFt: numeric("vessel_beam_ft", { precision: 5, scale: 2 }),
  vesselDraftFt: numeric("vessel_draft_ft", { precision: 5, scale: 2 }),
  requestedStart: date("requested_start").notNull(),
  requestedEnd: date("requested_end").notNull(),
  purpose: text("purpose"),
  status: text("status").notNull().default("pending"),
  decisionReason: text("decision_reason"),
  decidedBy: bigint("decided_by", { mode: "bigint" }).references(() => appUser.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  uploadToken: text("upload_token"),
  uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------- assignment (booking calendar) ----------
// NOTE: the EXCLUDE USING gist constraint cannot be expressed in Drizzle.
// It is added by a separate SQL migration (see drizzle/0001_exclude_constraint.sql).

export const assignment = pgTable(
  "assignment",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    slipId: bigint("slip_id", { mode: "bigint" })
      .notNull()
      .references(() => slip.id),
    holderId: bigint("holder_id", { mode: "bigint" }).references(() => holder.id),
    vesselId: bigint("vessel_id", { mode: "bigint" }).references(() => vessel.id),
    leaseType: text("lease_type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    seasonYear: integer("season_year").notNull(),
    status: text("status").notNull().default("confirmed"),
    overrideReason: text("override_reason"),
    transientRequestId: bigint("transient_request_id", { mode: "bigint" }).references(
      () => transientRequest.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    bySlipSeason: index("assignment_slip_season_idx").on(t.slipId, t.seasonYear),
    byHolder: index("assignment_holder_idx").on(t.holderId),
    endAfterStart: check("end_after_start", sql`${t.endDate} >= ${t.startDate}`),
    leaseTypeCheck: check(
      "lease_type_check",
      sql`${t.leaseType} IN ('FULL_SEASON','HALF_SEASON_1','HALF_SEASON_2','TRANSIENT')`,
    ),
  }),
);

// ---------- document ----------

export const document = pgTable(
  "document",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    holderId: bigint("holder_id", { mode: "bigint" }).references(() => holder.id),
    vesselId: bigint("vessel_id", { mode: "bigint" }).references(() => vessel.id),
    docType: text("doc_type").notNull(),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "bigint" }).notNull(),
    mimeType: text("mime_type").notNull(),
    expirationDate: date("expiration_date"),
    status: text("status").notNull().default("pending"),
    reviewNotes: text("review_notes"),
    reviewerId: bigint("reviewer_id", { mode: "bigint" }).references(() => appUser.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byHolder: index("doc_holder_idx").on(t.holderId),
    byVessel: index("doc_vessel_idx").on(t.vesselId),
    byExpiration: index("doc_expiration_idx").on(t.expirationDate, t.status),
    holderVesselXor: check(
      "holder_vessel_xor",
      sql`(${t.holderId} IS NOT NULL)::int + (${t.vesselId} IS NOT NULL)::int = 1`,
    ),
  }),
);

// ---------- fee_schedule ----------

export const feeSchedule = pgTable(
  "fee_schedule",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    name: text("name").notNull(),
    state: text("state").notNull().default("draft"),
    baseConfig: jsonb("base_config").notNull(),
    effectiveStart: date("effective_start"),
    effectiveEnd: date("effective_end"),
    approvalReference: text("approval_reference"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: bigint("created_by", { mode: "bigint" }).references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    oneActive: uniqueIndex("one_active_schedule")
      .on(t.state)
      .where(sql`${t.state} = 'active'`),
    stateCheck: check(
      "fee_schedule_state_check",
      sql`${t.state} IN ('draft','submitted','approved','active','archived')`,
    ),
  }),
);

// ---------- scenario ----------

export const scenario = pgTable("scenario", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  name: text("name").notNull(),
  feeScheduleId: bigint("fee_schedule_id", { mode: "bigint" })
    .notNull()
    .references(() => feeSchedule.id),
  seasonOverrides: jsonb("season_overrides"),
  projectedRevenue: numeric("projected_revenue", { precision: 12, scale: 2 }),
  computedAt: timestamp("computed_at", { withTimezone: true }),
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  createdBy: bigint("created_by", { mode: "bigint" }).references(() => appUser.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ---------- audit_log (append-only; UPDATE/DELETE revoked at role level) ----------

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    actorId: bigint("actor_id", { mode: "bigint" }).references(() => appUser.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: bigint("entity_id", { mode: "bigint" }),
    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    metadata: jsonb("metadata"),
    // Engineering review additions (2026-05-19): retrofit-blocked once data exists.
    severity: text("severity").notNull().default("info"), // info / warn / error
    success: boolean("success").notNull().default(true), // false for failed actions
    errorCode: text("error_code"), // populated when success=false
    requestId: text("request_id"), // correlation ID from request middleware
    ipAddress: text("ip_address"), // INET in Postgres; stored as text for portability
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byEntity: index("audit_entity_idx").on(t.entityType, t.entityId),
    byActor: index("audit_actor_idx").on(t.actorId, t.createdAt),
    bySeverity: index("audit_severity_idx").on(t.severity, t.createdAt),
    byFailures: index("audit_failures_idx").on(t.success).where(sql`${t.success} = false`),
    bySeverityCheck: check(
      "audit_severity_check",
      sql`${t.severity} IN ('info','warn','error')`,
    ),
  }),
);

// ---------- cron_run_log (silent-failure guard for scheduled jobs) ----------

export const cronRunLog = pgTable(
  "cron_run_log",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    jobName: text("job_name").notNull(), // e.g. 'doc-expiration-reminders'
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").notNull().default("running"), // running / success / failure
    itemsProcessed: integer("items_processed").default(0),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    byJobTime: index("cron_job_time_idx").on(t.jobName, t.startedAt),
    statusCheck: check(
      "cron_status_check",
      sql`${t.status} IN ('running','success','failure')`,
    ),
  }),
);

// ---------- email_outbox (retry queue for transient delivery failures) ----------

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    toAddress: text("to_address").notNull(),
    template: text("template").notNull(),
    props: jsonb("props").notNull(),
    status: text("status").notNull().default("queued"), // queued / sent / failed / abandoned
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    resendMessageId: text("resend_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byStatusScheduled: index("outbox_status_scheduled_idx").on(t.status, t.scheduledFor),
    statusCheck: check(
      "outbox_status_check",
      sql`${t.status} IN ('queued','sent','failed','abandoned')`,
    ),
  }),
);
