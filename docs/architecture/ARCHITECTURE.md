# Wharfside Marina — Architecture Specification (v1.0)

**Project:** `wharfside-marina`
**Status:** v1.0 — initial architecture spec
**Author:** Software Architecture (Software Project team)
**Date:** 2026-05-19
**Inputs:** `draft-prd-v0.2.md`, `strategy/OFFICE-HOURS.md`
**Sponsor:** Nick DeMarco
**Primary admin user:** Kathy Vanecek (ECI)
**Primary modeler user:** Linda Masessa (Treasurer)
**Target go-live:** Spring 2027 (April)

---

## 1. Executive Summary

### 1.1 System Overview

Wharfside Marina is a single-tenant internal web application for one marina (~86 slips) on the Shrewsbury River in Monmouth Beach, NJ. It consolidates four operational pillars — marina configuration, holder/slip assignment, document collection, and a pricing scenario modeler — behind a public patron site. It does **not** handle payments, accounting, or reservations as a marketplace; AppFolio remains the system of record for billing.

### 1.2 Design Philosophy

- **Boring tech, well-documented.** Nick will eventually roll off the board; the next maintainer should be able to read the stack on a coffee break.
- **One app, one deploy.** Public patron pages and the authenticated admin/holder app share a single codebase and single deployment. No microservices.
- **Postgres is the system of record.** Strong relational constraints (slip-fit, season uniqueness, document XOR) and an append-only audit log. No event bus, no queue.
- **Pure-function pricing engine.** The fee-schedule resolver is deterministic and reused identically by the Active engine and the Scenario Modeler. Same code path, different `fee_schedule_id`.
- **Hosted services over self-hosted.** Backups, TLS, auth, email — none of these should be maintenance burdens on a solo dev.
- **Cost ceiling: $50/mo.** Every choice respects it.

### 1.3 Key Architectural Decisions

| Decision | Choice | Rationale (1-liner) |
|---|---|---|
| Framework | Next.js 14 App Router (TypeScript) | Single codebase for public SSR + authed app; Nick has React experience; huge ecosystem. |
| API style | Next.js Route Handlers + Server Actions | Co-located with frontend; no separate backend deploy; trpc/zod for type-safe validation. |
| Database | Postgres on Neon | Branchable, scales to zero, generous free tier, real Postgres (not a fork). |
| ORM | Drizzle ORM | TypeScript-native, SQL-like, lighter than Prisma, owns migrations. |
| Auth | Auth.js (NextAuth v5) | Magic-link for holders + email/password for admins; free; no vendor lock-in. |
| File storage | Cloudflare R2 | S3-compatible, zero egress fees, ~$0.015/GB/mo; signed URLs. |
| Email | Resend | Cheapest transactional provider with a clean API; React-Email templates. |
| Hosting | Vercel (Hobby → Pro if needed) | Native Next.js host; preview deploys; cron jobs for reminders. |
| Maps | HTML/SVG with custom polygon editor | No vendor; map is ~86 polygons over a PNG background; no need for Leaflet/Mapbox. |
| Monitoring | Sentry (free tier) + Vercel logs | Crash reports + request logs; UptimeRobot for ping. |
| Public site | Same Next.js app, public routes ungated | Single deploy, shared design system, SEO via SSR/SSG. |
| AppFolio | CSV export (MVP); defer live API to v2 | Live API requires partner certification — out of scope for solo build. |

### 1.4 Tech Stack at a Glance

| Layer | Tool | Monthly Cost |
|---|---|---|
| Frontend + API | Next.js 14 on Vercel | $0 (Hobby) → $20 (Pro) |
| Database | Neon Postgres | $0 → $19 (Launch tier) |
| Auth | Auth.js (self-hosted in app) | $0 |
| File storage | Cloudflare R2 | $0.50–2 for ~50GB cap |
| Email | Resend | $0 (3K/mo free) → $20 (50K/mo) |
| Domain | wharfsidemarina.com or wharfsidemb.com subdomain | ~$1/mo amortized |
| Monitoring | Sentry free + UptimeRobot free | $0 |
| **Total MVP** | | **~$0–25/mo** |
| **Total post-launch** | | **~$25–45/mo** |

Within the $30–50/mo budget. Comfortable headroom.

---

## 2. System Architecture

### 2.1 Component Diagram

```
                       ┌──────────────────────────────────────┐
                       │       Patrons (public, no login)     │
                       │  Slip-owners (magic-link)            │
                       │  ECI staff / Board (email + pw + 2FA)│
                       └──────────────┬───────────────────────┘
                                      │ HTTPS
                                      ▼
              ┌────────────────────────────────────────────────────┐
              │           Vercel — Next.js 14 App                  │
              │                                                    │
              │  Public routes (SSR/SSG)   Authed routes (RSC + SA)│
              │  • /                       • /admin/*              │
              │  • /rules                  • /holder/*             │
              │  • /emergency              • /api/* (route handlers)│
              │  • /map                                            │
              │  • /transient (form)       Cron jobs (Vercel Cron):│
              │  • /forms                  • doc expiration scan   │
              │                            • reminder mailer       │
              └───┬────────────┬─────────────────┬────────┬────────┘
                  │            │                 │        │
            ┌─────▼──────┐ ┌──▼────────────┐ ┌──▼─────┐ ┌▼──────────┐
            │   Neon     │ │ Cloudflare R2 │ │ Resend │ │  Sentry   │
            │  Postgres  │ │ (signed URLs) │ │ (smtp) │ │ (errors)  │
            │  + Drizzle │ │  PDFs/images  │ │        │ │           │
            └────────────┘ └───────────────┘ └────────┘ └───────────┘
```

### 2.2 Layout: Public + Authed in One Deploy

Single Next.js app. Public routes are unguarded. Authed routes live under `/admin/*` and `/holder/*` and use middleware to enforce a valid session and role. The marketing/patron site benefits from SSG (rules, emergency, FAQ pre-rendered) and on-demand revalidation when content changes via a webhook from the admin CMS later.

**Why one deploy:** shared components (slip map, branding, layout), one auth system, one DB, one CI pipeline. The downside (deploys of public content require an app deploy) is acceptable — content changes are rare and Vercel deploys take ~60s.

### 2.3 Request Flow Examples

**Public visitor → /rules:**
- Request hits Vercel edge → Next.js SSG-cached page → returned in <300ms. No DB hit.

**Holder uploads COI → /holder/documents:**
- Auth.js verifies session cookie → middleware enforces role=`holder` → server action signs a one-time upload URL for R2 → client PUTs file directly to R2 → server action writes `document` row with `file_key`, sets status=`pending`, kicks audit log row.

**Linda runs a scenario → /admin/pricing/scenarios/new:**
- Page is RSC, fetches active fee schedule + all current assignments from DB → client component lets her edit rates → server action recomputes projected revenue via shared pricing-engine module → results cached in scenario row.

**Vercel Cron at 06:00 daily:**
- Scans `document` for rows with `expiration_date - today() ∈ {60, 30, 7, 0}` and `status != pending_renewal` → enqueues Resend emails → writes audit rows.

---

## 3. Tech Stack (Opinionated)

### 3.1 Frontend Framework — **Next.js 14 (App Router)**

- **Choice:** Next.js 14 with the App Router, React Server Components, and Server Actions.
- **Rationale:** Single framework spans public SSG patron pages and authed app routes; Nick already knows React; the largest hiring/community pool for the next maintainer.
- **Backup:** Remix (now React Router v7) — slightly leaner, same model, smaller community. Astro for public-only would be cleaner but doesn't carry the authed app well.

### 3.2 Backend / API — **Next.js Server Actions + Route Handlers**

- **Choice:** No separate backend. Server Actions for mutations (form posts) and Route Handlers for the few REST endpoints (CSV export, webhooks).
- **Rationale:** Halves the deploy surface area; type-safe end-to-end via Zod schemas shared between client and server.
- **Backup:** A small Hono service if a webhook-heavy or long-running operation emerges (none expected for MVP).

### 3.3 Database — **Neon Postgres**

- **Choice:** Neon serverless Postgres.
- **Rationale:** Real Postgres (no fork like PlanetScale's MySQL), branching for staging, generous free tier (3GB), scales to zero between requests, automatic backups on paid plan. $19/mo Launch tier is more than enough.
- **Backup:** Supabase Postgres — same idea, bundles auth+storage; Railway Postgres if Neon's autosuspend bites us on cold starts.

### 3.4 Auth — **Auth.js (NextAuth v5)**

- **Choice:** Auth.js library, self-hosted inside the Next.js app, backed by Postgres.
- **Rationale:** Free, no vendor lock-in, mature, supports magic-link email (Resend) for holders and credentials+TOTP for admins out of the box. No per-MAU fees.
- **Backup:** Clerk if user provisioning becomes painful — but Clerk's ~$25/mo + per-MAU cost is unnecessary for ~100 users.

### 3.5 File Storage — **Cloudflare R2**

- **Choice:** Cloudflare R2 with signed URLs for upload + download.
- **Rationale:** S3-compatible API, zero egress fees (key for serving doc previews), ~$0.015/GB/mo storage. Worst-case 2GB → $0.03/mo.
- **Backup:** Supabase Storage if we move to Supabase for the DB; AWS S3 if R2 ever feels flaky.

### 3.6 Email — **Resend**

- **Choice:** Resend for transactional email (magic links, doc reminders, transient confirmations).
- **Rationale:** 3,000 emails/mo free; great DX; first-class React Email templates; runs on AWS SES underneath so deliverability is solid.
- **Backup:** Postmark — slightly better deliverability reputation, $15/mo for the volume we'd use.

### 3.7 Hosting — **Vercel**

- **Choice:** Vercel Hobby tier to start; upgrade to Pro ($20/mo) if we exceed limits or need teams.
- **Rationale:** Native Next.js home; preview deploys per PR; Vercel Cron for scheduled jobs; Edge Functions for the public site.
- **Backup:** Railway or Fly.io if Vercel's pricing changes — both can run Next.js fine.

### 3.8 Maps — **Native HTML/SVG**

- **Choice:** Custom SVG-based slip map. PNG/SVG marina diagram as background; slips defined as polygon coordinates in JSON; React component renders polygons with click handlers and color-coding.
- **Rationale:** 86 slips, fixed layout, no geographic projection needed, no third-party tile costs. The "map" is really a floorplan.
- **Backup:** Leaflet with an image overlay if the polygon editor proves too painful — but for an 86-slip fixed layout, SVG is simpler and faster.

---

## 4. Data Model

All tables use `id BIGSERIAL PRIMARY KEY`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`, and `created_by`/`updated_by` FKs to `app_user`. Soft-delete via `deleted_at` where needed. Append-only audit log captures all writes.

### 4.1 Core Tables

#### `marina_config` — versioned marina layout

```sql
CREATE TABLE marina_config (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,                    -- "Pre-Restoration 2026"
  effective_date  DATE NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      BIGINT REFERENCES app_user(id)
);
CREATE UNIQUE INDEX one_active_config ON marina_config(is_active) WHERE is_active = true;
```

#### `slip` — versioned, ties to a config version

```sql
CREATE TABLE slip (
  id                  BIGSERIAL PRIMARY KEY,
  config_id           BIGINT NOT NULL REFERENCES marina_config(id),
  slip_number         TEXT NOT NULL,
  position_polygon    JSONB NOT NULL,               -- array of {x,y} coords for SVG render
  loa_limit_ft        NUMERIC(5,2) NOT NULL,
  beam_limit_ft       NUMERIC(5,2) NOT NULL,
  min_depth_at_mlw_ft NUMERIC(5,2) NOT NULL,
  slip_type           TEXT NOT NULL,                -- covered/open/end-tie/side-tie
  amenities           JSONB NOT NULL DEFAULT '{}',  -- {"30A":true,"50A":true,"water":true}
  status              TEXT NOT NULL DEFAULT 'active', -- active/oos/restoration-pending
  tier                TEXT NOT NULL,                -- Premium/Standard/Restricted
  fee_modifier        NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  notes               TEXT,
  UNIQUE(config_id, slip_number)
);
CREATE INDEX slip_config_idx ON slip(config_id);
CREATE INDEX slip_tier_idx ON slip(tier);
```

#### `holder` — owner of slip leases

```sql
CREATE TABLE holder (
  id                       BIGSERIAL PRIMARY KEY,
  holder_type              TEXT NOT NULL,            -- resident_owner / resident_renter / non_resident_owner / non_resident
  legal_name               TEXT NOT NULL,
  email                    TEXT UNIQUE NOT NULL,
  phone                    TEXT,
  mailing_address          JSONB,                    -- {street, city, state, zip}
  wharfside_unit_number    TEXT,                     -- nullable; required for any WMCA connection (resident_*, non_resident_owner)
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  status                   TEXT NOT NULL DEFAULT 'active', -- active/inactive/suspended
  notes                    TEXT,
  CHECK (holder_type IN ('resident_owner','resident_renter','non_resident_owner','non_resident')),
  -- Only pure non_resident may omit a WMCA unit number. All other types have some WMCA connection.
  CHECK (holder_type = 'non_resident' OR wharfside_unit_number IS NOT NULL)
);
CREATE INDEX holder_status_idx ON holder(status);
```

**Pricing-bucket mapping** (locked 2026-05-19; consumed by `lib/pricing/resolve.ts`):

| holder_type | Pricing bucket | Multiplier |
|---|---|---|
| `resident_owner`, `resident_renter` | `resident` | 0.75 |
| `non_resident_owner` | `non_resident_owner` | 0.85 *(Modeler-driven)* |
| `non_resident` | `non_resident` | 1.00 |

#### `vessel` — 1:N per holder

```sql
CREATE TABLE vessel (
  id              BIGSERIAL PRIMARY KEY,
  holder_id       BIGINT NOT NULL REFERENCES holder(id),
  name            TEXT NOT NULL,
  loa_ft          NUMERIC(5,2) NOT NULL,
  beam_ft         NUMERIC(5,2) NOT NULL,
  draft_ft        NUMERIC(5,2) NOT NULL,
  hull_color      TEXT,
  propulsion      TEXT,
  registration    TEXT,                              -- USCG doc # or state reg
  status          TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX vessel_holder_idx ON vessel(holder_id);
```

#### `assignment` — the unified booking calendar (full + half + transient)

```sql
CREATE TABLE assignment (
  id                BIGSERIAL PRIMARY KEY,
  slip_id           BIGINT NOT NULL REFERENCES slip(id),
  holder_id         BIGINT REFERENCES holder(id),    -- nullable for transient (use transient_request)
  vessel_id         BIGINT REFERENCES vessel(id),
  lease_type        TEXT NOT NULL,                   -- FULL_SEASON / HALF_SEASON_1 / HALF_SEASON_2 / TRANSIENT
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  season_year       INT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'confirmed', -- proposed/confirmed/closed/canceled
  override_reason   TEXT,                            -- populated only if slip-fit was overridden
  transient_request_id BIGINT REFERENCES transient_request(id),
  daterange         DATERANGE GENERATED ALWAYS AS (daterange(start_date, end_date, '[]')) STORED,
  CHECK (end_date >= start_date),
  CHECK (lease_type IN ('FULL_SEASON','HALF_SEASON_1','HALF_SEASON_2','TRANSIENT'))
);

-- Exclusion constraint: no two assignments on the same slip with overlapping date ranges
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE assignment
  ADD CONSTRAINT no_slip_overlap
  EXCLUDE USING gist (
    slip_id WITH =,
    daterange WITH &&
  ) WHERE (status IN ('proposed','confirmed'));

CREATE INDEX assignment_slip_season_idx ON assignment(slip_id, season_year);
CREATE INDEX assignment_holder_idx ON assignment(holder_id);
```

The `EXCLUDE USING gist` constraint is the booking model's hard guarantee. See §5.

#### `transient_request` — public form submissions

```sql
CREATE TABLE transient_request (
  id                BIGSERIAL PRIMARY KEY,
  requester_name    TEXT NOT NULL,
  requester_email   TEXT NOT NULL,
  requester_phone   TEXT,
  vessel_name       TEXT,
  vessel_loa_ft     NUMERIC(5,2),
  vessel_beam_ft    NUMERIC(5,2),
  vessel_draft_ft   NUMERIC(5,2),
  requested_start   DATE NOT NULL,
  requested_end     DATE NOT NULL,
  purpose           TEXT,
  status            TEXT NOT NULL DEFAULT 'pending', -- pending/approved/denied/hold/expired
  decision_reason   TEXT,
  decided_by        BIGINT REFERENCES app_user(id),
  decided_at        TIMESTAMPTZ,
  upload_token      TEXT,                            -- 48h-expiring token for COI/reg upload
  upload_expires_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

#### `document` — per-holder or per-vessel; XOR constraint

```sql
CREATE TABLE document (
  id              BIGSERIAL PRIMARY KEY,
  holder_id       BIGINT REFERENCES holder(id),
  vessel_id       BIGINT REFERENCES vessel(id),
  doc_type        TEXT NOT NULL,                    -- COI/registration/indemnification/captain/survey
  file_key        TEXT NOT NULL,                    -- R2 object key
  file_name       TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type       TEXT NOT NULL,
  expiration_date DATE,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected/expired
  review_notes    TEXT,
  reviewer_id     BIGINT REFERENCES app_user(id),
  reviewed_at     TIMESTAMPTZ,
  version         INT NOT NULL DEFAULT 1,           -- stacks per (target × doc_type)
  CHECK ((holder_id IS NOT NULL)::int + (vessel_id IS NOT NULL)::int = 1)
);
CREATE INDEX doc_holder_idx ON document(holder_id) WHERE holder_id IS NOT NULL;
CREATE INDEX doc_vessel_idx ON document(vessel_id) WHERE vessel_id IS NOT NULL;
CREATE INDEX doc_expiration_idx ON document(expiration_date, status);
```

Computed status (current/expiring/expired/missing) is derived at query time from `expiration_date` and `status`, not stored.

#### `fee_schedule` — versioned with state machine

```sql
CREATE TABLE fee_schedule (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  state               TEXT NOT NULL DEFAULT 'draft', -- draft/submitted/approved/active/archived
  base_config         JSONB NOT NULL,                -- whole rate card serialized; see §7
  effective_start     DATE,
  effective_end       DATE,
  approval_reference  TEXT,                          -- email subject / minutes ID
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  activated_at        TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  created_by          BIGINT REFERENCES app_user(id),
  CHECK (state IN ('draft','submitted','approved','active','archived'))
);
-- Only one ACTIVE schedule at any time
CREATE UNIQUE INDEX one_active_schedule ON fee_schedule(state) WHERE state = 'active';
```

The `base_config` JSONB stores the whole rate card as a single document (see §7.2). Cleaner than 10 normalized tables for what is fundamentally a versioned-config blob.

#### `scenario` — what-if fee schedule

```sql
CREATE TABLE scenario (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  fee_schedule_id     BIGINT NOT NULL REFERENCES fee_schedule(id),
  -- fee_schedule rows in state='draft' double as the editable scenario config
  season_overrides    JSONB,                          -- optional season-date overrides
  projected_revenue   NUMERIC(12,2),                  -- cached output
  computed_at         TIMESTAMPTZ,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',  -- draft/under_review/submitted/approved_superseded/archived
  created_by          BIGINT REFERENCES app_user(id)
);
```

A scenario is essentially "(a draft fee_schedule) + (notes) + (cached projection)." The fee schedule state-machine flow promotes a scenario's underlying `fee_schedule` row from `draft → submitted → approved → active`.

#### `audit_log` — append-only

```sql
CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  actor_id     BIGINT REFERENCES app_user(id),
  action       TEXT NOT NULL,                          -- e.g., "slip.update","scenario.submit","doc.approve"
  entity_type  TEXT NOT NULL,
  entity_id    BIGINT,
  before_data  JSONB,
  after_data   JSONB,
  metadata     JSONB,                                  -- IP, user agent, justification text, etc.
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX audit_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX audit_actor_idx ON audit_log(actor_id, created_at DESC);
-- App-layer enforcement: no UPDATE, no DELETE on audit_log. Revoke at the DB role level.
```

### 4.2 Auth tables

```sql
CREATE TABLE app_user (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  name            TEXT,
  role            TEXT NOT NULL,                       -- super_admin/eci_admin/board/holder
  holder_id       BIGINT REFERENCES holder(id),        -- nullable; set for role=holder
  password_hash   TEXT,                                -- nullable; magic-link users have null
  totp_secret     TEXT,                                -- nullable; required for admin
  last_login_at   TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE auth_session (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES app_user(id),
  session_token TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

(Auth.js's schema; Drizzle adapter provides this out of the box.)

### 4.3 Key Relationships

```
marina_config 1 ──< slip
slip 1 ──< assignment >── 1 holder ──< vessel
                          1 vessel ──< document
                          1 holder ──< document
                                       (XOR)
fee_schedule 1 ──< scenario
app_user 1 ──< audit_log
holder 1 ── 1 app_user (optional; nullable on non-portal holders)
```

---

## 5. Booking / Availability Model

This is the architectural core. Get it right, the rest follows.

### 5.1 Single Calendar Per Slip

Every slip has one timeline of `assignment` rows. Each row has a `daterange` (start_date → end_date inclusive) and a `lease_type` (`FULL_SEASON`, `HALF_SEASON_1`, `HALF_SEASON_2`, `TRANSIENT`). Half-season dates are not hardcoded — they're whatever the marina config / season metadata says, allowing season dates to vary year to year.

### 5.2 The Hard Constraint

Postgres `EXCLUDE USING gist` over `(slip_id, daterange)` for `status IN ('proposed','confirmed')` rejects any insert/update that would overlap another active assignment on the same slip. This is **database-level** — no app-side race condition can violate it.

```sql
CONSTRAINT no_slip_overlap
  EXCLUDE USING gist (
    slip_id WITH =,
    daterange WITH &&
  ) WHERE (status IN ('proposed','confirmed'))
```

### 5.3 Lease Type Interaction

- A slip with one `FULL_SEASON` assignment for `[Apr 15, Oct 31]` cannot accept any other assignment in that range — the exclusion constraint blocks both half-season and transient overlap.
- A slip with `HALF_SEASON_1 [Apr 15, Jul 15]` has its second half open. The marina can either: (a) create a separate `HALF_SEASON_2 [Jul 16, Oct 31]` assignment, or (b) leave it open for transients.
- Transient availability is computed by *gap analysis* on the calendar: for each slip, find date ranges with no active assignment, intersect with the requested transient dates.

### 5.4 Availability Query

```sql
-- "What slips are open for [date_start, date_end]?"
SELECT s.*
FROM slip s
WHERE s.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM assignment a
    WHERE a.slip_id = s.id
      AND a.status IN ('proposed','confirmed')
      AND a.daterange && daterange($1, $2, '[]')
  );
```

Sub-100ms for 86 slips × ~200 assignments per season.

### 5.5 Conflict Prevention

- App-layer validation happens in the server action before insert (gives a friendly error message).
- DB-layer `EXCLUDE` constraint is the last line of defense — if app-layer logic ever has a bug, the DB still won't double-book.
- All assignment writes happen inside a `BEGIN; ... COMMIT;` transaction that also writes the audit row.

### 5.6 Cancellations / Reassignments

Setting `status = 'canceled'` removes the row from the exclusion constraint's WHERE clause (because the predicate filters by status), freeing the slot. The row stays for history. New assignment can then be created.

---

## 6. Slip-Fit Enforcement

### 6.1 Where the Check Runs

The slip-fit check runs **server-side** in the assignment server action, *before* the DB insert. Three conditions:

```ts
function checkSlipFit(slip, vessel, safetyMargin = 0.5): FitResult {
  const failures = [];
  if (vessel.loa_ft > slip.loa_limit_ft)
    failures.push({ dim: 'LOA', vessel: vessel.loa_ft, limit: slip.loa_limit_ft });
  if (vessel.beam_ft > slip.beam_limit_ft)
    failures.push({ dim: 'Beam', vessel: vessel.beam_ft, limit: slip.beam_limit_ft });
  if (vessel.draft_ft + safetyMargin > slip.min_depth_at_mlw_ft)
    failures.push({ dim: 'Draft', vessel: vessel.draft_ft, limit: slip.min_depth_at_mlw_ft });
  return { fits: failures.length === 0, failures };
}
```

Client also runs this for UX, but the server is authoritative.

### 6.2 Override Workflow

If `fits === false` and the actor's role is `eci_admin` or `super_admin`, the response returns the failures and a special token. The UI surfaces an "Override with justification" button. Resubmission with `override_reason` (≥20 chars) bypasses the check **and** writes:

1. The assignment row with `override_reason` populated.
2. An `audit_log` row with `action='assignment.override'`, `metadata={failures, justification, actor}`.

Roles `board` and `holder` cannot override. The "Slip-fit override report" (FR-3.7.4) is a SQL view over `assignment` filtered to `override_reason IS NOT NULL`, joined to `audit_log` for the justification trail.

### 6.3 Why Not a DB Trigger

Considered. Rejected because:
- Override logic requires user identity and a free-text justification — easier in app code than in PL/pgSQL.
- The server action already writes a transaction; the check fits naturally there.
- DB triggers are harder to debug for the next maintainer.

---

## 7. Pricing Engine

### 7.1 The Resolver

The pricing engine is a **pure function** in `lib/pricing/resolve.ts`:

```ts
function resolveFee(
  holder: Holder,
  slip: Slip,
  leaseType: LeaseType,
  feeSchedule: FeeSchedule,
  season: Season
): { total: number, lineItems: LineItem[] }
```

It is the **only** code path for any fee calculation. The Active engine calls it with `feeSchedule = activeSchedule`. The Scenario Modeler calls it with `feeSchedule = scenario.feeSchedule`. **Same code, different input.** This is the architectural lever.

### 7.2 Fee Schedule Shape

Stored in `fee_schedule.base_config` as JSONB:

```json
{
  "model": "tier_based",  // or "per_foot"
  "base_rates_by_tier": {
    "Premium":   { "annual": 4500 },
    "Standard":  { "annual": 3500 },
    "Restricted":{ "annual": 2800 }
  },
  "holder_multipliers": {
    "resident":           0.75,
    "non_resident_owner": 0.85,
    "non_resident":       1.00
  },
  // PRD 4-state → 3 buckets (locked 2026-05-19):
  //   resident-owner, resident-renter         → resident
  //   non-resident-owner                      → non_resident_owner
  //   non-resident                            → non_resident
  // non_resident_owner discount value is Modeler-driven; board sets via simulation.
  "lease_type_multipliers": {
    "FULL_SEASON":   1.00,
    "HALF_SEASON_1": 0.55,
    "HALF_SEASON_2": 0.55,
    "TRANSIENT":     null   // uses transient_per_foot_per_night instead
  },
  "transient_per_foot_per_night": 4.50,
  "amenity_fee": {
    "annual": 350,
    "waived_for_resident": true
  },
  "buy_in": {
    "amount": 0,
    "applies_to": ["non_resident"]
  },
  "premium_surcharge_uses_slip_fee_modifier": true
}
```

### 7.3 Resolution Algorithm

```
1. If leaseType == TRANSIENT:
     nights = (assignment.end - assignment.start) + 1
     total  = vessel.loa_ft × transient_per_foot_per_night × nights
     return [{base: total}]

2. Else:
     base = base_rates_by_tier[slip.tier].annual
     base *= holder_multipliers[holder.type]
     base *= lease_type_multipliers[leaseType]
     base *= slip.fee_modifier   (if premium_surcharge_uses_slip_fee_modifier)

3. amenity = amenity_fee.annual
     if holder.type == 'resident' and amenity_fee.waived_for_resident: amenity = 0

4. buy_in = first season only and holder.type in buy_in.applies_to ? buy_in.amount : 0

5. total = base + amenity + buy_in
   return [{base}, {amenity}, {buy_in}]
```

Deterministic. Unit-testable. ~30 lines.

### 7.4 Scenario Projection

```ts
function projectScenarioRevenue(scenario, currentAssignments) {
  return currentAssignments.reduce((sum, a) => {
    const { total } = resolveFee(a.holder, a.slip, a.leaseType, scenario.feeSchedule, a.season);
    return sum + total;
  }, 0);
}
```

For 86 assignments this is sub-millisecond. Side-by-side compare and per-holder delta are trivial.

### 7.5 CSV Export to AppFolio

A route handler `/api/exports/appfolio.csv?fee_schedule_id=X` iterates assignments for the active season, calls `resolveFee` per assignment, and writes a CSV with the AppFolio-import schema. (Schema awaiting Q-AF1; column set is configurable in a `lib/appfolio/mapping.ts` module.)

---

## 8. Patron Site Architecture

### 8.1 Single App vs. Split — Single App

**Decision:** one Next.js deployment with public routes ungated and authed routes behind middleware.

**Rationale:**
- Shared design system, shared slip map component, shared branding.
- One deploy pipeline, one DB, one auth system.
- Next.js handles SSG/SSR/RSC mix natively; public pages can be statically generated and revalidated.
- Saves ~$15/mo over a split (Astro on a separate host + Next.js on Vercel).

**Trade-off accepted:** public content changes require an app deploy (~60s). Acceptable for a marina that updates content quarterly at best.

### 8.2 Public Route Strategy

| Route | Strategy | Notes |
|---|---|---|
| `/` | SSG | Marketing copy + hero. |
| `/rules` | SSG | Markdown-sourced (MVP). Phase 1.5 CMS-driven. |
| `/emergency` | SSG | High SEO priority. |
| `/map` | SSR | Renders read-only slip map (no assignments shown). |
| `/contact` | SSG | ECI phone, dockmaster, after-hours. |
| `/faq` | SSG | Markdown. |
| `/transient` | SSR (form) + server action | Public form → POST → DB. |
| `/services` | SSG | Local services directory. |
| `/forms` | SSG | PDF download links. |

### 8.3 SEO

- Next.js App Router metadata API for OpenGraph + Twitter cards.
- Sitemap + robots.txt auto-generated.
- Schema.org `LocalBusiness` + `Marina` JSON-LD on `/`.
- Target: first Google result for "Wharfside Marina rules" within 90 days.

---

## 9. Auth / Roles

### 9.1 Roles

| Role | Who | Access |
|---|---|---|
| `super_admin` | Nick | Everything, including user/role management. |
| `eci_admin` | Kathy + ECI staff | All admin operations except role assignment. |
| `board` | Linda + other officers | Read-only on operational data; full access to Pricing Modeler + reports. |
| `holder` | Slip-owners with portal access | Own holder/vessel/docs + read-only own assignment. |
| `public` | Unauthenticated | Public patron pages + transient request form. |

### 9.2 Permission Matrix (Pillar × Role)

| Pillar | super | eci | board | holder | public |
|---|---|---|---|---|---|
| Marina Config (read) | ✓ | ✓ | ✓ | own slip only | — |
| Marina Config (write) | ✓ | ✓ | — | — | — |
| Holder Mgmt (read) | ✓ | ✓ | ✓ | own only | — |
| Holder Mgmt (write own) | ✓ | ✓ | — | ✓ (contact only) | — |
| Holder Mgmt (write any) | ✓ | ✓ | — | — | — |
| Assignment (read) | ✓ | ✓ | ✓ | own only | — |
| Assignment (write) | ✓ | ✓ | — | — | — |
| Slip-fit override | ✓ | ✓ | — | — | — |
| Document (read) | ✓ | ✓ | ✓ | own only | — |
| Document (upload own) | ✓ | ✓ | — | ✓ | — |
| Document (approve/reject) | ✓ | ✓ | — | — | — |
| Pricing — Active (read) | ✓ | ✓ | ✓ | own line items | — |
| Pricing — Active (write) | ✓ | ✓ | — | — | — |
| Scenario (read) | ✓ | ✓ | ✓ | — | — |
| Scenario (write) | ✓ | ✓ | own only | — | — |
| Scenario state transitions | ✓ | ✓ | — | — | — |
| Patron site (read public) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Patron site (write content) | ✓ | ✓ | — | — | — |
| Transient request (submit) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Transient request (review) | ✓ | ✓ | — | — | — |
| Audit log (read) | ✓ | ✓ | ✓ | — | — |
| User/role mgmt | ✓ | — | — | — | — |

### 9.3 How Holders Get Accounts

**Recommendation:** ECI provisions holder accounts from the admin UI. Workflow:
1. Kathy creates a `holder` row in admin → checks "Send portal invite."
2. System creates an `app_user` row with `role=holder`, `holder_id=X`, no password.
3. Magic-link email sent via Resend with first-login URL valid 7 days.
4. Holder clicks → session cookie set → 30-day session.
5. Subsequent logins: holder enters email → magic-link → session.

**Why not self-signup:** retirement-age user base, low digital literacy, and ECI needs control of who has portal access. Self-signup with email verification is technically easy but operationally messy (who approves? how does ECI know the email matches the slip owner of record?).

**Admin onboarding:** super_admin manually creates `eci_admin` and `board` users. Email/password + TOTP enforced.

---

## 10. AppFolio Integration

### 10.1 MVP — CSV Export

Single endpoint `/api/exports/appfolio.csv` (admin only) that:

1. Loads the Active `fee_schedule`.
2. Iterates all `assignment` rows for the active season.
3. Calls `resolveFee` per assignment.
4. Outputs CSV with columns matching AppFolio's charge-import schema (TBD pending Q-AF1).

Strawman columns:
```
holder_external_id, holder_name, unit_or_slip_id, charge_code,
description, amount, gl_account, charge_date, due_date, season_year
```

The mapping is configurable in `lib/appfolio/mapping.ts` so the schema can shift without code rewrites.

### 10.2 v2 — Live API (Deferred)

AppFolio Stack API integration requires:
1. ECI's commercial cooperation (multi-stage partner certification).
2. Or a third-party wrapper like Skywalk API ($$).
3. OAuth flow + token refresh handling.
4. Idempotent push-charges endpoint.
5. Reconciliation worker (poll AppFolio for paid status).

**Estimated 2-4 months of work.** Deferred to 2028+. The CSV path is durable enough for ~1-2 billing cycles per year.

---

## 11. Infrastructure & Deployment

### 11.1 Hosting

- **Production app:** Vercel (Hobby tier free → Pro $20/mo if needed).
- **Database:** Neon Launch tier ($19/mo) for production; free dev branch for staging.
- **Object storage:** Cloudflare R2 (~$0.50–2/mo for expected volume).
- **Email:** Resend free tier (3K/mo) — sufficient for reminder emails to ~100 holders × 4 cadence points = ~400 emails/year per doc type.

**Total: ~$20–45/mo.** Well within budget.

### 11.2 Domain & SSL

- **Domain:** `wharfsidemarina.com` (new, ~$15/yr) is preferred over a `wharfsidemb.com` subdomain — clearer SEO branding.
- **SSL:** Automatic via Vercel (Let's Encrypt).

### 11.3 Database Backups

- Neon Launch tier includes 7-day point-in-time recovery.
- Weekly logical backup (`pg_dump`) shipped to Cloudflare R2 via Vercel Cron → 4-week retention. Belt and suspenders.
- Quarterly: Nick verifies a restore into a Neon dev branch.

### 11.4 CI/CD

- **GitHub Actions:** on PR, run `pnpm lint && pnpm typecheck && pnpm test`.
- **Vercel:** preview deploy per PR (free with Hobby).
- **Production:** merge to `main` → auto-deploy to Vercel production.
- **Migrations:** Drizzle migrations checked into repo; applied via a `vercel build` hook against the production DB.

### 11.5 Monitoring

- **Sentry** free tier for crash reports (5K events/mo).
- **Vercel Analytics** free tier for basic page traffic.
- **UptimeRobot** free tier for a 5-min ping on the public homepage.
- **No APM** — overkill for this scale.

Alert email goes to Nick. (Phase 1.5: add ECI for ops alerts.)

---

## 12. Security

### 12.1 Auth

- Magic-link tokens are single-use, 15-minute lifetime, hashed in DB (Auth.js default).
- Admin passwords hashed with argon2id (Auth.js default).
- Admin TOTP required (2FA via authenticator app).
- Sessions: HTTP-only, Secure, SameSite=Lax cookies; 30-day rolling expiration.
- Rate-limit: 5 magic-link requests per email per hour; 10 login attempts per IP per 15 min.

### 12.2 PII Handling

- Holder contact info, vessel registration numbers, COI documents are PII.
- Encrypted in transit (TLS 1.3 everywhere).
- Encrypted at rest by Neon (Postgres TDE) and R2 (default AES-256).
- No PII in logs or Sentry — scrub middleware on log writes.
- Holder data export-on-request (CSV button on holder profile).

### 12.3 Document Storage

- All uploads go to R2 via signed PUT URLs (15-min expiry).
- Downloads via signed GET URLs (5-min expiry) — never publicly readable.
- File-type allowlist: PDF, JPG, PNG. Max 25MB.
- Virus scan: defer to Phase 1.5 (ClamAV via a Vercel Edge Function or `attachment-scan` lib). For MVP, accept the risk — uploads are from authenticated holders.

### 12.4 Audit Log Immutability

- App code uses a separate DB role (`audit_writer`) with INSERT-only grant on `audit_log`.
- The application's main DB role has no UPDATE or DELETE on `audit_log`.
- Quarterly: dump audit log to R2 with a hash-chained checksum for tamper-evidence (Phase 1.5).

### 12.5 Common Web Threats

- **CSRF:** Server Actions use Next.js's built-in CSRF tokens.
- **XSS:** React escapes by default; no `dangerouslySetInnerHTML` outside of trusted Markdown-rendered content (rules pages).
- **SQL injection:** Drizzle parameterizes everything; no raw SQL with user input.
- **Rate limiting:** Upstash Rate Limit (free tier) for public endpoints (`/transient` form, magic-link).
- **Dependency scanning:** GitHub Dependabot enabled.

---

## 13. Non-Functional Targets

| Category | Target | Headroom |
|---|---|---|
| Concurrent users (peak) | 10 | 100× via Vercel + Neon |
| Public page load | <2s on 4G | SSG + edge caching gets us ~300ms |
| Admin query | <1s | Indexed Postgres, small dataset |
| Scenario recompute | <1s for 86 slips | Pure-function, sub-ms in practice |
| Document storage | 2GB over 3 years | R2 holds petabytes |
| Database size | <5GB at year 5 | Neon Launch covers 10GB |
| Uptime | 99% | Vercel + Neon SLAs both ≥99.9% |
| Backup RPO | 24h | Neon PITR gives <5min |
| Backup RTO | 24h | Practical restore ~1h |

---

## 14. Architecture Decision Records

### ADR-001: Framework — Next.js 14 App Router

**Context:** Solo developer, multi-year maintenance horizon, need both SEO-friendly public pages and a rich authed app. Nick has React experience.

**Decision:** Next.js 14 with the App Router, TypeScript, Server Components, Server Actions.

**Consequences:**
- (+) Single codebase, single deploy.
- (+) SSG for public pages (SEO + speed).
- (+) Server Actions reduce API boilerplate.
- (+) Largest hireable community for the next maintainer.
- (−) Vercel-coupling, though Next.js can be self-hosted if needed.
- (−) App Router still evolving; minor breaking-change risk on major upgrades.

**Alternatives considered:**
- Remix / React Router v7: similar capability, smaller community.
- Astro: better for the public site but weaker for the authed app.
- SvelteKit: less familiar to Nick; smaller hiring pool.
- Rails: classic boring tech but Nick's JS/TS comfort wins.

---

### ADR-002: Database — Neon Postgres

**Context:** Need relational integrity (slip-fit, exclusion constraints, audit log), modest data volume (<5GB at year 5), low cost, no ops burden.

**Decision:** Neon serverless Postgres on the Launch plan ($19/mo).

**Consequences:**
- (+) Real Postgres — exclusion constraints, JSONB, daterange, btree_gist all available.
- (+) Branching for staging and dev environments.
- (+) Scales to zero between requests (cheap).
- (+) Owned by a major player (Databricks acquisition 2025).
- (−) Cold starts ~500ms after autosuspend; mitigated by always-on connection pool.
- (−) Single-region (US-East) — fine for a NJ marina.

**Alternatives considered:**
- Supabase: bundles auth + storage but adds complexity we don't need.
- Railway Postgres: solid but more expensive and no scale-to-zero.
- PlanetScale: MySQL fork without foreign keys — disqualifying.
- Self-hosted on a VPS: cheaper but maintenance burden.

---

### ADR-003: Public Site — Single Deploy

**Context:** Patron site has both public pages (SEO) and authed pages (holder dashboard). Two deployments would isolate concerns but doubles infra.

**Decision:** Single Next.js app, single deployment. Public routes ungated; `/admin/*` and `/holder/*` behind auth middleware.

**Consequences:**
- (+) Shared components (slip map, branding, layout).
- (+) One auth, one DB, one deploy pipeline.
- (+) Static generation handles public pages with no DB hit.
- (−) Content changes require an app deploy (~60s).
- (−) Single-point-of-failure: if the app is down, the public emergency-info page is down. Mitigated by Vercel SLA and SSG cache.

**Alternatives considered:**
- Astro for public + Next.js for app on different subdomains: cleaner separation but doubles infra and complicates shared components.
- Static-only public site on Cloudflare Pages: cheapest but the slip map and patron forms still need a backend.

---

### ADR-004: AppFolio Integration — CSV Export Only (MVP)

**Context:** AppFolio is the system of record for billing. Live API integration requires partner certification (months) and ongoing maintenance.

**Decision:** CSV export only for MVP. Defer live API to v2 (2028+) or never.

**Consequences:**
- (+) Ships in MVP without external dependency on AppFolio commercial process.
- (+) ECI already imports CSV files monthly — workflow change is small.
- (−) Manual reconciliation step (1-2× per season) is a forever-cost unless v2 ships.
- (−) No automatic paid-status sync; system doesn't know who's paid.

**Alternatives considered:**
- Live AppFolio Stack API in MVP: 2-4 months of additional work, blocks on ECI bureaucratic process, fragile.
- Third-party wrapper (Skywalk): adds vendor + cost + lock-in.
- Pretend AppFolio doesn't exist and build billing here: out of scope (the PRD is explicit).

---

### ADR-005: Booking Calendar — Single Unified `assignment` Table with `daterange` Exclusion Constraint

**Context:** The app must handle full-season, half-season, and transient bookings sharing one calendar per slip. Conflicts must be impossible.

**Decision:** Single `assignment` table with `lease_type` enum and `daterange` column. Postgres `EXCLUDE USING gist` constraint on `(slip_id, daterange)` prevents overlap.

**Consequences:**
- (+) Database-level guarantee against double-booking — no app race condition can violate it.
- (+) Unified availability query: gap analysis over a single date range per slip.
- (+) No artificial distinction between "annual" and "transient" tables — same physics.
- (−) Schema slightly more complex than `season_year` uniqueness alone.
- (−) Requires the `btree_gist` extension (available on Neon).

**Alternatives considered:**
- Separate `annual_assignment` and `transient_assignment` tables: forces app-layer reconciliation, easier to get wrong.
- Day-granular `slip_day` table: 86 slips × 365 days = 31K rows/yr, ugly to query.
- App-layer locking (advisory locks): race conditions still possible under partition.

---

### ADR-006: ORM — Drizzle

**Context:** Need a TypeScript-first ORM with migration support, good SQL fidelity (for the exclusion constraint and JSONB usage), and no heavy runtime.

**Decision:** Drizzle ORM with `drizzle-kit` for migrations.

**Consequences:**
- (+) SQL-like API — easy to read alongside raw SQL.
- (+) TypeScript-native schema definitions.
- (+) Owns migrations, no separate tool needed.
- (+) Supports Postgres exclusion constraints via raw SQL escape hatches.
- (−) Smaller community than Prisma.
- (−) Some advanced features (e.g., relations API) less mature.

**Alternatives considered:**
- Prisma: nicer DX but no support for exclusion constraints + heavier runtime.
- Kysely: query-builder only, no migrations.
- Raw SQL + pg: most flexible, most boilerplate.

---

## 15. Migration / Phasing

### 15.1 Recommendation: Inverted MVP (Aligns with Office Hours)

Office Hours recommends **Pricing Modeler + Patron Site first**, slip ops + docs second. We agree, with one nuance: the data model must support slip ops from day one (versioned config, slip table, assignment table) because the Pricing Modeler needs slip metadata and current assignments to project revenue.

**Practical sequencing:**

| Phase | Scope | Effort (hours) | Target |
|---|---|---|---|
| **0 — Foundation** | Project setup, auth, DB schema (all tables), seed data, deploy pipeline | 30–40 | June 2026 |
| **1a — Patron Site MVP** | Public pages, slip map (read-only), transient form → DB, magic-link auth shell | 30–40 | August 2026 |
| **1b — Pricing Modeler** | Active fee schedule, scenario CRUD, resolver, projection, side-by-side compare, PDF export, state machine | 50–70 | November 2026 |
| **2a — Slip Ops** | Marina config admin (visual map editor), holder/vessel CRUD, assignment workflow, slip-fit + override, dockmaster mobile view | 50–70 | February 2027 |
| **2b — Doc Collection** | Holder portal, doc upload to R2, review queue, compliance dashboard, reminder cron | 30–40 | March 2027 |
| **3 — Polish + Launch** | Reports, CSV export to AppFolio, accessibility audit, holder onboarding emails | 20–30 | April 2027 |
| | **Total MVP** | **210–290** | **April 2027** |

The Pricing Modeler in 1b uses **mock assignment data** seeded from current AppFolio export. Real assignments arrive in 2a. This lets Linda use the modeler for the 2027 rate-card decision in Q4 2026 — before slip ops is shipped.

### 15.2 Why Not Just Pricing + Patron (No Slip Ops)?

We could ship only Phases 0, 1a, 1b and stop. **If Q-G4 (ECI adoption) had failed, that would be the right call.** Since Kathy has confirmed she wants the build, Phase 2 is no longer conditional — but the phasing still lets us validate the modeler with Linda before investing in slip ops.

### 15.3 Phase 1.5 (Late 2027 — Optional Hardening)

- COI parsing (OCR + LLM extract)
- Waitlist management
- Patron site content CMS (no-code editing for ECI)
- Bulk season-end ZIP export
- Virus scanning on uploads
- Audit log hash-chain

### 15.4 Phase 2 (2028+ — Defer Indefinitely)

- AppFolio Stack API live integration
- Per-foot pricing variant
- Native mobile app

---

## 16. Architecture-Specific Risks

### 16.1 AppFolio API Blocker

If/when Phase 2 attempts live integration, ECI must sponsor the partner certification — a months-long bureaucratic process. **Mitigation:** keep the CSV path durable forever; never make the app depend on AppFolio at runtime.

### 16.2 Restoration Timing Shifts Slip Layout Mid-Build

The marina restoration may complete after MVP build starts, and the post-restoration layout may differ from the current spec. **Mitigation:** versioned `marina_config` from day one. A new config version is a 30-minute admin task (clone prior, edit, activate). No code changes needed.

### 16.3 Bus Factor — Nick Rolls Off the Board

If Nick is unavailable post-launch, the system needs to survive without him. **Mitigations:**
- Stack chosen for hireability (Next.js + Postgres + Vercel).
- All managed services (Vercel, Neon, R2, Resend) — no servers to babysit.
- Documented runbooks for: rotating secrets, restoring backups, onboarding a new admin user, exporting all data.
- Stitched-fallback documented: if the system breaks and no one can fix it, the data exports cleanly to CSV + R2 ZIP, and operations revert to email + AppFolio.

### 16.4 Exclusion Constraint Coupling

The booking model relies on Postgres `EXCLUDE USING gist`. Migration to another database engine would break this. **Mitigation:** Postgres is dominant and Neon is well-funded; this is a low-likelihood risk. If a migration is ever needed, the app-layer check is still in place as a fallback.

### 16.5 Vercel/Neon Vendor Concentration

Both are well-funded but neither is FAANG. **Mitigation:** Next.js can self-host on Node.js anywhere; Postgres is portable to any Postgres provider; R2 is S3-compatible. No proprietary services beyond Auth.js itself, which is open-source.

### 16.6 Scenario Modeler JSONB Schema Drift

`fee_schedule.base_config` is a JSONB blob. If the rate model evolves (per-foot variant, new fee components), older scenarios may not resolve correctly. **Mitigation:** include a `schema_version` field in the JSONB; the resolver dispatches on it. Maintain a small number of versions; archive old scenarios periodically.

### 16.7 Holder Portal Adoption Risk

Office Hours flagged retirement-age users may prefer email over a portal. **Mitigation:** admin-side workflows do not depend on holder portal usage. If a holder never logs in, Kathy uploads their documents on their behalf. The portal is a convenience, not a requirement.

---

## 17. Out of Scope (Architectural)

- Microservices, message queues, event sourcing — none justified at this scale.
- Real-time / WebSocket features — no live multi-user editing requirement.
- Native mobile apps — web-responsive is sufficient.
- ML / AI features beyond optional Phase 1.5 OCR.
- Multi-tenancy — one marina, one customer.
- Internationalization — single language (English), single region (NJ).
- Payments — AppFolio owns this.

---

## 18. Glossary

| Term | Definition |
|---|---|
| **Holder** | Person who leases a slip (resident or non-resident). |
| **Lease type** | FULL_SEASON, HALF_SEASON_1, HALF_SEASON_2, or TRANSIENT. |
| **Slip-fit** | Compatibility check: LOA, beam, draft+margin vs. slip dimensions. |
| **Active fee schedule** | The one schedule with `state='active'` — drives billing. |
| **Scenario** | A draft fee schedule + cached projection used for what-if modeling. |
| **Marina config** | A versioned snapshot of the slip inventory (pre/post-restoration). |
| **Assignment** | A slip × holder × vessel × date-range row. The booking. |
| **MLW** | Mean Low Water — reference depth datum. |
| **COI** | Certificate of Insurance. |
| **AppFolio** | ECI's property-management platform; system of record for billing. |

---

*End of architecture spec v1.0. Next step: Nick reviews; iteration to v1.1 after open questions answered (Q-AF1 AppFolio schema, Q-OWN1 resident definition).*
