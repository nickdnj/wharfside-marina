# Wharfside Marina — API Endpoint Catalog (v1.0)

**Project:** `wharfside-marina`
**Status:** v1.0 — initial endpoint catalog. Paired with `src/lib/zod/schemas.ts`, `src/lib/auth/config.ts`, `src/lib/emails/*`.
**Date:** 2026-05-19
**Inputs:** `docs/architecture/ARCHITECTURE.md`, `docs/requirements/draft-prd-v0.3.md`, `docs/ux/UX-SPEC.md`, `src/db/schema.ts`, `docs/pricing/FIXTURES.md`.
**Conventions:**
- All routes are Next.js 14 App Router (`src/app/**`).
- **Mutations are Server Actions** (`actions.ts` co-located with the route segment) unless they must be invoked from outside the app (webhooks, public form posts, CSV/PDF download links) — those use Route Handlers under `src/app/api/**`.
- **Auth tags:** `public` (no session), `any` (any authenticated user), `holder`, `board`, `eci_admin`, `super_admin`, `admin` (= `eci_admin` ∪ `super_admin`), `holder_self_only` (holder may only access their own `holder_id`).
- **Error codes** follow RFC 9457 problem+json on REST routes; Server Actions throw typed errors that the client maps to UI states.
- **All admin routes return 403, not 404, on role mismatch** (privacy considered acceptable — the role surface is internal).
- **All write operations write an `audit_log` row** in the same DB transaction. The side-effect column only mentions audit when the action name is non-obvious.
- **Idempotency:** any route that creates a billable side-effect or sends transactional email accepts an `Idempotency-Key` header (or `idempotencyKey` Server Action field). Replays within 24h return the original response.
- **Rate limiting** uses Upstash Rate Limit (free tier), keyed by IP for public routes and by `user_id` for authed routes.

---

## Table of Contents

1. [Auth](#1-auth)
2. [Holders](#2-holders)
3. [Vessels](#3-vessels)
4. [Slips & Marina Configuration](#4-slips--marina-configuration)
5. [Assignments & Booking](#5-assignments--booking)
6. [Transient Requests](#6-transient-requests)
7. [Documents](#7-documents)
8. [Fee Schedules](#8-fee-schedules)
9. [Scenarios (Modeler)](#9-scenarios-modeler)
10. [Reports & Exports](#10-reports--exports)
11. [Admin (Audit, System, Users)](#11-admin-audit-system-users)
12. [Patron Site (Public)](#12-patron-site-public)
13. [Route file structure](#route-file-structure)

---

## 1. Auth

All Auth.js v5 routes are mounted under `/api/auth/*` and handled by the configured handler exported from `src/lib/auth/config.ts`. The endpoints below are the **app-level** wrappers (magic-link request, TOTP enrollment, etc.).

### 1.1 `POST /api/auth/magic-link/request`

- **Method:** POST (route handler)
- **Auth:** `public`
- **Description:** Request a magic-link email for sign-in. Always returns 200 to prevent email enumeration.
- **Request:**
  ```ts
  z.object({
    email: z.string().email().max(254),
    callbackUrl: z.string().url().optional(),
  })
  ```
- **Response (200 always):**
  ```ts
  z.object({ ok: z.literal(true) })
  ```
- **Errors:** `400` (invalid email format), `429` (rate limit).
- **Side effects:** If email matches an active `app_user`, generates a single-use 15-minute token (stored hashed in Auth.js `verification_token`), sends `magic-link` email via Resend. Audit `auth.magic_link.request`.
- **Rate limiting:** 5 per email per hour AND 20 per IP per hour.
- **Idempotency:** Natural — requesting twice within the token's life invalidates the first.

### 1.2 `GET /api/auth/callback/email`

- **Method:** GET (Auth.js built-in)
- **Auth:** `public`
- **Description:** Magic-link landing. Validates token, creates `auth_session`, sets HTTP-only session cookie, redirects.
- **Request (query string):** `token`, `email`, `callbackUrl?`
- **Response:** 302 to `callbackUrl` (default `/holder` for holders, `/admin` for admins).
- **Errors:** `400` (missing/malformed), `401` (token expired or already used), `410` (token consumed).
- **Side effects:** Burns the token. Writes `auth_session`. Stamps `app_user.last_login_at`. Audit `auth.login.magic_link`.
- **Rate limiting:** 30 per IP per hour.

### 1.3 `POST /api/auth/credentials/sign-in`

- **Method:** POST (route handler, wraps Auth.js Credentials)
- **Auth:** `public`
- **Description:** Email + password sign-in for `eci_admin`, `super_admin`, `board`. **First leg only** — if user has TOTP enabled (always true for admin roles), response signals a TOTP challenge.
- **Request:**
  ```ts
  z.object({
    email: z.string().email(),
    password: z.string().min(8).max(256),
  })
  ```
- **Response:**
  ```ts
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("totp_required"), challengeToken: z.string() }),
    z.object({ status: z.literal("signed_in"), redirectTo: z.string() }), // only for board (no TOTP required)
  ])
  ```
- **Errors:** `400` (validation), `401` (bad credentials — generic message), `403` (account suspended), `429` (rate limit).
- **Side effects:** On success, returns a short-lived `challengeToken` (5 min) bound to the user; no session cookie yet. Audit `auth.credentials.first_factor.ok` or `.fail`.
- **Rate limiting:** 10 per IP per 15 min, 5 per email per 15 min.

### 1.4 `POST /api/auth/totp/verify`

- **Method:** POST (route handler)
- **Auth:** `public` (bearer of `challengeToken`)
- **Description:** Second factor for admin login. Consumes the `challengeToken` from 1.3.
- **Request:**
  ```ts
  z.object({
    challengeToken: z.string(),
    code: z.string().regex(/^\d{6}$/),
  })
  ```
- **Response:**
  ```ts
  z.object({ status: z.literal("signed_in"), redirectTo: z.string() })
  ```
- **Errors:** `400`, `401` (bad code), `410` (challenge expired), `429`.
- **Side effects:** Creates `auth_session`, sets cookie, burns challenge. Audit `auth.totp.verify.ok` or `.fail`. After 5 failed codes against the same challenge, challenge is invalidated.
- **Rate limiting:** 10 attempts per challenge token; 30 per IP per hour.

### 1.5 `POST /api/auth/totp/enroll/begin`

- **Method:** POST (route handler)
- **Auth:** `admin` (logged in, but `totp_secret IS NULL` — i.e., enrollment is mandatory before any admin action)
- **Description:** Start TOTP enrollment. Returns a freshly generated secret (otpauth:// URI + base32) and a temporary `enrollmentToken`. Secret is NOT yet stored on `app_user`.
- **Request:**
  ```ts
  z.object({})
  ```
- **Response:**
  ```ts
  z.object({
    otpauthUri: z.string(),         // for QR code rendering client-side
    secretBase32: z.string(),       // for manual entry fallback
    enrollmentToken: z.string(),    // 10-minute, single-use
  })
  ```
- **Errors:** `403` (role not admin / TOTP already enrolled).
- **Side effects:** Audit `auth.totp.enroll.begin`. No DB writes to `app_user` yet.

### 1.6 `POST /api/auth/totp/enroll/confirm`

- **Method:** POST (route handler)
- **Auth:** `admin` (same session as 1.5)
- **Description:** Confirm TOTP enrollment by submitting a code generated from the secret. Persists `totp_secret`.
- **Request:**
  ```ts
  z.object({
    enrollmentToken: z.string(),
    code: z.string().regex(/^\d{6}$/),
  })
  ```
- **Response:**
  ```ts
  z.object({ ok: z.literal(true), recoveryCodes: z.array(z.string()).length(8) })
  ```
- **Errors:** `400`, `401` (bad code), `410` (expired), `409` (already enrolled).
- **Side effects:** Writes `app_user.totp_secret`. Generates and returns 8 single-use recovery codes (hashed in DB). Audit `auth.totp.enroll.confirm`.

### 1.7 `POST /api/auth/totp/disable`

- **Method:** POST
- **Auth:** `super_admin` only (and only against another `app_user.id` or own account; for own account also requires fresh TOTP code)
- **Description:** Disable TOTP for a user — used for account recovery.
- **Request:**
  ```ts
  z.object({ userId: z.coerce.bigint(), reason: z.string().min(20).max(500), currentTotpCode: z.string().regex(/^\d{6}$/).optional() })
  ```
- **Response:** `z.object({ ok: z.literal(true) })`
- **Errors:** `400`, `401`, `403`, `404`.
- **Side effects:** Clears `totp_secret`, invalidates all sessions for that user, sends `welcome-admin` email with re-enrollment link. Audit `auth.totp.disable` with reason.

### 1.8 `POST /api/auth/password/reset/request`

- **Method:** POST
- **Auth:** `public`
- **Description:** Request a password-reset email for an admin/board user. Holders use magic-link only.
- **Request:** `z.object({ email: z.string().email() })`
- **Response (200 always):** `z.object({ ok: z.literal(true) })`
- **Errors:** `400`, `429`.
- **Side effects:** If account exists AND has a `password_hash`, sends `password-reset` email with single-use 30-min token. Audit `auth.password_reset.request`.
- **Rate limiting:** 3 per email per hour, 10 per IP per hour.

### 1.9 `POST /api/auth/password/reset/confirm`

- **Method:** POST
- **Auth:** `public` (bearer of reset token)
- **Description:** Complete password reset.
- **Request:**
  ```ts
  z.object({
    token: z.string(),
    newPassword: z.string().min(12).max(256),
  })
  ```
- **Response:** `z.object({ ok: z.literal(true) })`
- **Errors:** `400`, `401` (bad/expired token), `410`, `422` (password policy fail).
- **Side effects:** Hashes via argon2id, writes `app_user.password_hash`, invalidates all sessions for user, sends notification email. Audit `auth.password_reset.confirm`.

### 1.10 `POST /api/auth/sign-out`

- **Method:** POST
- **Auth:** `any`
- **Description:** End current session.
- **Request:** `z.object({})`
- **Response:** `z.object({ ok: z.literal(true) })`
- **Errors:** none (idempotent).
- **Side effects:** Deletes the `auth_session` row, clears cookie. Audit `auth.signout`.

### 1.11 `GET /api/auth/session`

- **Method:** GET
- **Auth:** `any` (returns `null` if not signed in)
- **Description:** Used by the client to read the current session.
- **Response:**
  ```ts
  z.object({
    user: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string().nullable(),
      role: z.enum(["super_admin", "eci_admin", "board", "holder"]),
      holderId: z.string().nullable(),
    }).nullable(),
    expires: z.string().datetime().nullable(),
  })
  ```
- **Errors:** none.
- **Rate limiting:** none.

---

## 2. Holders

### 2.1 Server Action: `createHolder(input)`

- **Path:** `src/app/admin/holders/actions.ts → createHolder`
- **Auth:** `admin`
- **Description:** Create a holder; optionally also creates an `app_user(role=holder)` and sends a welcome magic-link.
- **Request:**
  ```ts
  createHolderSchema.extend({
    sendPortalInvite: z.boolean().default(true),
  })
  ```
- **Response:** `z.object({ holder: holderSchema, userId: z.string().nullable() })`
- **Errors:** `400`, `403`, `409` (email already exists), `422`.
- **Side effects:** Inserts `holder`; optionally `app_user`; sends `welcome-holder` email. Audit `holder.create`.
- **Idempotency:** `Idempotency-Key` (Server Action field) prevents duplicate sends on double-submit.

### 2.2 Server Action: `updateHolder(holderId, input)`

- **Auth:** `admin`
- **Description:** Edit any holder. Holder self-edits go through 2.6.
- **Request:** `z.object({ holderId: z.coerce.bigint(), patch: createHolderSchema.partial() })`
- **Response:** `z.object({ holder: holderSchema })`
- **Errors:** `400`, `403`, `404`, `422` (e.g., changing to `holder_type='resident_renter'` without a lease doc).
- **Side effects:** Audit `holder.update` with before/after diff.

### 2.3 Server Action: `deactivateHolder(holderId, reason)`

- **Auth:** `admin`
- **Description:** Soft-deactivate. Cannot fully delete a holder with historical assignments (PRD FR-3.2.1).
- **Request:** `z.object({ holderId: z.coerce.bigint(), reason: z.string().min(20).max(500) })`
- **Response:** `z.object({ holder: holderSchema })`
- **Errors:** `403`, `404`, `409` (already inactive).
- **Side effects:** Sets `status='inactive'`. Audit `holder.deactivate`.

### 2.4 `GET /api/holders`

- **Method:** GET (route handler — used by autocomplete + CSV link)
- **Auth:** `admin` OR `board` (board read-only)
- **Description:** List/search holders.
- **Request (query):**
  ```ts
  z.object({
    q: z.string().max(120).optional(),
    holderType: z.enum(["resident_owner","resident_renter","non_resident_owner","non_resident"]).optional(),
    status: z.enum(["active","inactive","suspended"]).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  ```
- **Response:**
  ```ts
  z.object({
    items: z.array(holderSchema),
    nextCursor: z.string().nullable(),
  })
  ```
- **Errors:** `403`.
- **Rate limiting:** 60 req/min/user.

### 2.5 `GET /api/holders/:id`

- **Auth:** `admin` OR `board` OR (`holder` AND `holder_self_only`)
- **Description:** Read a single holder with nested vessels, current assignments, doc summary, fee summary.
- **Response:**
  ```ts
  z.object({
    holder: holderSchema,
    vessels: z.array(vesselSchema),
    assignments: z.array(assignmentSchema),   // current + upcoming season
    documents: z.array(documentSchema),
    feeSummary: z.object({
      seasonYear: z.number().int(),
      lineItems: z.array(z.object({
        chargeType: z.string(),
        description: z.string(),
        amount: z.number(),
      })),
      total: z.number(),
    }).nullable(),
  })
  ```
- **Errors:** `403`, `404`.

### 2.6 Server Action: `updateOwnContact(input)`

- **Path:** `src/app/holder/profile/actions.ts → updateOwnContact`
- **Auth:** `holder_self_only`
- **Description:** Holder edits their own contact info (phone, mailing address, emergency contact). Email change requires admin (PRD FR-3.2.2 — vessel/slip changes are admin-only).
- **Request:**
  ```ts
  z.object({
    phone: z.string().optional(),
    mailingAddress: z.object({ street: z.string(), city: z.string(), state: z.string(), zip: z.string() }).optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
  })
  ```
- **Response:** `z.object({ holder: holderSchema })`
- **Errors:** `400`, `401`, `403`.
- **Side effects:** Audit `holder.self_update`.

### 2.7 Server Action: `snapshotResidency(seasonYear)`

- **Auth:** `admin`
- **Description:** FR-3.2.4. Snapshots every active holder's `holder_type` into `residency_state_for_season_year` and stamps `residency_state_locked_at = now()`. Idempotent for the same `seasonYear`.
- **Request:** `z.object({ seasonYear: z.number().int().min(2026).max(2100), force: z.boolean().default(false) })`
- **Response:** `z.object({ snapshotCount: z.number().int(), seasonYear: z.number().int() })`
- **Errors:** `403`, `409` (already snapshotted; pass `force=true` only with super_admin).
- **Side effects:** Single audit event `holder.residency.snapshot` with the count.
- **Idempotency:** Natural by `seasonYear` — second call without `force` returns the original count.

### 2.8 Server Action: `overrideResidencyState(holderId, newState, reason)`

- **Auth:** `admin`
- **Description:** Mid-season override of locked residency state (PRD §3.2.A).
- **Request:**
  ```ts
  z.object({
    holderId: z.coerce.bigint(),
    newState: z.enum(["resident_owner","resident_renter","non_resident_owner","non_resident"]),
    reason: z.string().min(20).max(500),
  })
  ```
- **Response:** `z.object({ holder: holderSchema })`
- **Errors:** `403`, `404`, `422` (reason too short).
- **Side effects:** Audit `holder.residency.override` with reason and prior state.

### 2.9 `GET /api/holders/residency-watch`

- **Auth:** `admin`
- **Description:** FR-3.2.5. List `resident_renter` holders whose lease doc expires before `season_end_date`.
- **Request (query):** `z.object({ seasonYear: z.coerce.number().int() })`
- **Response:**
  ```ts
  z.object({
    items: z.array(z.object({
      holder: holderSchema,
      leaseDocId: z.string(),
      leaseExpiresOn: z.string().date(),
      daysUntilExpiry: z.number().int(),
    })),
  })
  ```
- **Errors:** `403`.

### 2.10 `GET /api/holders/:id/export.csv`

- **Method:** GET (route handler)
- **Auth:** `admin` OR `holder_self_only` (PII export-on-request, ARCH §12.2)
- **Description:** One-click CSV export of all data associated with a single holder.
- **Response:** `text/csv` attachment.
- **Errors:** `403`, `404`.
- **Side effects:** Audit `holder.export`.
- **Rate limiting:** 5 per hour per user.

---

## 3. Vessels

### 3.1 Server Action: `createVessel(input)`

- **Auth:** `admin` OR (`holder_self_only` with `holderId === session.holderId`)
- **Description:** Add a vessel to a holder. Holders can create on their own holder_id only.
- **Request:** `createVesselSchema`
- **Response:** `z.object({ vessel: vesselSchema })`
- **Errors:** `400`, `403`, `422`.
- **Side effects:** Audit `vessel.create`.

### 3.2 Server Action: `updateVessel(vesselId, patch)`

- **Auth:** `admin` (holder edits are admin-mediated per FR-3.2.2)
- **Request:** `z.object({ vesselId: z.coerce.bigint(), patch: createVesselSchema.partial() })`
- **Response:** `z.object({ vessel: vesselSchema })`
- **Errors:** `400`, `403`, `404`, `409` (changing dimensions on a vessel with active assignments may break slip-fit — see 5.x).
- **Side effects:** Audit `vessel.update`. If dimensions changed AND vessel has active assignment, the audit metadata includes the affected `assignment_id`s for admin follow-up.

### 3.3 Server Action: `archiveVessel(vesselId, reason)`

- **Auth:** `admin`
- **Description:** Soft-archive a vessel (cannot delete if assignment history exists).
- **Request:** `z.object({ vesselId: z.coerce.bigint(), reason: z.string().min(20).max(500) })`
- **Response:** `z.object({ vessel: vesselSchema })`
- **Errors:** `403`, `404`, `409`.

### 3.4 `GET /api/vessels?holderId=`

- **Auth:** `admin` OR (`holder_self_only`)
- **Description:** List vessels for a holder.
- **Request (query):** `z.object({ holderId: z.coerce.bigint() })`
- **Response:** `z.object({ items: z.array(vesselSchema) })`
- **Errors:** `403`, `404`.

### 3.5 `GET /api/vessels/:id`

- **Auth:** `admin` OR `holder_self_only` (matched via `vessel.holder_id`)
- **Response:** `z.object({ vessel: vesselSchema, documents: z.array(documentSchema) })`
- **Errors:** `403`, `404`.

---

## 4. Slips & Marina Configuration

### 4.1 Server Action: `createMarinaConfig(input)`

- **Auth:** `admin`
- **Description:** FR-3.1.1. Create a new marina config version, optionally cloning slips from a prior version.
- **Request:**
  ```ts
  z.object({
    name: z.string().min(1).max(120),
    effectiveDate: z.string().date(),
    notes: z.string().max(2000).optional(),
    cloneFromConfigId: z.coerce.bigint().optional(),
  })
  ```
- **Response:** `z.object({ marinaConfig: marinaConfigSchema, slipsCloned: z.number().int() })`
- **Errors:** `400`, `403`, `404` (clone source missing).
- **Side effects:** Inserts `marina_config` + cloned `slip` rows. Audit `marina_config.create`.

### 4.2 Server Action: `activateMarinaConfig(configId)`

- **Auth:** `admin`
- **Description:** FR-3.1.4. Set this config Active; previous Active becomes Archived. Enforced by the partial unique index `one_active_config`.
- **Request:** `z.object({ configId: z.coerce.bigint() })`
- **Response:** `z.object({ activeConfigId: z.string() })`
- **Errors:** `403`, `404`, `409` (DB unique-violation if a race occurred).
- **Side effects:** Audit `marina_config.activate`.

### 4.3 Server Action: `updateMarinaConfig(configId, patch)`

- **Auth:** `admin`
- **Description:** FR-3.1.5. Edit Marina Configuration season parameters (season dates, half-season split, resident discount defaults, etc.).
- **Request:**
  ```ts
  z.object({
    configId: z.coerce.bigint(),
    patch: marinaConfigSchema.partial().omit({ id: true, createdAt: true }),
    justification: z.string().min(20).max(500).optional(),  // required when editing after residency_lock_date
  })
  ```
- **Response:** `z.object({ marinaConfig: marinaConfigSchema })`
- **Errors:** `400`, `403`, `404`, `422` (justification required).
- **Side effects:** Audit `marina_config.update`.

### 4.4 `GET /api/marina-configs`

- **Auth:** `any` authenticated user (read-only)
- **Description:** List all config versions.
- **Response:** `z.object({ items: z.array(marinaConfigSchema) })`

### 4.5 `GET /api/marina-configs/:id`

- **Auth:** `any` authenticated user
- **Response:** `z.object({ config: marinaConfigSchema, slips: z.array(slipSchema) })`

### 4.6 Server Action: `createSlip(input)`

- **Auth:** `admin`
- **Description:** FR-3.1.2. Add a slip to a marina config (typically only used on a non-active future config).
- **Request:** `createSlipSchema`
- **Response:** `z.object({ slip: slipSchema })`
- **Errors:** `400`, `403`, `404`, `409` (slip_number already exists in this config).
- **Side effects:** Audit `slip.create`.

### 4.7 Server Action: `updateSlip(slipId, patch)`

- **Auth:** `admin`
- **Description:** Edit slip attributes (LOA limit, tier, fee_modifier, polygon, etc.).
- **Request:** `z.object({ slipId: z.coerce.bigint(), patch: createSlipSchema.partial() })`
- **Response:** `z.object({ slip: slipSchema })`
- **Errors:** `400`, `403`, `404`, `409` (slip locked by historical assignments — requires `super_admin` plus justification).

### 4.8 Server Action: `setSlipStatus(slipId, status, reason)`

- **Auth:** `admin`
- **Description:** Mark slip `active` / `oos` / `restoration-pending`. OOS auto-cancels future-dated assignments on that slip after a confirmation step.
- **Request:** `z.object({ slipId: z.coerce.bigint(), status: z.enum(["active","oos","restoration-pending"]), reason: z.string().min(20).max(500) })`
- **Response:** `z.object({ slip: slipSchema, affectedAssignmentIds: z.array(z.string()) })`
- **Errors:** `403`, `404`.
- **Side effects:** Audit `slip.status_change`.

### 4.9 `GET /api/slips`

- **Auth:** `any` authenticated user (filtered: holders see only their assigned slip)
- **Description:** List slips on a config, with current-season assignment summary.
- **Request (query):**
  ```ts
  z.object({
    configId: z.coerce.bigint().optional(),  // defaults to active config
    seasonYear: z.coerce.number().int().optional(),
    status: z.enum(["active","oos","restoration-pending"]).optional(),
    tier: z.enum(["Premium","Standard","Restricted"]).optional(),
  })
  ```
- **Response:**
  ```ts
  z.object({
    items: z.array(slipSchema.extend({
      currentAssignment: assignmentSchema.nullable(),
      occupancyByLeaseType: z.record(z.enum(["FULL_SEASON","HALF_SEASON_1","HALF_SEASON_2","TRANSIENT"]), z.boolean()),
    })),
  })
  ```
- **Errors:** `403`.

### 4.10 `GET /api/slips/:id`

- **Auth:** `any` authenticated user (holders limited to their own slip)
- **Response:**
  ```ts
  z.object({
    slip: slipSchema,
    history: z.array(assignmentSchema),    // FR-3.3.4
    currentAssignments: z.array(assignmentSchema),
  })
  ```
- **Errors:** `403`, `404`.

### 4.11 `GET /api/slips/:id/history.csv`

- **Auth:** `admin` OR `board`
- **Description:** FR-3.3.4 CSV export.
- **Response:** `text/csv`.
- **Errors:** `403`, `404`.
- **Side effects:** Audit `slip.history.export`.

### 4.12 `GET /api/slips/availability`

- **Auth:** `admin` OR `board`
- **Description:** Booking-calendar availability query (ARCH §5.4). "What slips are open for [start, end]?"
- **Request (query):**
  ```ts
  z.object({
    start: z.string().date(),
    end: z.string().date(),
    vesselLoaFt: z.coerce.number().positive().optional(),
    vesselBeamFt: z.coerce.number().positive().optional(),
    vesselDraftFt: z.coerce.number().positive().optional(),
    leaseType: z.enum(["FULL_SEASON","HALF_SEASON_1","HALF_SEASON_2","TRANSIENT"]).optional(),
  })
  ```
- **Response:**
  ```ts
  z.object({
    items: z.array(z.object({
      slip: slipSchema,
      fits: z.boolean(),               // slip-fit against the provided vessel dims, if any
      fitFailures: z.array(z.object({ dim: z.enum(["LOA","Beam","Draft"]), vessel: z.number(), limit: z.number() })),
    })),
  })
  ```
- **Errors:** `400`, `403`.

---

## 5. Assignments & Booking

### 5.1 Server Action: `createAssignment(input)`

- **Auth:** `admin`
- **Description:** FR-3.3.1. Create an assignment. Runs slip-fit (FR-3.3.2) and the booking-conflict rules (PRD §3.3.C). On slip-fit failure, returns a `FitFailure[]` and an `overrideToken`; resubmit with `overrideReason` ≥20 chars to bypass.
- **Request:**
  ```ts
  createAssignmentSchema.extend({
    overrideReason: z.string().min(20).max(500).optional(),
    overrideToken: z.string().optional(),
    idempotencyKey: z.string().uuid().optional(),
  })
  ```
- **Response (success):** `z.object({ assignment: assignmentSchema })`
- **Response (slip-fit fail):**
  ```ts
  z.object({
    status: z.literal("slip_fit_failed"),
    failures: z.array(z.object({ dim: z.enum(["LOA","Beam","Draft"]), vessel: z.number(), limit: z.number() })),
    overrideToken: z.string().nullable(),  // null if actor's role cannot override
  })
  ```
- **Errors:** `400`, `403` (role can't override), `404` (slip/holder/vessel missing), `409` (booking conflict — overlap or full-season preemption), `422` (lease-type rules violated).
- **Side effects:** Inserts `assignment` row (status=`confirmed` by default; `proposed` if `proposedOnly=true`). Sends `assignment-confirmed` email to holder. Audit `assignment.create` (and `assignment.override` if override used).
- **Idempotency:** Honored via `Idempotency-Key`.

### 5.2 Server Action: `updateAssignment(assignmentId, patch)`

- **Auth:** `admin`
- **Description:** Edit lease type, vessel, or date range. Re-runs slip-fit + conflict checks.
- **Request:**
  ```ts
  z.object({
    assignmentId: z.coerce.bigint(),
    patch: createAssignmentSchema.partial(),
    overrideReason: z.string().min(20).max(500).optional(),
  })
  ```
- **Response:** Same shape as 5.1 (success OR slip_fit_failed).
- **Errors:** `400`, `403`, `404`, `409`.
- **Side effects:** Audit `assignment.update`.

### 5.3 Server Action: `cancelAssignment(assignmentId, reason)`

- **Auth:** `admin`
- **Description:** Set `status='canceled'`. Frees the date range in the exclusion constraint (ARCH §5.6).
- **Request:** `z.object({ assignmentId: z.coerce.bigint(), reason: z.string().min(20).max(500) })`
- **Response:** `z.object({ assignment: assignmentSchema })`
- **Errors:** `400`, `403`, `404`, `409` (already canceled).
- **Side effects:** Sends `assignment-cancelled` email to holder if `holderId` set. Audit `assignment.cancel`.

### 5.4 Server Action: `confirmAssignment(assignmentId)`

- **Auth:** `admin`
- **Description:** Promote `proposed` → `confirmed`. Triggers the email + (later) charge.
- **Request:** `z.object({ assignmentId: z.coerce.bigint() })`
- **Response:** `z.object({ assignment: assignmentSchema })`
- **Errors:** `403`, `404`, `409` (not in `proposed`).
- **Side effects:** Sends `assignment-confirmed` email. Audit `assignment.confirm`.

### 5.5 `GET /api/assignments`

- **Auth:** `admin` OR `board`
- **Description:** List/filter assignments.
- **Request (query):**
  ```ts
  z.object({
    seasonYear: z.coerce.number().int().optional(),
    slipId: z.coerce.bigint().optional(),
    holderId: z.coerce.bigint().optional(),
    leaseType: z.enum(["FULL_SEASON","HALF_SEASON_1","HALF_SEASON_2","TRANSIENT"]).optional(),
    status: z.enum(["proposed","confirmed","closed","canceled"]).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  ```
- **Response:**
  ```ts
  z.object({
    items: z.array(assignmentSchema),
    nextCursor: z.string().nullable(),
  })
  ```
- **Errors:** `403`.

### 5.6 `GET /api/assignments/:id`

- **Auth:** `admin` OR `board` OR (`holder_self_only` matched on `assignment.holder_id`)
- **Response:**
  ```ts
  z.object({
    assignment: assignmentSchema,
    slip: slipSchema,
    holder: holderSchema.nullable(),
    vessel: vesselSchema.nullable(),
    feeLineItems: z.array(z.object({ chargeType: z.string(), description: z.string(), amount: z.number() })),
  })
  ```
- **Errors:** `403`, `404`.

### 5.7 `GET /api/assignments/calendar`

- **Auth:** `admin` OR `board`
- **Description:** Marina-wide booking calendar (UX 4.3). Per-slip-per-day matrix.
- **Request (query):**
  ```ts
  z.object({
    seasonYear: z.coerce.number().int(),
    configId: z.coerce.bigint().optional(),
  })
  ```
- **Response:**
  ```ts
  z.object({
    seasonStartDate: z.string().date(),
    seasonEndDate: z.string().date(),
    slips: z.array(z.object({
      slip: slipSchema,
      blocks: z.array(z.object({
        assignmentId: z.string(),
        leaseType: z.enum(["FULL_SEASON","HALF_SEASON_1","HALF_SEASON_2","TRANSIENT"]),
        start: z.string().date(),
        end: z.string().date(),
        status: z.enum(["proposed","confirmed","closed","canceled"]),
        holderName: z.string().nullable(),
        vesselName: z.string().nullable(),
      })),
    })),
  })
  ```
- **Errors:** `403`.

### 5.8 Server Action: `openSlipWindowToTransient(input)`

- **Auth:** `admin`
- **Description:** FR-3.4.6. Mark a slip-window eligible for public transient requests (per Q-TRANSIENT1 Option C hybrid).
- **Request:**
  ```ts
  z.object({
    slipId: z.coerce.bigint(),
    seasonYear: z.number().int(),
    start: z.string().date(),
    end: z.string().date(),
  })
  ```
- **Response:** `z.object({ ok: z.literal(true) })`
- **Errors:** `400`, `403`, `404`, `409` (window covered by full/half).
- **Side effects:** Audit `slip.open_transient_window`.

### 5.9 Server Action: `previewSlipFit(input)`

- **Auth:** `admin` OR `holder_self_only`
- **Description:** Pure-check; no DB write. Client also runs locally for UX (ARCH §6.1).
- **Request:**
  ```ts
  z.object({
    slipId: z.coerce.bigint(),
    vesselId: z.coerce.bigint(),
    safetyMargin: z.number().default(0.5),
  })
  ```
- **Response:**
  ```ts
  z.object({
    fits: z.boolean(),
    failures: z.array(z.object({ dim: z.enum(["LOA","Beam","Draft"]), vessel: z.number(), limit: z.number() })),
  })
  ```
- **Errors:** `400`, `403`, `404`.

### 5.10 `GET /api/holder/me/assignments`

- **Auth:** `holder_self_only`
- **Description:** Current holder's assignments (UX 4.4 "My slip").
- **Response:** `z.object({ items: z.array(assignmentSchema) })`
- **Errors:** `401`, `403`.

---

## 6. Transient Requests

### 6.1 `POST /api/transient/requests` (public form)

- **Auth:** `public`
- **Description:** FR-3.4.1. Public form submission.
- **Request:** `publicTransientRequestSchema`
- **Response:** `z.object({ requestId: z.string(), confirmationSent: z.boolean() })`
- **Errors:** `400`, `422`, `429`.
- **Side effects:** Inserts `transient_request` (status=`pending`). Sends `transient-request-received` ack email to requester. Audit `transient_request.create`.
- **Rate limiting:** 5 per IP per hour, 3 per email per hour.
- **Idempotency:** `Idempotency-Key` header optional; without one, dedupe by (email, requested_start, requested_end, vessel_name) within 5 minutes.

### 6.2 Server Action: `approveTransientRequest(input)`

- **Auth:** `admin`
- **Description:** FR-3.4.3. Approve + assign a specific slip; creates an `assignment` with `lease_type='TRANSIENT'`. Runs slip-fit (overridable).
- **Request:**
  ```ts
  z.object({
    requestId: z.coerce.bigint(),
    slipId: z.coerce.bigint(),
    startDate: z.string().date(),
    endDate: z.string().date(),
    overrideReason: z.string().min(20).max(500).optional(),
  })
  ```
- **Response:**
  ```ts
  z.object({
    request: transientRequestSchema,
    assignmentId: z.string(),
    uploadUrl: z.string().url(),    // 48-hour upload link for COI + registration
  })
  ```
- **Errors:** `400`, `403`, `404`, `409` (overlap/preempted), `422`.
- **Side effects:** Updates request to `approved`, generates `upload_token` (48h), inserts assignment, sends `transient-request-approved` email. Audit `transient_request.approve`.

### 6.3 Server Action: `denyTransientRequest(input)`

- **Auth:** `admin`
- **Description:** FR-3.4.4.
- **Request:** `z.object({ requestId: z.coerce.bigint(), reason: z.string().min(20).max(500) })`
- **Response:** `z.object({ request: transientRequestSchema })`
- **Errors:** `403`, `404`, `409`.
- **Side effects:** Sends `transient-request-denied` email. Audit `transient_request.deny`.

### 6.4 Server Action: `holdTransientRequest(input)`

- **Auth:** `admin`
- **Description:** FR-3.4.5.
- **Request:** `z.object({ requestId: z.coerce.bigint(), askMessage: z.string().min(20).max(1000) })`
- **Response:** `z.object({ request: transientRequestSchema })`
- **Errors:** `403`, `404`, `409`.
- **Side effects:** Sends `transient-request-needs-info` email. Audit `transient_request.hold`.

### 6.5 `GET /api/transient/requests`

- **Auth:** `admin`
- **Description:** Transient queue (UX 4.5 sibling).
- **Request (query):**
  ```ts
  z.object({
    status: z.enum(["pending","approved","denied","hold","expired"]).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  ```
- **Response:** `z.object({ items: z.array(transientRequestSchema), nextCursor: z.string().nullable() })`
- **Errors:** `403`.

### 6.6 `GET /api/transient/requests/:id`

- **Auth:** `admin`
- **Response:** `z.object({ request: transientRequestSchema, eligibleSlips: z.array(slipSchema) })`
- **Errors:** `403`, `404`.

### 6.7 `POST /api/transient/upload/:token`

- **Auth:** `public` (bearer of upload token from approval email)
- **Description:** Public uploader for COI + registration after a transient approval. The token authorizes uploads against the specific request only.
- **Request:** `multipart/form-data` with fields:
  - `docType: z.enum(["COI", "registration"])`
  - `file: File` (PDF/JPG/PNG, ≤25MB)
  - `expirationDate: z.string().date()`
- **Response:** `z.object({ documentId: z.string(), status: z.literal("pending") })`
- **Errors:** `400`, `401` (token expired/invalid), `410`, `413` (file too big), `415` (mime), `422`.
- **Side effects:** Uploads to R2 via signed URL; inserts `document` row tagged to the transient request's vessel-or-holder; sends notification to ECI review queue.
- **Rate limiting:** 10 uploads per token (token represents one approval).

### 6.8 Cron: `runTransientReminderJob` (Vercel Cron, `/api/cron/transient-reminders`)

- **Auth:** `cron` (Vercel signature header + bearer secret)
- **Description:** Every 6 hours, find approved transient requests whose upload window expires in <24h and have not received COI/registration → send `transient-upload-reminder`.
- **Response:** `z.object({ sent: z.number().int() })`
- **Errors:** `401`.
- **Idempotency:** Per (request, day) — a row in `audit_log` with `action='transient.upload_reminder.sent'` is consulted before re-sending.

### 6.9 Cron: `expireTransientTokens` (`/api/cron/expire-transient-tokens`)

- **Auth:** `cron`
- **Description:** Hourly: set `status='expired'` on `transient_request` rows whose `upload_expires_at < now()` AND status='approved' AND COI/reg missing.
- **Response:** `z.object({ expired: z.number().int() })`

---

## 7. Documents

### 7.1 Server Action: `requestUploadUrl(input)`

- **Auth:** `holder_self_only` OR `admin`
- **Description:** Get a signed PUT URL for R2 (ARCH §12.3). Client PUTs directly to R2; server only persists metadata after PUT completes (see 7.2).
- **Request:**
  ```ts
  z.object({
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("holder"), holderId: z.coerce.bigint() }),
      z.object({ kind: z.literal("vessel"), vesselId: z.coerce.bigint() }),
    ]),
    docType: z.enum(["COI","registration","indemnification","captain","survey","RESIDENT_LEASE"]),
    fileName: z.string().min(1).max(255),
    fileSizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
    mimeType: z.enum(["application/pdf","image/jpeg","image/png"]),
  })
  ```
- **Response:**
  ```ts
  z.object({
    uploadUrl: z.string().url(),       // signed R2 PUT URL, 15 min
    fileKey: z.string(),               // R2 object key the client must use
    fileKeyExpiresAt: z.string().datetime(),
  })
  ```
- **Errors:** `400`, `403`, `413`, `415`.
- **Rate limiting:** 30/hour/user.

### 7.2 Server Action: `finalizeUpload(input)`

- **Auth:** Same as 7.1.
- **Description:** Called after the R2 PUT succeeds. Inserts the `document` row and increments `version` if a prior doc of the same (target × docType) exists.
- **Request:** `documentUploadSchema`
- **Response:** `z.object({ document: documentSchema })`
- **Errors:** `400`, `403`, `404`, `409` (R2 object missing), `422`.
- **Side effects:** Inserts `document` (status=`pending`). Audit `document.upload`.

### 7.3 Server Action: `reviewDocument(input)`

- **Auth:** `admin`
- **Description:** FR-3.5.3. Approve/reject a pending document.
- **Request:**
  ```ts
  z.object({
    documentId: z.coerce.bigint(),
    decision: z.enum(["approved","rejected"]),
    reviewNotes: z.string().min(20).max(1000).optional(),    // required when rejected
  }).refine(d => d.decision !== "rejected" || (d.reviewNotes && d.reviewNotes.length >= 20), {
    message: "reviewNotes ≥20 chars required when rejecting",
    path: ["reviewNotes"],
  })
  ```
- **Response:** `z.object({ document: documentSchema })`
- **Errors:** `400`, `403`, `404`, `409` (not `pending`), `422`.
- **Side effects:** Sends `doc-approved` or `doc-rejected` email. If approved AND a stale prior version exists with the same (target × docType), the prior expiration reminders are suppressed. Audit `document.review`.

### 7.4 `GET /api/documents`

- **Auth:** `admin` OR `board`
- **Description:** Review queue + compliance listings (FR-3.5.3, FR-3.5.4).
- **Request (query):**
  ```ts
  z.object({
    status: z.enum(["pending","approved","rejected","expired"]).optional(),
    docType: z.enum(["COI","registration","indemnification","captain","survey","RESIDENT_LEASE"]).optional(),
    holderId: z.coerce.bigint().optional(),
    vesselId: z.coerce.bigint().optional(),
    expiringWithinDays: z.coerce.number().int().min(0).max(365).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  ```
- **Response:** `z.object({ items: z.array(documentSchema), nextCursor: z.string().nullable() })`
- **Errors:** `403`.

### 7.5 `GET /api/documents/:id`

- **Auth:** `admin` OR `board` OR `holder_self_only` (matched via target's holder)
- **Description:** Read a single document including a signed GET URL (5-min expiry, ARCH §12.3).
- **Response:**
  ```ts
  z.object({
    document: documentSchema,
    downloadUrl: z.string().url(),
    downloadUrlExpiresAt: z.string().datetime(),
  })
  ```
- **Errors:** `403`, `404`.
- **Side effects:** Audit `document.read` (read-throttled — debounced 1/min/document/user).

### 7.6 Server Action: `deleteDocument(documentId, reason)`

- **Auth:** `super_admin` only
- **Description:** Hard delete of a stored document (e.g., PII erasure request). Cancels the R2 object too.
- **Request:** `z.object({ documentId: z.coerce.bigint(), reason: z.string().min(20).max(500) })`
- **Response:** `z.object({ ok: z.literal(true) })`
- **Errors:** `403`, `404`, `409` (cannot delete an `approved` doc on a vessel with active assignment; downgrade to suspended first).
- **Side effects:** Audit `document.delete` (with metadata recording the now-deleted file_key and reason).

### 7.7 `GET /api/holder/me/documents`

- **Auth:** `holder_self_only`
- **Description:** Holder's portal Doc Center (UX 4.4).
- **Response:** `z.object({ items: z.array(documentSchema) })`

### 7.8 `GET /api/admin/compliance/summary`

- **Auth:** `admin` OR `board`
- **Description:** FR-3.5.4 / FR-3.5.5 / FR-3.7.2 — compliance dashboard.
- **Request (query):** `z.object({ seasonYear: z.coerce.number().int().optional() })`
- **Response:**
  ```ts
  z.object({
    totalHolders: z.number().int(),
    fullyCompliantCount: z.number().int(),
    nonCompliantHolders: z.array(z.object({
      holder: holderSchema,
      missingDocTypes: z.array(z.string()),
      expiredDocTypes: z.array(z.string()),
    })),
    byDocType: z.array(z.object({
      docType: z.string(),
      currentPct: z.number(),
      expiringPct: z.number(),
      expiredPct: z.number(),
      missingPct: z.number(),
    })),
  })
  ```
- **Errors:** `403`.

### 7.9 Cron: `runDocExpirationScan` (`/api/cron/doc-expiration`)

- **Auth:** `cron`
- **Description:** Daily at 06:00 ET (ARCH §2.3). Finds documents at T-60 / T-30 / T-7 / T-0 / T+1 boundaries; sends the matching email and writes an audit row.
- **Request:** `z.object({})` (cron header only)
- **Response:** `z.object({ sent: z.object({ d60: z.number(), d30: z.number(), d7: z.number(), d0: z.number(), expired: z.number() }) })`
- **Errors:** `401`.
- **Idempotency:** Per (documentId, threshold, day) via audit_log dedupe.

---

## 8. Fee Schedules

### 8.1 Server Action: `createFeeSchedule(input)`

- **Auth:** `admin`
- **Description:** Create a fee schedule in `draft` state. Most often called by the Modeler.
- **Request:**
  ```ts
  feeScheduleSchema.omit({ id: true, state: true, createdAt: true, updatedAt: true, submittedAt: true, approvedAt: true, activatedAt: true, archivedAt: true })
  ```
- **Response:** `z.object({ feeSchedule: feeScheduleSchema })`
- **Errors:** `400`, `403`, `422` (invalid `base_config`).
- **Side effects:** Audit `fee_schedule.create`.

### 8.2 Server Action: `updateFeeSchedule(id, patch)`

- **Auth:** `admin`
- **Description:** Edit a `draft` schedule. Locked once `state != draft`.
- **Request:** `z.object({ id: z.coerce.bigint(), patch: feeScheduleSchema.partial() })`
- **Response:** `z.object({ feeSchedule: feeScheduleSchema })`
- **Errors:** `400`, `403`, `404`, `409` (not in draft), `422`.

### 8.3 Server Action: `transitionFeeSchedule(input)`

- **Auth:** `admin`
- **Description:** State-machine transition: draft→submitted→approved→active→archived (PRD §3.6.4). Each transition requires the matching metadata.
- **Request:** `feeScheduleStateTransitionSchema`
- **Response:** `z.object({ feeSchedule: feeScheduleSchema, previousActiveArchivedId: z.string().nullable() })`
- **Errors:** `400`, `403`, `404`, `409` (illegal transition, or another schedule already active), `422`.
- **Side effects:**
  - On `submitted`: sends `fee-schedule-submitted` email to board reviewers; freezes editing.
  - On `approved`: sends `fee-schedule-approved` to all admins; records `approval_reference`.
  - On `active`: archives prior Active (via `one_active_schedule` unique index — serialized with SELECT FOR UPDATE on prior); sends `fee-schedule-activated` to all admins; **kicks Season Charge issuance for confirmed assignments matching effective range** (see 8.6).
  - All transitions audit-logged with actor + reference.
- **Idempotency:** Repeating a transition that already happened returns 409 (not idempotent — actor should refresh).

### 8.4 `GET /api/fee-schedules`

- **Auth:** `admin` OR `board`
- **Description:** List schedules.
- **Request (query):** `z.object({ state: z.enum(["draft","submitted","approved","active","archived"]).optional() })`
- **Response:** `z.object({ items: z.array(feeScheduleSchema) })`
- **Errors:** `403`.

### 8.5 `GET /api/fee-schedules/:id`

- **Auth:** `admin` OR `board`
- **Response:** `z.object({ feeSchedule: feeScheduleSchema, lineItemsPreview: z.array(z.object({ chargeType: z.string(), description: z.string(), amount: z.number() })) })`
- **Errors:** `403`, `404`.

### 8.6 Server Action: `issueSeasonCharges(feeScheduleId, seasonYear, dryRun)`

- **Auth:** `admin`
- **Description:** Internal action triggered by activation (8.3) or manually via the Modeler. For every confirmed assignment matching season, calls `resolveFee()` and (a) records a `season_charge` summary row, (b) sends `season-charge-issued` to the holder, (c) is later picked up by the AppFolio CSV export.
- **Request:** `z.object({ feeScheduleId: z.coerce.bigint(), seasonYear: z.number().int(), dryRun: z.boolean().default(true) })`
- **Response:**
  ```ts
  z.object({
    issuedCount: z.number().int(),
    totalAmount: z.number(),
    byChargeType: z.record(z.string(), z.number()),
    dryRun: z.boolean(),
  })
  ```
- **Errors:** `403`, `404`, `409` (schedule not Active).
- **Side effects:** When `dryRun=false`, sends emails + audit `season_charge.issue`. Idempotent by (feeScheduleId, seasonYear) — second non-dry call returns the original snapshot.

---

## 9. Scenarios (Modeler)

### 9.1 Server Action: `createScenario(input)`

- **Auth:** `admin` OR `board`
- **Description:** Create a new scenario, cloned from an existing fee schedule (default: active) or another scenario's underlying schedule.
- **Request:**
  ```ts
  scenarioSchema.omit({ id: true, status: true, computedAt: true, projectedRevenue: true, createdAt: true, updatedAt: true })
    .extend({
      cloneFromFeeScheduleId: z.coerce.bigint().optional(),
      cloneFromScenarioId: z.coerce.bigint().optional(),
    })
  ```
- **Response:** `z.object({ scenario: scenarioSchema })`
- **Errors:** `400`, `403`, `404`, `422`.
- **Side effects:** Inserts `scenario` (status=`draft`) + a paired `fee_schedule` (state=`draft`). Audit `scenario.create`.

### 9.2 Server Action: `updateScenario(id, patch)`

- **Auth:** `admin` OR (`board` AND creator-only)
- **Description:** Edit a scenario's name/notes/overrides. To edit the underlying rates, call 9.4.
- **Request:** `z.object({ id: z.coerce.bigint(), patch: scenarioSchema.partial() })`
- **Response:** `z.object({ scenario: scenarioSchema })`
- **Errors:** `400`, `403`, `404`, `409` (not in draft).

### 9.3 Server Action: `updateScenarioFeeSchedule(id, patch)`

- **Auth:** `admin` OR (`board` AND creator-only)
- **Description:** Update the underlying `fee_schedule.base_config` JSON for the scenario. Triggers a recompute.
- **Request:** `z.object({ id: z.coerce.bigint(), baseConfig: z.unknown() /* validated against fee schedule shape */ })`
- **Response:**
  ```ts
  z.object({
    scenario: scenarioSchema,
    projection: z.object({
      total: z.number(),
      byLeaseType: z.record(z.string(), z.number()),
      byHolderType: z.record(z.string(), z.number()),
      computedAt: z.string().datetime(),
    }),
  })
  ```
- **Errors:** `400`, `403`, `404`, `409`, `422`.

### 9.4 Server Action: `computeScenarioProjection(id)`

- **Auth:** `admin` OR `board`
- **Description:** Recompute projected revenue using current assignments × the scenario's fee schedule × marina-config overrides (FR-3.6.2.1).
- **Request:** `z.object({ id: z.coerce.bigint() })`
- **Response:** Same `projection` shape as 9.3.
- **Errors:** `403`, `404`.
- **Side effects:** Updates `scenario.projected_revenue` + `computed_at`. No audit (compute-only).
- **Rate limiting:** 30/min/user (Linda may iterate fast).

### 9.5 Server Action: `compareScenarios(input)`

- **Auth:** `admin` OR `board`
- **Description:** 3-column compare (Active vs. Scenario A vs. Scenario B) per FR-3.6.2.3.
- **Request:**
  ```ts
  z.object({
    baselineFeeScheduleId: z.coerce.bigint().optional(),   // defaults to active
    scenarioAId: z.coerce.bigint(),
    scenarioBId: z.coerce.bigint().optional(),
  })
  ```
- **Response:**
  ```ts
  z.object({
    rows: z.array(z.object({
      key: z.string(),
      label: z.string(),
      baseline: z.number().nullable(),
      scenarioA: z.number().nullable(),
      scenarioB: z.number().nullable().optional(),
      deltaA: z.number(),
      deltaB: z.number().optional(),
    })),
    totals: z.object({ baseline: z.number(), scenarioA: z.number(), scenarioB: z.number().optional() }),
  })
  ```
- **Errors:** `400`, `403`, `404`.

### 9.6 Server Action: `archiveScenario(id, reason)`

- **Auth:** `admin` OR (`board` AND creator-only)
- **Request:** `z.object({ id: z.coerce.bigint(), reason: z.string().max(500).optional() })`
- **Response:** `z.object({ scenario: scenarioSchema })`
- **Errors:** `403`, `404`, `409`.

### 9.7 `GET /api/scenarios`

- **Auth:** `admin` OR `board`
- **Description:** Scenario library (FR-3.6.3.1).
- **Request (query):**
  ```ts
  z.object({
    status: z.enum(["draft","under_review","submitted","approved_superseded","archived"]).optional(),
    createdBy: z.coerce.bigint().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  ```
- **Response:** `z.object({ items: z.array(scenarioSchema), nextCursor: z.string().nullable() })`
- **Errors:** `403`.

### 9.8 `GET /api/scenarios/:id`

- **Auth:** `admin` OR `board`
- **Response:**
  ```ts
  z.object({
    scenario: scenarioSchema,
    feeSchedule: feeScheduleSchema,
    projection: z.object({ total: z.number(), byLeaseType: z.record(z.string(), z.number()), byHolderType: z.record(z.string(), z.number()), computedAt: z.string().datetime().nullable() }),
    perHolderImpact: z.array(z.object({
      holderId: z.string(),
      holderName: z.string(),
      currentFee: z.number(),
      scenarioFee: z.number(),
      delta: z.number(),
    })),
  })
  ```
- **Errors:** `403`, `404`.

### 9.9 `GET /api/scenarios/:id/export.pdf`

- **Auth:** `admin` OR `board`
- **Description:** FR-3.6.4.2. Branded PDF export with "DRAFT" / "SUBMITTED" watermark depending on state.
- **Response:** `application/pdf` attachment.
- **Errors:** `403`, `404`.
- **Side effects:** Audit `scenario.export.pdf`.

### 9.10 `GET /api/scenarios/:id/export.csv`

- **Auth:** `admin` OR `board`
- **Description:** Per-holder impact CSV (FR-3.6.2.3 Linda's "Excel-killer feature").
- **Response:** `text/csv`.
- **Errors:** `403`, `404`.

---

## 10. Reports & Exports

### 10.1 `GET /api/reports/occupancy-yoy`

- **Auth:** `admin` OR `board`
- **Description:** FR-3.7.1. Year-over-year occupancy by slip class and lease type.
- **Request (query):** `z.object({ seasonYears: z.string().regex(/^\d{4}(,\d{4})*$/) })`
- **Response:**
  ```ts
  z.object({
    rows: z.array(z.object({
      seasonYear: z.number().int(),
      tier: z.enum(["Premium","Standard","Restricted"]),
      leaseType: z.enum(["FULL_SEASON","HALF_SEASON_1","HALF_SEASON_2","TRANSIENT"]),
      assigned: z.number().int(),
      open: z.number().int(),
      pct: z.number(),
    })),
  })
  ```

### 10.2 `GET /api/reports/occupancy-yoy.csv` and `.pdf`

- Same as 10.1, content negotiation per extension.

### 10.3 `GET /api/reports/revenue-projection`

- **Auth:** `admin` OR `board`
- **Description:** FR-3.7.3.
- **Request (query):** `z.object({ seasonYear: z.coerce.number().int(), feeScheduleId: z.coerce.bigint().optional() /* defaults to active */ })`
- **Response:**
  ```ts
  z.object({
    seasonYear: z.number().int(),
    total: z.number(),
    byLeaseType: z.record(z.string(), z.number()),
    byHolderType: z.record(z.string(), z.number()),
    byComponent: z.record(z.string(), z.number()),
  })
  ```

### 10.4 `GET /api/reports/slip-fit-overrides`

- **Auth:** `admin` OR `board`
- **Description:** FR-3.7.4. All assignments with `override_reason` populated.
- **Response:**
  ```ts
  z.object({
    items: z.array(z.object({
      assignment: assignmentSchema,
      failedDims: z.array(z.enum(["LOA","Beam","Draft"])),
      justification: z.string(),
      actorEmail: z.string(),
      overriddenAt: z.string().datetime(),
    })),
  })
  ```

### 10.5 `GET /api/reports/transient-activity`

- **Auth:** `admin` OR `board`
- **Description:** FR-3.7.5.
- **Request (query):** `z.object({ seasonYear: z.coerce.number().int() })`
- **Response:**
  ```ts
  z.object({
    seasonYear: z.number().int(),
    bookingCount: z.number().int(),
    totalRevenue: z.number(),
    avgStayNights: z.number(),
    perSlipUtilization: z.array(z.object({ slipNumber: z.string(), bookings: z.number().int(), nights: z.number().int(), revenue: z.number() })),
  })
  ```

### 10.6 `GET /api/exports/appfolio.csv`

- **Auth:** `admin`
- **Description:** PRD §3.8 — strawman AppFolio CSV.
- **Request (query):**
  ```ts
  z.object({
    feeScheduleId: z.coerce.bigint().optional(),     // defaults to active
    seasonYear: z.coerce.number().int(),
    chargeTypes: z.string().optional(),               // CSV list to filter
  })
  ```
- **Response:** `text/csv` with header + footer-totals row.
- **Errors:** `400`, `403`, `404`, `409` (no active schedule and none provided).
- **Side effects:** Audit `export.appfolio.csv`.
- **Rate limiting:** 30/hour/user.

### 10.7 `GET /api/exports/holder-bulk.zip`

- **Auth:** `admin`
- **Description:** Phase 1.5 — bulk ZIP of all uploaded docs (deferred). Reserved path; returns 501 in MVP.
- **Errors:** `501`.

---

## 11. Admin (Audit, System, Users)

### 11.1 `GET /api/admin/audit-log`

- **Auth:** `admin` OR `board`
- **Description:** Filterable audit feed.
- **Request (query):**
  ```ts
  z.object({
    entityType: z.string().optional(),
    entityId: z.coerce.bigint().optional(),
    actorId: z.coerce.bigint().optional(),
    action: z.string().optional(),                // exact match
    actionPrefix: z.string().optional(),           // e.g., "assignment."
    since: z.string().datetime().optional(),
    until: z.string().datetime().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  ```
- **Response:**
  ```ts
  z.object({
    items: z.array(z.object({
      id: z.string(),
      actorId: z.string().nullable(),
      actorEmail: z.string().nullable(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.string().nullable(),
      beforeData: z.unknown().nullable(),
      afterData: z.unknown().nullable(),
      metadata: z.unknown().nullable(),
      createdAt: z.string().datetime(),
    })),
    nextCursor: z.string().nullable(),
  })
  ```
- **Errors:** `403`.

### 11.2 `GET /api/admin/audit-log/export.csv`

- **Auth:** `admin`
- **Description:** Export filtered audit log.
- **Errors:** `403`.
- **Side effects:** Audit `audit_log.export`.

### 11.3 Server Action: `createAdminUser(input)`

- **Auth:** `super_admin`
- **Description:** Manually create an `eci_admin` / `board` account. TOTP enrollment required at first login.
- **Request:**
  ```ts
  z.object({
    email: z.string().email(),
    name: z.string().min(1).max(120),
    role: z.enum(["eci_admin","board"]),
    sendInvite: z.boolean().default(true),
  })
  ```
- **Response:** `z.object({ user: z.object({ id: z.string(), email: z.string(), name: z.string().nullable(), role: z.string(), status: z.string() }) })`
- **Errors:** `400`, `403`, `409`, `422`.
- **Side effects:** Sends `welcome-admin` email with TOTP enrollment link. Audit `user.create`.

### 11.4 Server Action: `updateUserRole(userId, role)`

- **Auth:** `super_admin`
- **Description:** Change a user's role (e.g., promote `board` to `eci_admin`).
- **Request:** `z.object({ userId: z.coerce.bigint(), role: z.enum(["super_admin","eci_admin","board","holder"]), reason: z.string().min(20).max(500) })`
- **Response:** `z.object({ user: z.object({ id: z.string(), role: z.string() }) })`
- **Errors:** `400`, `403`, `404`, `409` (cannot demote the last super_admin), `422`.
- **Side effects:** Invalidates active sessions for that user (forces re-login). Audit `user.role_change`.

### 11.5 Server Action: `suspendUser(userId, reason)`

- **Auth:** `super_admin` (or `eci_admin` for `holder` accounts only)
- **Request:** `z.object({ userId: z.coerce.bigint(), reason: z.string().min(20).max(500) })`
- **Response:** `z.object({ user: z.object({ id: z.string(), status: z.string() }) })`
- **Errors:** `403`, `404`, `409`.
- **Side effects:** Sets `status='suspended'`, invalidates sessions. Audit `user.suspend`.

### 11.6 `GET /api/admin/users`

- **Auth:** `super_admin` OR `eci_admin` (the latter sees holder users only)
- **Request (query):**
  ```ts
  z.object({
    role: z.enum(["super_admin","eci_admin","board","holder"]).optional(),
    status: z.enum(["active","suspended"]).optional(),
    q: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  ```
- **Response:** `z.object({ items: z.array(z.object({ id: z.string(), email: z.string(), name: z.string().nullable(), role: z.string(), status: z.string(), lastLoginAt: z.string().datetime().nullable() })), nextCursor: z.string().nullable() })`
- **Errors:** `403`.

### 11.7 `GET /api/admin/system-config`

- **Auth:** `super_admin`
- **Description:** Read flat key/value system config (reminder cadence, R2 bucket, etc.).
- **Response:** `z.object({ items: z.record(z.string(), z.unknown()) })`

### 11.8 Server Action: `updateSystemConfig(patch)`

- **Auth:** `super_admin`
- **Request:** `z.object({ patch: z.record(z.string(), z.unknown()) })`
- **Response:** `z.object({ ok: z.literal(true) })`
- **Errors:** `400`, `403`, `422`.
- **Side effects:** Audit `system_config.update`.

### 11.9 `POST /api/admin/webhooks/resend`

- **Auth:** Resend webhook signature
- **Description:** Receive Resend event callbacks (delivered, bounced, complained). Logs into `audit_log` for deliverability tracking.
- **Request:** Resend event payload (signature verified).
- **Response:** `z.object({ ok: z.literal(true) })`
- **Errors:** `401` (bad signature), `400`.

### 11.10 `POST /api/admin/webhooks/sentry`

- **Auth:** Sentry webhook secret (optional integration).
- **Errors:** `401`, `501` (Phase 1.5).

---

## 12. Patron Site (Public)

All read-only, all SSG except where noted. No auth required.

### 12.1 `GET /` (Home)

- **Strategy:** SSG.
- **Response:** HTML.

### 12.2 `GET /rules`

- **Strategy:** SSG. Markdown-sourced (MVP).

### 12.3 `GET /emergency`

- **Strategy:** SSG. High SEO priority.

### 12.4 `GET /map`

- **Strategy:** SSR (renders the read-only slip map without assignment data).
- **Side effects:** Reads `marina_config` (active) + `slip` from DB; ISR cache 5 min.

### 12.5 `GET /contact`

- **Strategy:** SSG.

### 12.6 `GET /faq`

- **Strategy:** SSG.

### 12.7 `GET /transient` (form)

- **Strategy:** SSR (form renders fresh; submit posts to 6.1).

### 12.8 `GET /services` (local services directory)

- **Strategy:** SSG.

### 12.9 `GET /forms` (PDF download links)

- **Strategy:** SSG.

### 12.10 `GET /sitemap.xml` and `/robots.txt`

- **Strategy:** generated via Next.js metadata API.

### 12.11 `GET /sign-in` (entry to magic-link flow)

- **Strategy:** SSR; on POST, posts to 1.1.

---

## Route file structure

```
src/
├── app/
│   ├── (public)/                                    # public site — no auth gate
│   │   ├── layout.tsx
│   │   ├── page.tsx                                 # 12.1 home
│   │   ├── rules/page.tsx                           # 12.2
│   │   ├── emergency/page.tsx                       # 12.3
│   │   ├── map/page.tsx                             # 12.4
│   │   ├── contact/page.tsx                         # 12.5
│   │   ├── faq/page.tsx                             # 12.6
│   │   ├── transient/page.tsx                       # 12.7 form UI
│   │   ├── services/page.tsx                        # 12.8
│   │   ├── forms/page.tsx                           # 12.9
│   │   ├── sign-in/page.tsx                         # 12.11
│   │   ├── sitemap.ts                               # 12.10
│   │   └── robots.ts
│   │
│   ├── holder/                                      # holder portal — auth-gated via middleware
│   │   ├── layout.tsx
│   │   ├── page.tsx                                 # dashboard
│   │   ├── slip/page.tsx
│   │   ├── vessels/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts                           # 3.1 / 3.4 / 3.5 (holder-self subset)
│   │   ├── documents/
│   │   │   ├── page.tsx                             # UX 4.4
│   │   │   └── actions.ts                           # 7.1 / 7.2
│   │   ├── fees/page.tsx
│   │   └── profile/
│   │       ├── page.tsx
│   │       └── actions.ts                           # 2.6
│   │
│   ├── admin/                                       # admin app — auth-gated, role-gated
│   │   ├── layout.tsx
│   │   ├── page.tsx                                 # dashboard
│   │   ├── slip-board/
│   │   │   ├── page.tsx                             # UX 4.2 map
│   │   │   ├── actions.ts                           # 4.6 / 4.7 / 4.8
│   │   │   └── [slipId]/page.tsx
│   │   ├── marina-config/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts                           # 4.1 / 4.2 / 4.3
│   │   │   └── [configId]/page.tsx
│   │   ├── holders/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts                           # 2.1 / 2.2 / 2.3 / 2.7 / 2.8
│   │   │   ├── new/page.tsx
│   │   │   ├── residency-watch/page.tsx
│   │   │   └── [holderId]/
│   │   │       ├── page.tsx
│   │   │       ├── vessels/page.tsx
│   │   │       └── documents/page.tsx
│   │   ├── assignments/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts                           # 5.1 / 5.2 / 5.3 / 5.4 / 5.8 / 5.9
│   │   │   └── [assignmentId]/page.tsx
│   │   ├── calendar/page.tsx                        # UX 4.3 (uses 5.7)
│   │   ├── transient/
│   │   │   ├── page.tsx                             # queue
│   │   │   ├── actions.ts                           # 6.2 / 6.3 / 6.4
│   │   │   └── [requestId]/page.tsx
│   │   ├── documents/
│   │   │   ├── review/
│   │   │   │   ├── page.tsx                         # UX 4.5
│   │   │   │   └── actions.ts                       # 7.3 / 7.6
│   │   │   └── compliance/page.tsx                  # uses 7.8
│   │   ├── pricing/
│   │   │   ├── page.tsx                             # active fee schedule
│   │   │   ├── actions.ts                           # 8.1 / 8.2 / 8.3 / 8.6
│   │   │   └── scenarios/
│   │   │       ├── page.tsx                         # library
│   │   │       ├── actions.ts                       # 9.1 / 9.2 / 9.3 / 9.4 / 9.5 / 9.6
│   │   │       └── [scenarioId]/page.tsx            # Modeler — UX 4.1
│   │   ├── reports/
│   │   │   ├── occupancy/page.tsx                   # uses 10.1
│   │   │   ├── compliance/page.tsx                  # uses 7.8
│   │   │   ├── revenue/page.tsx                     # uses 10.3
│   │   │   ├── slip-fit-overrides/page.tsx          # uses 10.4
│   │   │   └── transient/page.tsx                   # uses 10.5
│   │   ├── audit/page.tsx                           # uses 11.1
│   │   └── users/
│   │       ├── page.tsx                             # uses 11.6
│   │       └── actions.ts                           # 11.3 / 11.4 / 11.5
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts               # Auth.js v5 catch-all (1.2 etc.)
│   │   │   ├── magic-link/request/route.ts          # 1.1
│   │   │   ├── credentials/sign-in/route.ts         # 1.3
│   │   │   ├── totp/verify/route.ts                 # 1.4
│   │   │   ├── totp/enroll/begin/route.ts           # 1.5
│   │   │   ├── totp/enroll/confirm/route.ts         # 1.6
│   │   │   ├── totp/disable/route.ts                # 1.7
│   │   │   ├── password/reset/request/route.ts      # 1.8
│   │   │   ├── password/reset/confirm/route.ts      # 1.9
│   │   │   ├── sign-out/route.ts                    # 1.10
│   │   │   └── session/route.ts                     # 1.11
│   │   ├── holders/
│   │   │   ├── route.ts                             # 2.4 GET
│   │   │   ├── [id]/route.ts                        # 2.5 GET
│   │   │   ├── [id]/export.csv/route.ts             # 2.10
│   │   │   └── residency-watch/route.ts             # 2.9
│   │   ├── vessels/
│   │   │   ├── route.ts                             # 3.4
│   │   │   └── [id]/route.ts                        # 3.5
│   │   ├── marina-configs/
│   │   │   ├── route.ts                             # 4.4
│   │   │   └── [id]/route.ts                        # 4.5
│   │   ├── slips/
│   │   │   ├── route.ts                             # 4.9
│   │   │   ├── availability/route.ts                # 4.12
│   │   │   ├── [id]/route.ts                        # 4.10
│   │   │   └── [id]/history.csv/route.ts            # 4.11
│   │   ├── assignments/
│   │   │   ├── route.ts                             # 5.5
│   │   │   ├── [id]/route.ts                        # 5.6
│   │   │   └── calendar/route.ts                    # 5.7
│   │   ├── transient/
│   │   │   ├── requests/route.ts                    # 6.1 POST + 6.5 GET
│   │   │   ├── requests/[id]/route.ts               # 6.6
│   │   │   └── upload/[token]/route.ts              # 6.7
│   │   ├── documents/
│   │   │   ├── route.ts                             # 7.4
│   │   │   └── [id]/route.ts                        # 7.5
│   │   ├── fee-schedules/
│   │   │   ├── route.ts                             # 8.4
│   │   │   └── [id]/route.ts                        # 8.5
│   │   ├── scenarios/
│   │   │   ├── route.ts                             # 9.7
│   │   │   ├── [id]/route.ts                        # 9.8
│   │   │   ├── [id]/export.pdf/route.ts             # 9.9
│   │   │   └── [id]/export.csv/route.ts             # 9.10
│   │   ├── reports/
│   │   │   ├── occupancy-yoy/route.ts               # 10.1
│   │   │   ├── occupancy-yoy.csv/route.ts           # 10.2 csv
│   │   │   ├── occupancy-yoy.pdf/route.ts           # 10.2 pdf
│   │   │   ├── revenue-projection/route.ts          # 10.3
│   │   │   ├── slip-fit-overrides/route.ts          # 10.4
│   │   │   └── transient-activity/route.ts          # 10.5
│   │   ├── exports/
│   │   │   ├── appfolio.csv/route.ts                # 10.6
│   │   │   └── holder-bulk.zip/route.ts             # 10.7 (501 stub)
│   │   ├── admin/
│   │   │   ├── audit-log/route.ts                   # 11.1
│   │   │   ├── audit-log/export.csv/route.ts        # 11.2
│   │   │   ├── users/route.ts                       # 11.6
│   │   │   ├── system-config/route.ts               # 11.7
│   │   │   └── webhooks/
│   │   │       ├── resend/route.ts                  # 11.9
│   │   │       └── sentry/route.ts                  # 11.10
│   │   ├── holder/
│   │   │   ├── me/assignments/route.ts              # 5.10
│   │   │   └── me/documents/route.ts                # 7.7
│   │   └── cron/
│   │       ├── doc-expiration/route.ts              # 7.9
│   │       ├── transient-reminders/route.ts         # 6.8
│   │       └── expire-transient-tokens/route.ts     # 6.9
│   │
│   ├── layout.tsx                                   # root
│   └── globals.css
│
├── lib/
│   ├── auth/
│   │   ├── config.ts                                # Auth.js v5 export
│   │   └── helpers.ts                               # requireRole / requireSelf / getCurrentUser
│   ├── emails/
│   │   ├── send.ts                                  # typed wrapper
│   │   └── *.tsx                                    # one per template
│   ├── zod/schemas.ts                               # Zod source of truth
│   ├── pricing/resolve.ts                           # pure resolver
│   ├── booking/                                     # slip-fit + conflict logic
│   ├── slip-fit/
│   ├── storage/                                     # R2 signed URLs
│   ├── audit/
│   ├── appfolio/mapping.ts
│   └── utils/
│
├── db/
│   ├── schema.ts
│   └── index.ts
│
└── middleware.ts                                    # auth + role gating
```

---

## Endpoint count summary

| Domain | Count |
|---|---|
| Auth | 11 |
| Holders | 10 |
| Vessels | 5 |
| Slips & Marina Config | 12 |
| Assignments & Booking | 10 |
| Transient Requests | 9 |
| Documents | 9 |
| Fee Schedules | 6 |
| Scenarios (Modeler) | 10 |
| Reports & Exports | 7 |
| Admin (Audit, System, Users) | 10 |
| Patron Site (Public) | 11 |
| **Total** | **110** |

(Counts include both Server Actions and Route Handlers. Some Server Actions are paired with the same UI page; the count reflects distinct logical endpoints.)
