# Wharfside Marina — Engineering Review (v1.0)

**Reviewer:** Independent senior engineering review
**Date:** 2026-05-19
**Scope:** Tech-stack soundness audit, security walkthrough, performance sanity-check, top changes by ROI.
**Inputs read:** `docs/architecture/ARCHITECTURE.md` v1.0, `docs/requirements/draft-prd-v0.3.md`, `package.json`, `src/db/schema.ts`, `docs/strategy/OFFICE-HOURS.md`, `docs/planning/DEV-PLAN.md`.

> **Read this first.** This is an internal HOA tool for ~100 users with $25–45/mo of infra and a solo dev who will eventually roll off the board. Most "best practice" SaaS advice does not apply. The bar is: does it ship by April 2027 with the next maintainer being able to read it on a coffee break? That is the lens used throughout.

---

## Section 1 — GStack Benchmark

**Honest caveat upfront.** I went to fetch `github.com/garrytan/gstack` per the brief. It is **not a reference startup stack**. It is Garry Tan's Claude Code skill collection ("23 opinionated tools that serve as CEO, Designer, Eng Manager…") — a workflow/agent toolkit, no framework, no DB, no auth recommendations. There is no Garry-Tan-blessed "GStack" web stack to benchmark against. If the intent was a different reference (T3 Stack, Theo's `create-t3-app`, Vercel/Next reference, "modern startup stack 2026"), that should be confirmed — but rather than stop, I benchmarked against the de facto solo-builder TypeScript stack circa 2026 (T3 + Vercel ecosystem), which is what most people mean when they say "modern startup stack."

### 1.1 Benchmark table — Wharfside vs. de facto solo-TS startup stack (T3 / Vercel reference)

| Layer | Reference (T3 / Vercel-typical) | Wharfside chose | Verdict | Rationale |
|---|---|---|---|---|
| Framework | Next.js (App Router, latest) | Next.js 14.2.5 (App Router) | **Keep** | Same choice. Pin is slightly behind (15.x is current); pin is fine for Spring 2027 ship. |
| Language | TypeScript strict | TypeScript 5.5 | **Keep** | Identical. |
| Styling | Tailwind + shadcn/ui | Tailwind, no UI kit picked | **Add shadcn/ui** | T3 reference assumes shadcn; Wharfside left it open. See LIBRARIES.md #9. |
| ORM | Drizzle OR Prisma (split community) | Drizzle | **Keep** | Drizzle is the correct call given `EXCLUDE USING gist` (Prisma can't express it). |
| DB | Neon, Supabase, or Vercel Postgres | Neon | **Keep** | Neon is the dominant T3 default for serverless Postgres. |
| Auth | Clerk OR Auth.js v5 | Auth.js v5 beta | **Keep with caveats** | Reference is split; Auth.js v5 is correct for cost ($0 vs Clerk $25+/mo), but the beta is real risk — see §3.1. |
| Validation | Zod | Zod 3.23 | **Keep** | Identical. |
| Email | Resend | Resend | **Keep** | Identical. |
| File storage | Vercel Blob, S3, or R2 | Cloudflare R2 | **Keep** | R2 is the right call given zero-egress for signed-URL doc previews. See §3.6. |
| Hosting | Vercel | Vercel | **Keep** | Identical. |
| Cron | Vercel Cron | Vercel Cron (architecture §11) | **Keep** | Identical. |
| Forms | react-hook-form OR Server Actions | Server Actions (implied) | **Keep** | App Router + Auth.js v5 strongly prefers Server Actions; matches reference. |
| Testing | Vitest + Playwright | Vitest 2 + Playwright 1.45 | **Keep** | Identical. |
| Observability | Sentry + Vercel Analytics | Sentry + Vercel logs + UptimeRobot | **Keep** | Identical. |
| Rate limiting | `@upstash/ratelimit` + Upstash Redis | Mentioned in architecture §12.5 but no concrete pick | **Resolve** — use Upstash | See LIBRARIES.md #14. |
| Package manager | pnpm | pnpm 9.5 | **Keep** | Identical. |
| Linter / Formatter | ESLint + Prettier (or Biome) | ESLint + Prettier | **Keep** | Identical. Biome would be faster but ecosystem still split. |
| Monorepo / tooling | Turborepo (if needed) | Single-package | **Keep** | Single app, single deploy — Turborepo is unnecessary overhead. |
| CI | GitHub Actions | GitHub Actions | **Keep** | Identical. |
| Feature flags | Vercel Edge Config or LaunchDarkly | None mentioned | **Skip** | Correct call — see LIBRARIES.md #15. |

**Headline:** Wharfside matches the de facto solo-TS reference on 16 of 18 load-bearing choices. The two genuine gaps are (a) **no concrete UI primitives library picked** (shadcn/ui + Radix is the obvious answer) and (b) **rate limiting is hand-waved**. Both resolved in LIBRARIES.md. **No divergence from the reference is worth reconsidering.** The stack is well-aligned with where the TS solo-builder ecosystem actually is in 2026.

---

## Section 2 — Stack Soundness Audit

Rated 1–5 for **this specific use case** (100-user internal HOA tool, money-adjacent, solo-dev, Spring-2027 ship, $25–45/mo).

| Layer | Choice | Rating | Justification |
|---|---|---|---|
| **Framework** | Next.js 14.2.5 App Router | **5/5** | Correct for the SSG public site + RSC admin + Server Actions mutations shape. The most hireable React framework if Nick rolls off. One framework spans patron site (SEO/SSG) and admin (auth/RSC) — exactly what the project needs. Pin at 14.2.5 is fine; consider 14.2.x patch updates monthly, defer 15 until post-launch. |
| **Language** | TypeScript 5.5 strict | **5/5** | Non-negotiable for a money-adjacent app with a deterministic pricing resolver. `strict: true` + Zod at boundaries catches the entire class of "I forgot a holder_state" bugs that would otherwise hit production. |
| **DB** | Neon Postgres | **5/5** | Real Postgres, branching for staging, scale-to-zero, `btree_gist` available (must verify, see §3.2). At 5GB at year 5, Launch tier ($19/mo) is overkill but still in budget. The booking model's `EXCLUDE USING gist` constraint is the architectural keystone — Neon supports it. |
| **ORM** | Drizzle 0.32 | **4/5** | Right call. Drizzle's SQL-likeness preserves Postgres-native features (exclusion constraints via raw SQL escape, JSONB, generated columns, daterange). Prisma would force you to abandon the EXCLUDE constraint or maintain a parallel raw-SQL migration that Prisma cannot introspect. -1 because the relations API is still less mature than Prisma's — see LIBRARIES.md #10 for the pattern. |
| **Auth** | Auth.js v5 beta (`next-auth@5.0.0-beta.19`) | **3/5** | The beta tag is the single biggest stack risk. Justified for cost ($0 vs Clerk $25/mo at 100 MAU), but you are on a moving target until v5 stable ships. See §3.1. If v5 stable doesn't land by Q4 2026, you ship on the latest beta and live with it; not catastrophic at this scale. |
| **Email** | Resend | **5/5** | Free tier (3K/mo) covers the entire projected volume by 6×. React Email integration is best-in-class. Postmark is a slightly safer pick on deliverability reputation, but Resend's SES backbone is fine. |
| **Storage** | Cloudflare R2 | **5/5** | Zero egress fees matter when you're serving doc previews via signed URLs. ~2GB total = ~$0.03/mo. The "S3-compatible" claim means swapping later is mechanical. |
| **Hosting** | Vercel Hobby → Pro | **5/5** | Correct. Hobby tier covers everything until ~Phase 2. The one cost-trajectory risk: function execution time on Server Actions that loop through 86 assignments × CSV generation. Should be sub-second; if you ever cross the 10s Hobby limit, that's a code smell, not a hosting problem. |
| **Observability** | Sentry free + UptimeRobot + Vercel Analytics | **4/5** | Adequate for the scale. -1 because there's no structured log aggregation; Vercel's log retention is 1 day on Hobby. If you ever need to debug an issue Linda hit yesterday, you cannot. See §3 for the fix (Axiom free tier or Logflare). |
| **Testing** | Vitest 2 + Playwright 1.45 | **5/5** | The right combination — Vitest for the pure-function pricing resolver (which is the high-value test target), Playwright for the booking-conflict and slip-fit-override flows. The architecture's testability is genuinely good because the pricing engine is pure. |

**Nothing flagged below 3.** The Auth.js beta is the only one that lands at 3, and it's a known/managed risk, not a stack mistake.

---

## Section 3 — Specific Risks

### 3.1 Auth.js v5 beta — risk and rollback

**What's actually risky.** `next-auth@5.0.0-beta.19` is a beta. The v5 API has been stable in shape for ~12+ months but minor breaking changes have continued through beta releases. The risks are (1) API churn between now and stable, (2) edge-case bugs in the Credentials + magic-link + TOTP combination Wharfside needs, (3) the Drizzle adapter for v5 is itself v0.x.

**Probability of "dust hasn't settled by ship":** Medium. v5 stable has been "imminent" for a year. It may or may not ship before April 2027. Plan as if it doesn't.

**The actual rollback.** If v5 becomes untenable, the migration paths in order of pain:
1. **Stay on whatever the latest v5 beta is at ship time.** It works; pin it. Risk: no security fixes if a CVE drops post-release. Mitigation: subscribe to GitHub releases, watch for security advisories monthly. **Recommended path.**
2. **Downgrade to Auth.js v4 stable.** v4 is in maintenance but works fine with App Router (slightly awkward integration). ~4–8 hrs of refactor: API changes are real but small. The Drizzle v4 adapter is stable. **Documented fallback.**
3. **Switch to Lucia v3.** Different mental model (manual session management) but designed for Next.js App Router specifically. ~20–30 hrs of refactor. **Only if both v5 and v4 become problematic.**

**Concrete action:** in the runbook, document that the auth layer is the most upgrade-sensitive part of the stack and pin every dependency that touches it. Run `npm outdated` on Auth.js monthly.

### 3.2 Neon `btree_gist` extension — confirm availability

The booking model is **architecturally dependent** on `EXCLUDE USING gist` over `(slip_id, daterange)`. Without `btree_gist`, the EXCLUDE constraint cannot mix the equality on `slip_id` (btree-indexed) with the range overlap on `daterange` (gist-indexed). No `btree_gist` = no architecture.

**Confirmation:** `btree_gist` **is available on Neon's free and paid tiers.** Neon's [extension support docs](https://neon.tech/docs/extensions/pg-extensions) list `btree_gist` as supported on all tiers. The architecture's `CREATE EXTENSION IF NOT EXISTS btree_gist` migration will succeed.

**Action:** SPIKE-A in DEV-PLAN.md is the right gate — run it in Week 1 of EPIC-0 against an actual Neon dev branch. If for any reason it fails (Neon's free-tier policies could shift), the fallback is app-layer locking via `SELECT … FOR UPDATE` inside the assignment transaction. That fallback is real but loses the DB-level guarantee that makes the architecture worth its weight.

### 3.3 App Router + Server Actions vs Pages Router + API routes

App Router is the right call. Gotchas specific to this app's shape:

- **Server Actions don't return rich errors well.** The natural shape is `{ ok: true } | { ok: false, error }` returned from the action and consumed by `useFormState` (now `useActionState` in React 19). For slip-fit-override flows where the action must return *both* a structured failure (which dimensions failed) *and* a re-submit token, design the return type upfront. Don't throw from server actions for expected business-rule failures — return them.
- **Server Action progressive enhancement is a footgun if you also want client-side TOTP UX.** TOTP enrollment is interactive (show QR, accept code, verify). It will not work as a pure form post. Use a route handler for the verify step. This is fine but worth knowing on day one.
- **Caching defaults changed in 14 → 15.** Pinned at 14.2.5 you're on the older defaults (more aggressive caching). When you eventually upgrade to 15, expect to revisit `fetch()` cache annotations. Not a now-problem.
- **RSC + auth: getting the session into a server component requires a server-only helper.** Auth.js v5 ships `auth()` for this. Use it; don't pass session via prop drilling.

No App Router showstoppers for this app.

### 3.4 Drizzle vs Prisma vs raw SQL

**Drizzle is correct at this scale.** Three reasons:
1. **`EXCLUDE USING gist` is unrepresentable in Prisma's schema.** Architecture v1.0 already calls this out (`src/db/schema.ts` line 175-176 comments). The exclusion constraint *is* the architecture; an ORM that can't express it loses.
2. **JSONB ergonomics.** `fee_schedule.base_config` is a JSONB blob. Drizzle's typed JSONB columns (with Zod parse on read) are clean.
3. **Migrations are SQL files you can read.** When the next maintainer reads `drizzle/0001_exclude_constraint.sql`, they will understand it. Prisma's migration files are similar but the schema language abstracts away the actual SQL.

Raw SQL (e.g., `pg` driver + handwritten queries) would also work for this scale (~30 query patterns total). The reason Drizzle wins over raw SQL is that the schema is *also* the TypeScript types — no drift between DB and app code.

### 3.5 Resend volume

**Math the architecture under-counts.** Take the worst case season:
- 86 holders × 4 doc types × 4 reminder cadences = **1,376 emails/year** just for doc reminders
- 100 transient confirmations = 100/season
- Magic-link logins: 86 holders × ~10 logins/season = 860/season
- Admin notifications, doc approvals, scenario submissions, transient queue mails: ~500/season

**Total: ~2,800 emails/season.** Within Resend's 3,000/mo free tier but **not within free tier if reminders cluster in a single month** (e.g., March pre-season). Realistically, expirations spread across the year, so monthly peaks should be ~500–800 emails.

**Verdict:** Resend free tier holds. Set up volume alerting at 2,500/mo. The $20/mo Pro tier (50K/mo) is the trivial upgrade if you ever cross it.

### 3.6 R2 vs S3 vs Vercel Blob

R2 wins because of **egress**. Math:
- 100 holders × 5 docs each × 2MB avg × 12 page-loads/year (admin + holder reviews) = ~12 GB/year of downloads
- S3 egress: ~$0.09/GB = ~$1.08/year. Tiny.
- R2 egress: $0. Zero.
- Vercel Blob egress: included in plan but counted against bandwidth caps (Hobby = 100GB/mo, fine).

**Why R2 still wins despite S3 being trivially affordable:** signed-URL document downloads can spike if a board member opens compliance reports and inadvertently triggers preview-loads of many PDFs. R2's zero-egress means you never have to think about it. Also, R2's pricing is dominantly storage ($0.015/GB/mo), and the architecture's 2GB worst case = $0.03/mo total.

**S3 fallback exists.** R2 is S3-compatible — the `@aws-sdk/client-s3` works against R2 with endpoint override. If R2 ever flakes (Cloudflare's status page does light up sometimes), the swap is mechanical.

Vercel Blob is fine but more expensive at scale and ties you tighter to Vercel — counterproductive for a multi-year HOA tool.

### 3.7 Vercel cost trajectory

At this scale, Hobby is more than enough until:
- **Bandwidth:** 100GB/mo. Reality: ~5GB/mo for an HOA tool with 100 users.
- **Function execution:** 100GB-hours/mo. Reality: ~0.5GB-hours/mo.
- **Function duration:** 10s on Hobby vs 60s on Pro. **This is the one to watch.** A CSV export over 86 assignments × `resolveFee` × CSV-stringify should be <500ms, well within 10s. But if Phase 1.5 adds bulk season-end ZIP export of all docs, that could hit the limit. Move that specific endpoint to a route handler with streaming when it ships.
- **Cron jobs:** Vercel Cron on Hobby allows only 2 cron jobs. Wharfside needs the daily doc-expiration scan = 1 cron job. Fine.
- **Preview deploys:** Hobby = unlimited preview deploys. Fine.
- **Commercial use:** Hobby is technically "personal use" per Vercel ToS. An HOA tool may or may not qualify. If audited, this becomes a $20/mo Pro upgrade. **Budget for Pro from day one** to avoid the surprise. The architecture's $25–45/mo range already accommodates this.

**The thing that breaks Hobby:** going commercial (which you may be doing anyway depending on how the board views the tool's ownership) or hitting 100GB-hours of function execution. Neither is plausible at 100 users.

---

## Section 4 — Security Walkthrough (OWASP Top 10)

### A01: Broken Access Control

The role matrix in architecture §9.2 is well-designed. The risks are in enforcement, not policy.

**Strong:**
- Permissions are listed pillar × role (the right axes).
- `holder` is constrained to "own only" on read — the right default.

**Weak / missing:**
- **No middleware pattern documented.** Server Actions and Route Handlers must individually check role. This is where access-control bugs come from. Recommendation: add a single `requireRole(roles[])` helper that throws on mismatch, and a `requireOwnership(holderId, session)` helper for "own only" cases. Every server action begins with one or both calls. Pattern this in EPIC-0 STORY-05.
- **No row-level security in Postgres.** With ~6 server actions and 100 users, app-layer enforcement is fine. If audit-log access ever opens to holders, revisit with RLS.
- **"holder write contact only" is enforced by validation, not by query.** A holder calling a server action for `updateHolderContact` must pass through a Zod schema that only allows the contact fields. If the action accepts a full holder object, an attacker submits extra fields. Use Zod `.strict()` on every action input.

**Action:** add `lib/auth/guards.ts` as an EPIC-0 deliverable. Document the pattern in the runbook.

### A02: Cryptographic Failures

- **TOTP secrets stored in plaintext (`app_user.totp_secret`).** Architecture §12.1 says "Auth.js default" but Auth.js does NOT encrypt TOTP secrets at rest — that's the application's job. **Recommend:** encrypt `totp_secret` with `NEXTAUTH_SECRET` (or a separate `TOTP_ENCRYPTION_KEY`) using AES-256-GCM. Decrypt in-memory at verification time. ~30 LOC, do not skip. See `otplib` rationale in LIBRARIES.md #3.
- **Session secrets:** Auth.js requires `AUTH_SECRET` env var. Generate a 32-byte random value (`openssl rand -base64 32`). Document rotation procedure in runbook (rotating invalidates all sessions; do during a maintenance window).
- **R2 signed URL design:** Architecture §12.3 says 15-min PUT, 5-min GET. Good. **Watch out:** the GET URLs are bearer credentials in the URL itself. If a holder copies the URL out of devtools and shares it, it works for 5 min. Acceptable risk for COIs (low-sensitivity PII), but document. Consider downloading via a server proxy (`/api/docs/[id]/download` that signs on the fly) instead of returning signed URLs to the client — adds 1 server hop but eliminates URL leakage. **Recommended.**

### A03: Injection

- **Drizzle parameterizes everything.** No SQL injection surface for normal usage.
- **Zod on every server action input** — make this a hard rule. Architecture §12.5 mentions Zod but the schema file has zero Zod schemas yet. Track this: every server action gets a Zod input schema, no exceptions.
- **JSONB injection.** `fee_schedule.base_config` is JSONB. If you ever build a "paste your JSON" admin UI for it, sanitize keys against the known schema (Zod parse before write). Today nothing user-typed reaches JSONB, so safe.
- **Markdown rendering on `/rules` etc.** If you use a Markdown renderer that allows raw HTML, you have an XSS path. Use `react-markdown` with the default no-html setting, OR `remark` + `rehype-sanitize`.

### A04: Insecure Design

- **Magic-link replay:** Auth.js handles this — tokens are single-use, 15-min lifetime. **Verify** by writing one Playwright test that consumes a magic link twice and asserts the second use fails. EPIC-0 STORY-05.
- **Transient upload-token expiration (48h):** the architecture has this as plain `upload_token` text + `upload_expires_at`. Two improvements: (1) the token should be a hash of a random 32-byte value (store hash, return raw to email recipient) so a DB leak does not expose live tokens; (2) single-use after first upload completes — set `upload_token = NULL` on first successful PUT. Otherwise a transient guest could upload a different file later.
- **Slip-fit override:** justification ≥20 chars is fine. Add server-side validation (not just client) and audit-log capture of *what dimensions failed* (the architecture says it does, but the schema's `assignment.override_reason` is a single TEXT field). Recommend a separate `override_failures` JSONB column or store this in audit_log.metadata.
- **No CSRF on Server Actions in App Router?** Server Actions ARE CSRF-protected by Next.js (origin check + secret). Route Handlers that mutate state need explicit CSRF tokens if accepting cross-origin requests. For Wharfside, all mutating requests are same-origin Server Actions; safe.

### A05: Security Misconfiguration

- **Vercel env var management:** straightforward but two gotchas. (1) Preview deploys inherit env vars by default — production secrets leak into PR preview URLs that anyone with the link can hit. Configure env vars **per environment** (Production / Preview / Development separately) and use a different DB branch + a "preview" Resend API key for Preview. (2) Rotate `AUTH_SECRET` if anyone leaves the project (Nick is solo so this is moot, but document for future).
- **Neon connection pooling:** Neon offers a connection-pooled endpoint (port 6432, "pooler") vs the direct endpoint. **Use the pooled endpoint** for Vercel Serverless Functions — Neon's `pgbouncer`-style pool avoids cold-start connection exhaustion. The Drizzle connection string should use the `-pooler.neon.tech` hostname. Configure `?pgbouncer=true` for migrations to use the direct endpoint.
- **Security headers:** the architecture does not mention CSP / X-Frame-Options / Referrer-Policy. Add a `next.config.js` headers block (or middleware) for:
  - `Content-Security-Policy` with strict defaults + allowlist for NOAA tide iframe
  - `X-Frame-Options: DENY` (or via CSP `frame-ancestors`)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` denying camera/microphone/geolocation
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

  Use `@next/safe-headers` or copy-paste from a Vercel blog template. ~30 LOC.

### A07: Identification and Authentication Failures

- **Magic-link timing:** 15-min lifetime is correct. The risk is users requesting many links and clicking an old one (uses an old session). Single-use enforcement (A04) handles this.
- **TOTP enrollment flow:** architecture doesn't show the flow. Standard pattern: (1) generate secret server-side, encrypt (A02), store; (2) show QR + manual entry code to user; (3) require successful verification before activating the account; (4) generate 8 single-use backup codes, hash them with bcrypt/argon2, show once. Document this in EPIC-0 STORY-05 spike notes. Skipping backup codes is the #1 reason admins get locked out.
- **Account enumeration:** the magic-link request endpoint should respond identically whether the email exists or not ("If we have an account for that email, we sent a link"). Auth.js's Email provider does this by default; verify.
- **Rate limiting:** architecture §12.1 says "5 magic-link requests per email per hour; 10 login attempts per IP per 15 min." Architecture §12.5 says "Upstash Rate Limit (free tier) for public endpoints." Make this concrete — see LIBRARIES.md #14.

### A08: Software and Data Integrity Failures

- **Package supply chain:** architecture mentions Dependabot. **Recommend Renovate over Dependabot** — Renovate batches updates (Dependabot's PR firehose burns out solo devs) and supports `:lockFileMaintenance` for automatic lockfile refresh. Configure Renovate with auto-merge for minor/patch on dev deps after CI passes. Major version updates always require human review.
- **Lockfile in repo:** `pnpm-lock.yaml` must be committed. Confirmed by `packageManager: pnpm@9.5.0`. Good.
- **No package signature verification:** npm/pnpm don't verify package signatures by default. Risk is real but unlikely at this scale. Don't lose sleep over it.
- **No SBOM / SLSA:** not relevant for an HOA tool. Skip.

### A09: Security Logging and Monitoring Failures

The `audit_log` design (architecture §4.1, §12.4) is **excellent in intent, weak in concrete fields**. What's missing:

- **No IP address column.** Should be in `metadata` JSONB, but better as a typed column for indexing. `metadata.ip_address` is fine if you always populate it.
- **No request_id / trace_id for correlation with logs.** Add one. Set in middleware, propagate to every audit insert.
- **No `event_severity`.** Failed logins, override events, and config activations are different from "user edited their phone number." Add `severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','notice','warning','critical'))`.
- **No "failed action" capture.** The audit log only captures successful writes. Failed slip-fit blocks (which should NOT proceed) should still produce a `severity='warning'` row. Otherwise the override report is one-sided — you see overrides but not "tried, blocked, didn't override."
- **No retention policy.** Append-only forever is fine for now; at 100 users, growth is ~5K rows/year. Document at year 5 a quarterly archive-to-R2 script.
- **No alerting hook.** A `severity='critical'` row (admin role change, fee schedule activated, audit-log access attempt) should email Nick. Vercel Cron daily query + Resend; ~30 LOC.

### A10: Server-Side Request Forgery

**Outbound calls from the architecture:**
- Resend API (transactional emails)
- R2 (signed URL generation + uploads/downloads)
- Sentry (telemetry)
- NOAA tide widget (client-side iframe, not server-side fetch)
- Vercel platform internals

**No user-controlled URLs are fetched server-side.** The only risk vector is the NOAA tide embed if it becomes a server-side fetch in Phase 1.5 (caching weather data, etc.). Document the rule: any server-side `fetch()` of an external URL must use an allowlist.

**Bottom line on security:** the architecture is well-conceived. The concrete deltas above are mostly "make implicit things explicit" — the missing pieces are concrete patterns (`requireRole`, security headers, audit fields), not missing principles.

---

## Section 5 — Performance Budget

Architecture §13 targets are mostly reasonable. Sanity check:

| Target (§13) | Sanity | Notes |
|---|---|---|
| 10 concurrent users peak | **OK** | Realistic. 100 named users × ~5% concurrency = 5. 10 is conservative. |
| Public page <2s on 4G | **Tighten to <1.5s LCP** | SSG + edge = ~200–400ms server response. With Tailwind CSS purged and no client-side JS on static pages, FCP <800ms and LCP <1.5s are achievable. Lighthouse target: **Performance ≥95** on `/`, `/rules`, `/emergency`. |
| Admin query <1s | **Tighten to <300ms p50, <800ms p95** | At 86 slips and ~200 assignments/season, every query is indexable to <50ms in Postgres. The 1s budget is loose. Hold to <300ms p50; if you cross 500ms, something's wrong (N+1 query). |
| Scenario recompute <1s for 86 slips | **<10ms easy** | Pure function over 86 in-memory rows. Sub-ms in practice. The 1s budget should be the *server roundtrip* including DB read + serialize, which is ~50–100ms. |
| Document storage 2GB over 3 years | **OK** | 100 holders × 5 docs × 2MB × 3 years = 3GB worst case. R2 holds petabytes. |
| Database size <5GB at year 5 | **OK, likely <1GB** | Audit log is the only growth vector. 5K rows/yr × 5 yrs × ~2KB JSONB = 50MB. The DB will be tiny. |
| Uptime 99% | **OK** | Vercel + Neon both ≥99.9%. 99% is intentionally loose; the marina survives a 4-hour outage. |
| Backup RPO 24h / RTO 24h | **Tighten RPO** | Neon PITR is <5min by default on Launch tier. Make the architecture promise RPO = 1 hour as the *practical* target; 24h is the floor. |

### Concrete budgets to enforce

**Web Vitals (public pages):**
- LCP: <1.5s
- INP: <200ms
- CLS: <0.1
- TTFB: <400ms (SSG should beat this trivially)

**Web Vitals (admin pages):**
- LCP: <2.5s
- INP: <200ms

**DB query budgets** (server-side, single request):
- p50: <50ms
- p95: <200ms
- p99: <500ms
- Anything >500ms triggers an investigation

**Bundle budget:**
- Patron site JS (per route): <50KB gzipped
- Admin app shell: <200KB gzipped
- Total per route incl. shared chunks: <300KB gzipped

**API budgets:**
- Server Action median: <100ms
- CSV export endpoint: <2s for 86 assignments
- Scenario recompute roundtrip: <200ms

Configure Vercel Speed Insights (free) and Web Vitals reporting → Sentry to track these in production.

---

## Section 6 — Top 5 Architectural Changes (Ranked by ROI)

### 1. Add `audit_log` quality fields BEFORE shipping EPIC-0

`severity`, `request_id`, `ip_address`, and a "failed action" capture pattern. **Cost:** ~2 hours during EPIC-0 STORY-03. **ROI:** the difference between "we have an audit trail" and "we have a useful audit trail." Once data starts flowing into the current schema, retrofitting these requires backfill scripts. Do it once, do it now.

### 2. Move document downloads behind a server proxy, not client-direct signed URLs

`GET /api/docs/[id]/download` that authenticates the request, server-side-signs an R2 URL with 30s TTL, and 302-redirects (or streams). **Cost:** ~3 hours. **ROI:** eliminates the URL-leak risk class entirely, gives you a logging chokepoint (every doc view = audit row), and lets you swap R2 → S3 transparently. The architecture's "signed URL to client" pattern is fine for upload (the client needs the URL to PUT) but is the wrong shape for download.

### 3. Switch architecture to Renovate (with auto-merge) instead of Dependabot

**Cost:** 30 minutes to install. **ROI:** Dependabot will fire ~3 PRs/week. By month 4, Nick will be ignoring them, and an Auth.js security patch will sit unmerged. Renovate batches updates weekly and auto-merges patch versions after CI passes. This is the highest-leverage change in the security posture for a solo dev.

### 4. Encrypt `totp_secret` at rest + add a documented TOTP-recovery flow with backup codes

**Cost:** ~4 hours. **ROI:** the day Nick or Kathy loses their phone is the day "I have to ssh into Neon and reset a field" becomes the worst hour of the project. Backup codes solve this in 30 seconds. Encrypting the secret at rest is defense-in-depth for the eventuality of a DB dump being shared (e.g., for debugging) — without encryption, those secrets are forever-leaked.

### 5. Introduce a `lib/auth/guards.ts` + Zod-strict-input convention pattern document in EPIC-0

`requireRole`, `requireOwnership`, `requireSession` helpers + a 1-page "every server action follows this template" pattern. **Cost:** ~3 hours upfront + saves time on every subsequent action. **ROI:** access-control bugs are the #1 way an internal HOA tool leaks data. The pattern is the single highest-leverage thing the architecture currently lacks. Without it, every new server action is a fresh opportunity to forget a check.

**Honorable mentions** (didn't make top 5 but worth doing):
- Wire Sentry's "tunnel" route to bypass ad blockers (Vercel-hosted Next.js apps lose ~30% of Sentry events to uBlock otherwise).
- Add a `pnpm test:e2e:critical` subset (5 tests: login, slip-fit override, doc upload, scenario submit, transient approve) that runs on every PR. Full Playwright suite runs nightly.
- Document a "delete a holder's data" runbook (GDPR-adjacent; even though no GDPR jurisdiction, it's the right hygiene).
