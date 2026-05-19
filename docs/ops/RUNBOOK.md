# Wharfside Marina — Operations Runbook

**Audience:** Nick (solo dev / on-call) — and, eventually, ECI ops.
**Scope:** Production deployment, database operations, monitoring, incidents, maintenance, cost.
**Stack assumed:** Next.js 14 on Vercel, Neon Postgres (Launch tier), Cloudflare R2, Resend, Sentry, Auth.js v5.
**Status:** v0.1 — pre-launch. Update as procedures get exercised in anger.

---

## 0. TL;DR / Quick Reference

| Symptom | Skip to |
|---|---|
| Need to ship a code change | [§1 Deployment](#1-deployment) |
| App is down / 5xx spike | [§3 Monitoring & Alerting](#3-monitoring--alerting) → [§4.4 Incident: 5xx](#44-p1--emails-not-sending-or-5xx-rate-elevated) |
| Pricing looks wrong | [§4.1 P0 — Pricing wrong](#41-p0--pricing-wrong) |
| Double-booking reported | [§4.2 P0 — Double booking](#42-p0--double-booking-occurred) |
| Can't log in | [§4.3 P0 — Auth broken](#43-p0--auth-broken) |
| Emails not sending | [§4.4 P1 — Emails not sending](#44-p1--emails-not-sending-or-5xx-rate-elevated) |
| Document upload failing | [§4.5 P1 — Doc upload failing](#45-p1--doc-upload-failing--r2-credential-rotation) |
| Restore the DB | [§2.3 Restore procedure](#23-restore-procedure) |
| Rotate secrets | [§5.4 Annual rotations](#54-annual) |

---

## 1. Deployment

### 1.1 Branch & deploy strategy

- `main` branch is the production source. **Every push to `main` triggers a Vercel production deploy.**
- All other branches → Vercel preview deploys (one per PR).
- `staging` branch (optional) → deploys to staging.wharfsidemarina.com against the Neon `staging` branch DB.

### 1.2 Pre-deploy checklist

Run all of the following from your local clone of the feature branch **before** merging to `main`:

```bash
pnpm install            # install deps (no-op if up to date)
pnpm lint               # ESLint clean
pnpm typecheck          # tsc --noEmit clean
pnpm test               # all unit tests green
pnpm test:e2e           # Playwright e2e green (or document why skipped)
pnpm db:generate        # generates a migration if schema changed (no-op otherwise)
```

If `pnpm db:generate` produces a new file in `drizzle/`, **review it** before committing. Check:
- No accidental column drops.
- No `DROP TABLE`.
- Any `ALTER COLUMN ... TYPE` with data loss potential gets a hand-written safe migration instead.

### 1.3 Apply migrations to staging first

Always apply migrations to the staging Neon branch **before** deploying the corresponding code change to production.

```bash
# Point your shell at the staging DB
export DATABASE_URL="$(vercel env pull --environment=preview --yes -o /dev/stdout | grep DATABASE_URL | cut -d= -f2-)"
# Or just grab it from the Vercel dashboard → Settings → Environment Variables → Preview

pnpm db:migrate
```

Smoke-test the preview deploy against the staging DB. If green:

### 1.4 Deploy to production

```bash
git checkout main
git pull
git merge --no-ff feature/your-branch
git push origin main
```

Vercel detects the push, builds, and deploys. Migrations run automatically as part of the Vercel build hook (`vercel-build` script in `package.json`) **only if** the `db:migrate` step is wired into that hook — currently it is not. **Until then, run migrations manually before pushing:**

```bash
# Run against PRODUCTION DB. Do this BEFORE merging to main.
export DATABASE_URL="<production DATABASE_URL from Vercel env panel>"
pnpm db:migrate
```

> **TODO (pre-launch):** Wire `pnpm db:migrate` into the `vercel-build` script so migrations apply atomically with the deploy. See §6.1.

### 1.5 Post-deploy verification

After Vercel reports "Ready":

```bash
curl -fsS https://wharfsidemarina.com/api/health | jq .
```

Expect: `{"ok": true, "db": "ok", "r2": "ok", "version": "<git-sha>"}`. If not, [§1.6 Rollback](#16-rollback-procedure).

Then click through:
- `/` (public homepage) — loads, no console errors.
- `/admin/dashboard` — renders, shows current season metrics.
- `/holder/dashboard` after magic-link login.
- One `/admin/slip/B12` detail page — confirms slip + assignments + docs render.

### 1.6 Rollback procedure

**Code-only regression (no migration shipped):**

```bash
# In the Vercel dashboard, find the previous deployment, click "..." → "Promote to Production".
# This is an INSTANT swap — no build needed.
```

**Code regression that requires reverting a migration:**

Vercel rollback restores the code, but **does NOT roll back the DB**. If the migration is backwards-compatible (the previous code version still works against the new schema), do nothing. If it's not, you need a forward-fix:

1. Roll the code back via Vercel.
2. Write a new "fix-up" migration that reverts the schema change (manually — Drizzle does not auto-generate down migrations).
3. Apply: `pnpm db:migrate`.
4. Verify with `/api/health`.

**Never** delete a Drizzle migration file once it has been applied to production. Add a new "fix-up" migration instead.

### 1.7 Environment variables

The source of truth for env var names is `.env.example` (committed to repo, no values). Production values live in:

- **Vercel** — Settings → Environment Variables. Three scopes: Production, Preview, Development.
- **Local dev** — `.env.local` (gitignored).

Required for production (verify all are set before launch):

```
DATABASE_URL=postgresql://...?sslmode=require       # Neon pooler URL
DATABASE_URL_UNPOOLED=postgresql://...?sslmode=require  # Neon direct, for migrations
AUTH_SECRET=                                         # `openssl rand -base64 32`
AUTH_URL=https://wharfsidemarina.com
RESEND_API_KEY=re_...
EMAIL_FROM="Wharfside Marina <no-reply@wharfsidemb.com>"
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=wharfside-marina-docs
R2_PUBLIC_URL=
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=https://wharfsidemarina.com
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

When adding a new env var:
1. Add the placeholder line to `.env.example` (with comment explaining what it does).
2. Add it to Vercel for **all three** scopes.
3. Pull it locally: `vercel env pull .env.local`.

---

## 2. Database

Neon Postgres on the Launch tier ($19/mo). Single region (US-East). Pooled and direct connection strings — `DATABASE_URL` (pooled) for the app, `DATABASE_URL_UNPOOLED` (direct) for migrations and long-running scripts.

### 2.1 Connection pooling

- **Use `DATABASE_URL` (pooled, `-pooler` in hostname) for:** Next.js Server Actions, Route Handlers, any short-lived request. PgBouncer-style pooling. Sessionless.
- **Use `DATABASE_URL_UNPOOLED` (direct) for:** Drizzle migrations, `drizzle-kit studio`, the seed script, any script that uses `LISTEN`/`NOTIFY` or prepared statements.

Why: PgBouncer in transaction-pooling mode does not support prepared statements; Drizzle uses them by default for safety, and migrations definitely need them.

### 2.2 Backups

**Point-in-time recovery (PITR):**
- Neon Launch tier includes **7 days of PITR** (verified 2026-05-19 — Neon docs at https://neon.com/docs/manage/backups).
- Granularity: LSN-level — restore to any second within the window.
- No action required to enable; it's on by default. Confirm in the Neon console under Settings → Storage → History retention.

**Belt-and-suspenders logical backups (weekly):**
- A Vercel Cron job at `0 6 * * 0` (Sundays 06:00 UTC) hits `/api/cron/backup` which runs `pg_dump` and ships the file to R2 (`r2://wharfside-marina-backups/weekly/<YYYY-MM-DD>.dump`).
- Retention: 4 weeks (cron rotates oldest).
- Verify the cron ran: Vercel dashboard → Crons → backup → last run timestamp.

**Manual on-demand backup:**

```bash
# Direct (unpooled) connection required for pg_dump
export DATABASE_URL_UNPOOLED="postgresql://...-pooler.neon.tech... → swap host to the direct hostname"

pg_dump \
  --dbname="$DATABASE_URL_UNPOOLED" \
  --format=custom \
  --no-owner --no-acl \
  --file="wharfside-$(date +%Y-%m-%d-%H%M).dump"

# Ship to R2
aws s3 cp --endpoint-url=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com \
  wharfside-$(date +%Y-%m-%d-%H%M).dump \
  s3://wharfside-marina-backups/manual/
```

### 2.3 Restore procedure

**Scenario A — PITR (recommended for "oops, I just deleted X"):**

1. Open Neon console → Branches → click `main` → "Restore".
2. Pick a target timestamp (down to the second, within the 7-day window).
3. Restore creates a **new branch** at that point in time. **It does NOT overwrite `main`.**
4. Connect to the new branch via its connection string, verify the data is what you want.
5. To promote it: either point the app at the new branch (rename in console + update Vercel env vars), OR `pg_dump` from the restored branch and `pg_restore` over `main`.

**Scenario B — from a `pg_dump` file (used for >7-day-old data or full DR):**

```bash
# Download the dump
aws s3 cp --endpoint-url=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com \
  s3://wharfside-marina-backups/weekly/2026-05-12.dump ./

# Create a fresh Neon branch named "restore-test" in the console.
# Grab its DIRECT (unpooled) URL.
export RESTORE_URL="postgresql://...restore-test...neon.tech/..."

pg_restore \
  --dbname="$RESTORE_URL" \
  --no-owner --no-acl \
  --clean --if-exists \
  --verbose \
  2026-05-12.dump
```

Smoke-test against `restore-test` before promoting it to `main`.

### 2.4 Migrations

- All migrations live in `drizzle/`. Generated by `pnpm db:generate` from `src/db/schema.ts`.
- Apply with `pnpm db:migrate` (which calls `drizzle-kit migrate` under the hood).
- **One migration that is NOT auto-generated:** `drizzle/0001_exclude_constraint.sql` — adds `btree_gist` + the `no_slip_overlap` EXCLUDE constraint. Drizzle's DSL can't express this. **If you ever wipe and recreate the DB, this file must run.**

**`db:push` vs `db:migrate`:**
- `db:push` — applies schema directly without generating a migration file. **Local dev only.** Loses history.
- `db:migrate` — applies committed migrations. **Always use in CI / production.**

**Writing down-migrations:**

Drizzle does not auto-generate down migrations. If a forward migration is risky, write the down by hand in a sibling `.down.sql` file (not applied by Drizzle, but kept for documentation + manual rollback).

Example:

```sql
-- drizzle/0007_add_holder_tags.sql
ALTER TABLE holder ADD COLUMN tags TEXT[];

-- drizzle/0007_add_holder_tags.down.sql  (hand-written, NOT applied automatically)
ALTER TABLE holder DROP COLUMN tags;
```

**Forward-fix when a migration goes wrong:**

Roll the code back via Vercel rollback. Then write a new "fix-up" migration that reverts the bad change. Apply it. **Never delete the original migration file** — it's part of the applied history.

### 2.5 Seed (dev only)

The dev seed populates a fresh DB with 86 slips, 50 holders, 30 vessels, ~95 assignments, 5 fee schedules, etc.

```bash
# Against a fresh dev DB (or a Neon dev branch)
export DATABASE_URL="<dev URL>"
pnpm db:migrate              # ensure schema + btree_gist constraint are present
pnpm db:seed                 # interactive — prompts before truncating
# or
SEED_FORCE=1 pnpm db:seed    # skip prompt
```

**Never run the seed against production.** It begins by truncating every table.

---

## 3. Monitoring & Alerting

### 3.1 Sentry

- Free tier — 5K events/mo. Project: `wharfside-marina` (Next.js).
- DSN lives in `SENTRY_DSN` env var.
- Configured via `sentry.{client,server,edge}.config.ts` at repo root.
- Source maps uploaded at build time via the Sentry webpack plugin.

**Critical issue alerts (configure in Sentry → Alerts):**

| Alert name | Trigger | Action |
|---|---|---|
| New issue in production | First occurrence of any new issue tagged `env:production` | Email Nick |
| 5xx response rate elevated | `>1% of requests are 5xx over a 5-min window` | Email + SMS Nick (Phase 1.5: ECI) |
| DB connection errors | `Error message contains "ECONNREFUSED" OR "connection terminated"` | Email Nick |

### 3.2 Cron / job health

Vercel Cron jobs:

| Cron | Schedule (UTC) | Purpose |
|---|---|---|
| `/api/cron/doc-expiration` | `0 7 * * *` (daily 07:00) | Send T-60/T-30/T-7/T-0 reminder emails. |
| `/api/cron/backup` | `0 6 * * 0` (Sunday 06:00) | Weekly logical backup to R2. |
| `/api/cron/transient-eligibility` | `30 6 * * *` (daily 06:30) | Recompute "open to transient" candidates. |

**Each cron writes a row to a `cron_run_log` table on success.** The QA strategy specifically flagged "silent reminder failure" as a risk — the alerts below close that gap.

**Cron health alerts (Sentry or UptimeRobot):**

| Alert | Trigger | Action |
|---|---|---|
| Doc-expiration cron didn't run today | `cron_run_log` has no row with `job_name='doc-expiration'` and `created_at > NOW() - INTERVAL '26 hours'` | Email Nick |
| Backup cron didn't run this week | Same check, 8-day window | Email Nick |
| Cron job threw an exception | Sentry captures the throw | Email Nick |

> **TODO (pre-launch):** Implement the `cron_run_log` table + insert at the top of every cron handler. Without this, silent failures are invisible.

### 3.3 Uptime

UptimeRobot free tier — 5-minute ping on `https://wharfsidemarina.com/api/health`. Alerts to email when status != 200 for 2 consecutive checks.

### 3.4 Email deliverability

Resend dashboard → Logs → check daily sample of:
- Outgoing volume (should track holder activity — sudden 10× spike is suspicious).
- Bounce rate (target < 2%).
- Spam complaints (target = 0).

**Critical alert:**

| Alert | Trigger | Action |
|---|---|---|
| Email send failure rate >5% | `(failed_sends / total_sends) > 0.05` over rolling 30-min window | Email Nick (alternate channel — SMS or DM) |

Implement by writing every Resend send result to a `email_log` table and running a Vercel cron `0,30 * * * *` that computes the ratio and alerts via Sentry if exceeded.

### 3.5 Daily / weekly ritual (Nick, 5 min/day)

**Daily (M-F):**
- Open Sentry → Issues → filter "Last 24h" → triage anything new.
- Open Vercel → check the deploy log color is green.
- Open Resend → eyeball the bounce/complaint counts.

**Weekly (Monday morning, 15 min):**
- Audit log spot-check: `SELECT action, COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY 1 ORDER BY 2 DESC;`
- Look at the cron_run_log table — every cron should have ~7 rows for the daily ones, 1 row for weekly.
- Review the Neon dashboard — connection count, slow queries.

---

## 4. Incident Playbook

### 4.1 P0 — Pricing wrong

**Symptom:** A holder or board officer reports their displayed fee is incorrect for the active season. Or: the AppFolio CSV export shows numbers that don't match expected.

**Triage steps:**

1. **Reproduce.** Open the affected holder's record. Recompute their fee in the admin UI. Note: exact components shown (base, multipliers, amenity, total).
2. **Identify the active schedule.**
   ```sql
   SELECT id, name, state, activated_at, base_config
   FROM fee_schedule
   WHERE state = 'active';
   ```
   There MUST be exactly one row. If zero or more than one, [§4.1.a](#41a-no-active-or-multiple-active-fee-schedules) below.
3. **Check the audit log for recent schedule changes.**
   ```sql
   SELECT actor_id, action, entity_id, metadata, created_at
   FROM audit_log
   WHERE entity_type = 'fee_schedule'
     AND created_at > NOW() - INTERVAL '14 days'
   ORDER BY created_at DESC;
   ```
   Look for unexpected `fee_schedule.activate` or `fee_schedule.update` events.
4. **Roll back to the previous schedule** (if a bad activation happened):
   ```sql
   BEGIN;
   -- 1. Demote the currently active schedule
   UPDATE fee_schedule SET state = 'approved', activated_at = NULL
   WHERE state = 'active';
   -- 2. Re-activate the prior schedule (by id from step 3 above)
   UPDATE fee_schedule SET state = 'active', activated_at = NOW()
   WHERE id = <previous_active_id>;
   -- 3. Confirm exactly one active
   SELECT COUNT(*) FROM fee_schedule WHERE state = 'active';  -- must = 1
   COMMIT;
   ```
   The `one_active_schedule` UNIQUE INDEX will reject this if you'd end up with two actives — that's a feature.
5. **Re-export the AppFolio CSV** and ship the corrected one to ECI.
6. **Write the postmortem** in `docs/incidents/<date>-pricing.md`. Include: actor, what changed, why the test didn't catch it.

#### 4.1.a No active or multiple active fee schedules

This shouldn't be possible given the `one_active_schedule` UNIQUE INDEX, but if it happens:

- **Zero active:** Find the most recent `approved` schedule (or, if none, the most recent `archived`) and activate it via the SQL in step 4 above.
- **Multiple active:** The UNIQUE INDEX prevents this at write time. If you see it, the constraint has been dropped — `\d fee_schedule` to verify. Reapply via SQL from the migration file.

### 4.2 P0 — Double-booking occurred

**Symptom:** Two holders show up at the same slip on the same date, OR an admin reports two active assignments overlap.

This **should not be possible** thanks to the `no_slip_overlap` EXCLUDE constraint. If it has happened, the constraint is missing or disabled.

**Triage:**

1. **Verify the constraint exists:**
   ```sql
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conname = 'no_slip_overlap';
   ```
   Expected output: an `EXCLUDE USING gist (slip_id WITH =, daterange WITH &&) WHERE (status IN ('proposed','confirmed'))` row. If empty, the constraint is GONE. [Restore from migration §2.4](#24-migrations) and re-apply.
2. **Find the conflicting assignments:**
   ```sql
   SELECT a1.id AS a1_id, a2.id AS a2_id, a1.slip_id, a1.daterange, a2.daterange,
          a1.holder_id AS h1, a2.holder_id AS h2, a1.status AS s1, a2.status AS s2
   FROM assignment a1
   JOIN assignment a2 ON a1.slip_id = a2.slip_id
                      AND a1.id < a2.id
                      AND a1.daterange && a2.daterange
   WHERE a1.status IN ('proposed','confirmed')
     AND a2.status IN ('proposed','confirmed');
   ```
3. **Talk to both holders.** Decide which assignment stands. Mark the other `canceled`:
   ```sql
   BEGIN;
   UPDATE assignment SET status = 'canceled', updated_at = NOW()
   WHERE id = <losing_id>;
   INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata)
   VALUES (<your_user_id>, 'assignment.cancel', 'assignment', <losing_id>,
           jsonb_build_object('reason', 'double-booking manual recovery', 'incident_date', NOW()));
   COMMIT;
   ```
4. **Re-establish the constraint** if it was missing. Run `pnpm db:migrate` against production.
5. **Write the postmortem.** The root cause is almost certainly: someone ran a SQL `ALTER TABLE ... DROP CONSTRAINT no_slip_overlap` directly. Add it to the pre-season tripwire test ([§5.5](#55-pre-season-launch)).

### 4.3 P0 — Auth broken

**Symptom:** Nobody can log in. Magic-link emails arrive but clicking the link returns an error. Or admin password login throws 500.

**Triage:**

1. **Check `/api/health`.** If it returns `db: "fail"`, this is really a DB outage — go to [§4.6](#46-p0--neon-db-outage).
2. **Check Sentry for recent NextAuth errors.** Most common: `AUTH_SECRET` rotated but old sessions still presenting old-signed cookies. Symptom: all logins fail with `JWEDecryptionFailed`.
3. **If AUTH_SECRET was rotated:**
   - Old sessions are invalid. Users must log in fresh. Send an "all-hands re-login required" email.
   - Verify the new secret is in the Vercel env panel under Production AND that the deploy reflecting it has shipped.
4. **Admin manual override (last resort):** If admins are locked out and you can't fix auth fast, you can issue a manual session cookie:
   - SSH into your Mac, with the production `DATABASE_URL` exported:
     ```bash
     pnpm tsx scripts/admin-issue-session.ts --email=kathy@eci-mgmt.example.com --ttl=3600
     ```
     This (when implemented) writes an `auth_session` row directly, prints the session token to your terminal, and you hand-deliver it via Signal / phone. The admin pastes it into a browser cookie.
   - **TODO (pre-launch):** Build `scripts/admin-issue-session.ts`. Until built, manual workaround:
     ```sql
     INSERT INTO auth_session (user_id, session_token, expires_at)
     VALUES (
       (SELECT id FROM app_user WHERE email = 'kathy@eci-mgmt.example.com'),
       encode(gen_random_bytes(32), 'hex'),
       NOW() + INTERVAL '1 hour'
     )
     RETURNING session_token;
     ```
     Then have them set `authjs.session-token=<value>` as a cookie on `wharfsidemarina.com`.

### 4.4 P1 — Emails not sending (or 5xx rate elevated)

**Symptom:** Holders report not receiving doc-expiration reminders; or Resend dashboard shows send failures climbing.

**Triage:**

1. **Resend dashboard → Logs.** Filter to the last hour. Look for failed sends — they include the error reason.
2. **Common causes:**
   - **API key rotated/invalid:** error is `401 Unauthorized`. Fix: regenerate in Resend, update `RESEND_API_KEY` in Vercel env, redeploy (env changes don't apply until redeploy).
   - **Domain unverified:** error is `403 Domain not verified`. The `wharfsidemb.com` DKIM/SPF record was removed. Re-add via Resend → Domains → DNS records.
   - **Rate limit:** error is `429 Too Many Requests`. Free tier is 3K/mo, 100/day burst. If you're hitting it, time to upgrade.
3. **Retry queue:** If you have a `email_outbox` table and a retry cron, failed sends should retry automatically. Inspect:
   ```sql
   SELECT id, recipient, subject, last_error, retry_count, next_retry_at
   FROM email_outbox
   WHERE sent_at IS NULL
   ORDER BY created_at DESC
   LIMIT 50;
   ```
4. **Communicate.** If reminders failed for >24h, post a status note on `/admin/dashboard` (or send a manual catch-up email) so holders know.

For elevated 5xx rates: Sentry → group by error fingerprint → look at the top stack trace. Usually a recently-shipped change. Vercel rollback ([§1.6](#16-rollback-procedure)) if it correlates with a recent deploy.

### 4.5 P1 — Doc upload failing / R2 credential rotation

**Symptom:** Holders report PDF/JPG uploads spinning forever or returning a 4xx/5xx.

**Triage:**

1. **Check Sentry for `R2_*` errors.** Common: `AccessDenied`, `InvalidAccessKeyId`, `SignatureDoesNotMatch`.
2. **Verify the bucket exists and is reachable:**
   ```bash
   aws s3 ls --endpoint-url=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com s3://wharfside-marina-docs/
   ```
3. **R2 credential rotation procedure** (also for [§5.4](#54-annual) annual rotation):
   1. Cloudflare dashboard → R2 → Manage API Tokens → "Create API Token".
   2. Scope: Object Read + Write on `wharfside-marina-docs` bucket only.
   3. Save the new `Access Key ID` + `Secret Access Key`.
   4. **In Vercel:** update `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (Production + Preview + Development).
   5. Trigger a redeploy (env changes are not live until redeploy): `vercel --prod` from the repo root, or push a no-op commit.
   6. Verify: have a holder (or yourself) upload a test doc through the UI.
   7. **Revoke the OLD credentials** in Cloudflare. (Don't leave them active.)

### 4.6 P0 — Neon DB outage

**Symptom:** `/api/health` returns `db: "fail"`. Sentry flooded with `ECONNREFUSED` or `connection terminated`.

**Triage:**

1. **Check Neon status page:** https://neonstatus.com. If they're red, you wait. Post a `/maintenance` banner.
2. **Check your compute is not suspended-and-failing-to-resume.** Neon scale-to-zero takes ~500ms to wake. If it never wakes, Neon console → Compute → Restart.
3. **Connection count exhausted?** Free + Launch tiers cap concurrent connections. Use the **pooled** URL in the app (`-pooler` hostname). If your app is hitting the pool limit, the symptom is `remaining connection slots are reserved` — check the Neon dashboard.
4. **Real outage of >30min**: consider failing over to a `pg_dump` restore on a fresh Neon project, but this is a 1-hour RTO operation. Coordinate with ECI.

---

## 5. Maintenance

### 5.1 Quarterly

- **Verify cron jobs are actually firing.** Query `cron_run_log` for each cron and confirm the last 90 days have ~daily / weekly rows as expected. The QA strategy flagged silent failure of the doc-expiration reminder — this is the check.
  ```sql
  SELECT job_name, DATE_TRUNC('day', created_at) AS day, COUNT(*) AS runs
  FROM cron_run_log
  WHERE created_at > NOW() - INTERVAL '90 days'
  GROUP BY 1, 2
  ORDER BY 1, 2;
  ```
- **Review audit log for anomalies:**
  ```sql
  -- Off-hours admin actions (overnight changes are unusual)
  SELECT actor_id, action, entity_type, created_at
  FROM audit_log
  WHERE created_at > NOW() - INTERVAL '90 days'
    AND EXTRACT(hour FROM created_at AT TIME ZONE 'America/New_York') NOT BETWEEN 7 AND 22;

  -- Slip-fit overrides — every one should be justified
  SELECT a.id, a.slip_id, a.override_reason, al.metadata
  FROM assignment a
  LEFT JOIN audit_log al ON al.entity_id = a.id AND al.action = 'assignment.override'
  WHERE a.override_reason IS NOT NULL
    AND a.created_at > NOW() - INTERVAL '90 days';
  ```
- **PITR restore drill.** Pick a moment from 3 days ago, restore to a Neon dev branch, smoke-test. Document any surprises.

### 5.2 Annual

- **Rotate `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`** — procedure in [§4.5](#45-p1--doc-upload-failing--r2-credential-rotation).
- **Rotate `AUTH_SECRET`** — generate a new one (`openssl rand -base64 32`), update in Vercel, redeploy. **Tell users in advance** — all sessions invalidate at deploy.
- **Rotate `RESEND_API_KEY`** — regenerate in Resend, update in Vercel, redeploy, revoke old key.

### 5.3 Pre-season (annually, mid-March before April 15 season-open)

**Tripwire test — verify the EXCLUDE constraint is still in effect:**

```bash
pnpm tsx scripts/tripwire-exclude.ts
```

Script attempts to INSERT two overlapping assignments on the same slip. Expects the second INSERT to fail with a constraint violation. If it succeeds, **PRODUCTION CAN DOUBLE-BOOK** — stop and fix before season opens.

> **TODO (pre-launch):** Write `scripts/tripwire-exclude.ts`. Until written, run the test manually:
> ```sql
> -- In a Neon dev branch:
> INSERT INTO assignment (slip_id, lease_type, start_date, end_date, season_year, status)
> VALUES (1, 'FULL_SEASON', '2026-04-15', '2026-10-31', 2026, 'confirmed');
> -- Now repeat — this MUST fail with "conflicting key value violates exclusion constraint"
> INSERT INTO assignment (slip_id, lease_type, start_date, end_date, season_year, status)
> VALUES (1, 'TRANSIENT',  '2026-06-01', '2026-06-05', 2026, 'confirmed');
> -- Roll back the test
> ROLLBACK;
> ```

Other pre-season checks:
- Verify the active marina_config covers the upcoming season.
- Verify the active fee_schedule's `effective_start` matches the season start.
- Run the doc-expiration cron once manually to flush any stale expired docs into the dashboard.
- Smoke-test the public `/transient` form (it gets dormant in winter).

### 5.4 Annual: doc cleanup

After each season ends (Nov 1):

- Documents older than 7 years past expiration get archived to R2 cold storage (`r2://wharfside-marina-docs-archive/`) and the row marked `status='archived'`.
- Inactive holders with no assignments in the past 3 seasons can be soft-deleted (`status='inactive'`, retain history).

---

## 6. Cost Watch

Monthly review on the 1st of each month. Open each vendor's billing page, screenshot to `~/Workspaces/wharfside-marina-ops/billing/<YYYY-MM>.png`.

| Vendor | Plan | Monthly target | Upgrade trigger |
|---|---|---|---|
| Vercel | Hobby (free) | $0 | Bandwidth > 100 GB/mo, OR cron jobs > free limit, OR commercial use requires Pro $20/mo |
| Neon | Launch | $19 | DB size > 10 GB, OR compute > included hours, OR need >7-day PITR (then Scale $69/mo) |
| Cloudflare R2 | Pay-as-you-go | <$2 | Storage > 50 GB or egress > 10M reqs/mo |
| Resend | Free | $0 | >3K emails/mo (then $20/mo for 50K) |
| Sentry | Developer (free) | $0 | >5K errors/mo |
| UptimeRobot | Free | $0 | Need <5-min intervals or SMS |
| **Total** | | **~$21** | |

**Expected first-year growth:** stays under $30/mo unless email volume spikes. Doc-expiration reminders are bounded at ~400/year. Holder logins are ~1 magic link / week / holder = 200/mo at full saturation.

---

## 7. On-Call

**Solo dev — no formal rotation.** Document:

| Severity | Expected response | What "response" means |
|---|---|---|
| P0 (down, double-book, pricing wrong, auth broken) | 24h | First Sentry/Slack ack within 24h of alert. Mitigation underway. |
| P1 (email failures, doc upload broken, single-user issue) | 1 week | Acknowledged + scheduled fix. |
| P2 (paper-cut UX) | Next sprint | Logged in GitHub issues. |

**Handoff plan (when Nick goes on vacation > 7 days):**

- ECI (Kathy) gets a temporary `super_admin` role for the duration. Document the role change in `audit_log`.
- A trusted dev (TBD) gets repo + Vercel + Neon read-only access via the "Collaborator" Vercel feature.
- Set up Sentry → SMS for Nick's backup contact.

---

## 8. Open TODOs Tracked in This Runbook

These are gaps the runbook references but the codebase hasn't built yet. Resolve before launch:

- [ ] Wire `pnpm db:migrate` into the Vercel `vercel-build` hook so migrations apply atomically with code deploys ([§1.4](#14-deploy-to-production)).
- [ ] Build `/api/health` endpoint that checks DB + R2 connectivity.
- [ ] Create `cron_run_log` table + insert at the top of every Vercel cron handler ([§3.2](#32-cron--job-health)).
- [ ] Create `email_log` / `email_outbox` table + retry cron ([§4.4](#44-p1--emails-not-sending-or-5xx-rate-elevated)).
- [ ] Build `scripts/admin-issue-session.ts` for the auth-emergency override ([§4.3](#43-p0--auth-broken)).
- [ ] Build `scripts/tripwire-exclude.ts` for the pre-season EXCLUDE constraint verification ([§5.3](#53-pre-season-annually-mid-march-before-april-15-season-open)).
- [ ] Build `/api/cron/backup` weekly logical-backup job ([§2.2](#22-backups)).
- [ ] Configure all Sentry alerts listed in [§3.1](#31-sentry).
- [ ] Configure UptimeRobot ping on `/api/health` ([§3.3](#33-uptime)).

---

*Last updated: 2026-05-19 (initial draft).*
*Owner: Nick DeMarco.*
*Review cadence: quarterly + after every P0 incident.*
