# Wharfside Marina — Development Plan (v1.0)

**Project:** `wharfside-marina`
**Status:** v1.0 — initial dev plan, derived from PRD v0.3 + Architecture v1.0 + UX Spec v0.1 + Office Hours strategy
**Author:** Dev Planning specialist (Software Project team)
**Date:** 2026-05-19
**Sponsor:** Nick DeMarco (solo dev)
**Target go-live:** Spring 2027 (April ~1, 2027)
**Companion file:** `BACKLOG.md` (issue-ready stories)

---

## 0. Document Purpose

This is a **solo-dev sequencing plan**, not a sprint-and-ceremony Agile artifact. Nick is the only developer. There is no team to coordinate, no standups, no story points poker. The plan exists to:

1. Show Nick when the work fits into the calendar against Spring 2027.
2. Force a real choice between linear and modeler-first phasing.
3. Break the architecture's 6 phases into ~50 GitHub-issue-ready stories so progress is visible.
4. Name the spikes and decisions that block specific stories.

Anything not in service of those four jobs has been cut.

---

## 1. Build Calendar — Solo Developer Schedule

**Anchor:** today = **2026-05-19**. Target go-live = **April 1, 2027** (~46 weeks of calendar). Architecture estimates **210–290 hours** total.

**Capacity assumption (from Office Hours risk note):** Nick sustains 5–10 hr/week. Below 5 hr/week, MVP scope must be cut.

### 1.1 Scenarios

| Scenario | Pace | Total hrs | Calendar weeks | Buffer to Apr 2027 |
|---|---|---|---|---|
| **Optimistic** | 10 hr/wk | 210 | 21 weeks | ~25 weeks buffer |
| **Realistic** | 7.5 hr/wk | 250 | 33 weeks | ~13 weeks buffer |
| **Pessimistic** | 5 hr/wk | 290 | 58 weeks | **8 weeks OVER** — must cut scope |

The pessimistic case **does not finish on time** with full scope. The MVP cut line in §8 identifies what to drop.

### 1.2 Phase Gantt — Realistic Pace (7.5 hr/wk, 250 hrs, ~33 weeks of work)

| Phase | Work hrs | Wk-of-effort | Start | Finish | Notes |
|---|---|---|---|---|---|
| **0 — Foundation** | 35 | 4.5 wks | 2026-05-26 | 2026-06-27 | Auth, schema, deploy, CI. Includes spikes. |
| **1a — Patron Site** | 35 | 4.5 wks | 2026-06-29 | 2026-08-01 | Public pages + transient form. **Soft public ship: Aug 2026.** |
| **1b — Pricing Modeler** | 60 | 8 wks | 2026-08-03 | 2026-10-03 | Mock data layer added. **Soft Linda ship: Oct 2026.** Buffer for board demo before FY27 rate-card decision. |
| _Modeler usage with Linda_ | _0_ | 4 wks | 2026-10-05 | 2026-11-02 | Linda models FY27 rate card; Nick available for fixes. |
| **2a — Slip Ops** | 60 | 8 wks | 2026-11-02 | 2026-12-28 | Map editor, slip-fit, dockmaster mobile. |
| **2b — Doc Collection** | 35 | 4.5 wks | 2027-01-04 | 2027-02-07 | Holder portal, doc upload, compliance dash. |
| **3 — Polish + Launch** | 25 | 3.5 wks | 2027-02-08 | 2027-03-08 | Reports, AppFolio CSV, accessibility audit. |
| **Buffer / data import / Kathy training** | — | 4 wks | 2027-03-08 | 2027-04-05 | **Launch window opens here.** |

This schedule fits Spring 2027 with 4 weeks of slack. The realistic pace assumes Nick takes 1-2 weeks off for holidays (already absorbed).

### 1.3 Pessimistic Pace — What Gets Cut

If Nick averages 5 hr/wk, total available before April 2027 ≈ **230 hrs**. With full scope at 290 hrs, that's 60 hrs short. Cut these from the critical path (defer to Phase 1.5):

- Booking calendar visual ribbon view (FR-3.3.6) → grid view only — saves ~8 hrs
- Per-holder impact view + CSV export in modeler → revenue total only at first — saves ~10 hrs
- Marina Config visual map editor → JSON-import only, no GUI editor — saves ~15 hrs
- Audit log filterable UI → backend only, query via SQL — saves ~6 hrs
- Slip-fit override report UI → SQL view, no UI — saves ~5 hrs
- Compliance dashboard chart visualizations → table only — saves ~6 hrs
- Email template polish (basic-text only) → saves ~5 hrs

That's ~55 hrs back, bringing the critical path under 235 hrs. Survivable.

---

## 2. Two Phasing Options

### Option A: Linear (Spring 2027 all-at-once)

Phases run in architecture order: 0 → 1a → 1b → 2a → 2b → 3, all shipped at launch in April 2027. Modeler arrives just as the FY27 rate-card decision is being made (likely Nov 2026 board meeting). **Risk:** Modeler completed ~Oct 2026 but no production deploy until April 2027 — Linda would need a staging URL or a Vercel preview deploy to use it for the FY27 decision, which is fragile.

**Pros:** Simplest. One deploy. No mock-data layer. ~210 hrs.
**Cons:** Modeler is ready 4-5 months before its primary user can confidently use it in production. The most validated user (Linda) waits longest. The most adoption-risk pillar (slip ops) blocks launch.

### Option B: Modeler-First (Q4 2026 early ship, full launch Spring 2027)

Phase 0 → Phase 1a (patron site soft-launch Aug 2026) → Phase 1b (modeler with mock data, soft-launched to Linda + board Oct 2026 for FY27 rate-card use) → Phase 2a → 2b → 3 → full launch Spring 2027. The patron site and modeler go live ~6 months before slip ops + docs do.

**Pros:**
- Linda gets the modeler in time for FY27 rate-card discussion (Office Hours' core demand-evidence pillar).
- Patron site lives on Google for ~8 months before launch — SEO compounds.
- If the rest of the build slips, the two validated-user pieces are already live.
- Mock-data layer is reusable for staging / demos forever.

**Cons:**
- Two soft-launches before the real one. More deploys, more "is this stable yet?" questions from users.
- ~30 hrs of extra work: mock data seeder (~10 hrs), feature flags + role gating to hide unfinished modules (~8 hrs), staging vs. prod separation (~6 hrs), holder/slip data backfill plan for the slip-ops launch (~6 hrs).
- Modeler total bumps to **240 hrs realistic / 280 hrs pessimistic.**

### Recommendation: **Option B — Modeler-First**

Three reasons:

1. **Office Hours got this right.** The validated users (Linda + public visitors) are in Phase 1. Building for them first is the only path that proves value before launch.
2. **The mock-data layer is cheap insurance.** It costs ~10 hrs and gives Linda a usable modeler in October. If Q-PRIORITY1 / Q-TRANSIENT1 / restoration timing all slip simultaneously, the modeler still ships.
3. **A patron site live in August 2026 is its own forcing function.** Once it's public, the project is real to the board. That helps morale and reduces the chance Nick burns out in Phase 2a.

The **single thing that flips this back to Option A** is if Linda explicitly says she doesn't want the modeler until full launch — that conversation should happen in the next 2 weeks (it's the Sprint 1 decision in §7).

---

## 3. Epics

Six epics, one per architecture phase. IDs are `EPIC-0`, `EPIC-1A`, `EPIC-1B`, `EPIC-2A`, `EPIC-2B`, `EPIC-3`.

### EPIC-0 — Foundation

**Goal:** A deployable Next.js 14 app with auth, DB schema, CI/CD, and seed data ready to receive feature work.

**Stories:** STORY-01 through STORY-09 (see BACKLOG.md and §4 below).

**Epic acceptance criteria:**
- `pnpm dev` runs locally against a Neon dev branch with seeded data.
- A Vercel preview deploy is reachable at a staging URL with all core tables created.
- A super_admin user (Nick) can sign in with email/password + TOTP.
- Postgres `btree_gist` extension verified working on Neon.
- GitHub Actions runs lint + typecheck + test on every PR.
- Drizzle migrations apply cleanly on a fresh DB and on the dev branch.

**Estimated hours:** 30–40 (architecture says 30–40; mid-point 35).
**Dependencies:** None — this is the start.
**Risks:**
- TOTP integration with Auth.js v5 may be fiddlier than docs suggest. Spike before committing.
- `btree_gist` availability on Neon free tier is not 100% documented. Verify on dev branch in week 1.

### EPIC-1A — Patron Site + Public Transient Form

**Goal:** Public marketing site live on `wharfsidemarina.com` with rules, contact, emergency, map (read-only), FAQ, forms library, and transient request form.

**Stories:** STORY-10 through STORY-17.

**Epic acceptance criteria:**
- Public homepage loads <2s on 4G.
- All public routes (`/`, `/rules`, `/emergency`, `/contact`, `/map`, `/faq`, `/forms`, `/transient`, `/services`) render with branded layout and pass WCAG 2.1 AA on body text.
- Transient request form writes to `transient_request` table; submitter and Kathy both receive emails.
- Google can index the site (sitemap.xml + robots.txt present; OpenGraph + JSON-LD on `/`).
- Site is first Google result for "Wharfside Marina rules" within 90 days post-launch (success criterion, not gate).

**Estimated hours:** 30–40 (mid-point 35).
**Dependencies:** EPIC-0 complete.
**Risks:**
- Rules content needs to be lifted from WMCA Handbook PDF — may take a session with Nick to extract and copyedit.
- NOAA tide embed may have a CORS or iframe quirk. Spike on day 1 of this epic.
- Domain decision (Q-DOMAIN1) blocks DNS setup — needs board sign-off.

### EPIC-1B — Pricing Modeler

**Goal:** Linda can clone the Active Fee Schedule into a Scenario, edit rates and season parameters, see projected revenue update live, compare scenarios, export PDF/CSV, walk the scenario through Draft → Submitted → Approved → Active.

**Stories:** STORY-18 through STORY-30.

**Epic acceptance criteria:**
- Pure-function `resolveFee()` covers all 4 holder states × 4 lease types × 3 slip tiers. Unit tested.
- Rate matrix editor has Excel-style keyboard nav and ~250ms debounced live recalc.
- Per-holder impact view sorts by delta and exports to CSV.
- PDF export produces a branded fee schedule suitable for board email.
- State machine: Draft → Submitted → Approved → Active → Archived. All transitions audit-logged with actor + timestamp + reference text.
- Scenario library lists, sorts by date / state / projected revenue.
- 3-column compare (Active vs. Scenario A vs. Scenario B) renders inline.
- Season-date override modeling: changing `season_start_date` recomputes projection.
- **Mock data:** 86 seeded slips + 50 seeded assignments + 1 Active fee schedule loaded from a JSON seed file. (Option B requirement.)

**Estimated hours:** 50–70 (mid-point 60); +10 if Option B (mock data layer).
**Dependencies:** EPIC-0 complete. Q-PRICE1 and Q-RESDISCT1 resolved (defaults assumed if not).
**Risks:**
- PDF generation library choice (react-pdf vs. puppeteer vs. pdfkit) is a spike. See §6.
- JSONB `fee_schedule.base_config` schema needs a `schema_version` field; designing for future model variants without overengineering is a judgment call.
- Live recalc UX may need tuning with Linda — the 250ms debounce might be wrong; needs a Linda session.

### EPIC-2A — Slip Operations

**Goal:** Kathy can manage marina configuration (CRUD slips with versioning), assign holders to slips with slip-fit enforcement + override, see a per-slip booking calendar, review and approve transient requests, and look up assignments on her phone.

**Stories:** STORY-31 through STORY-44.

**Epic acceptance criteria:**
- Marina Config: create new version, clone slips from prior version, edit slip attributes, activate version (only one active).
- Visual slip map: clickable SVG polygons over a PNG background; click → side panel with slip detail + assignment + booking calendar.
- Slip-fit check (LOA / beam / draft + 0.5ft margin) runs server-side before any assignment insert.
- Admin override with justification ≥20 chars; logged in audit + visible on override report.
- Assignment with `lease_type ∈ {FULL_SEASON, HALF_SEASON_1, HALF_SEASON_2, TRANSIENT}`; Postgres `EXCLUDE USING gist` prevents overlap.
- Booking calendar timeline view per slip; marina-wide pivot view (Phase 1.5 candidate, not in MVP scope unless ahead of schedule).
- Transient request queue with calendar overlay; approve / deny / hold flow.
- Dockmaster mobile view: search "47" returns slip + current assignment + tap-to-call in <1s on mobile Safari.

**Estimated hours:** 50–70 (mid-point 60).
**Dependencies:** EPIC-0 complete; EPIC-1A live (transient form writes feed this queue). Q-PRIORITY1, Q-DEPOSIT1, Q-TRANSIENT1 resolved or defaults documented.
**Risks:**
- SVG slip map polygon editor is a build-or-buy spike. If "buy" loses, building an in-app polygon editor for ~86 polygons is non-trivial (~10-15 hrs alone).
- Half-season date logic: split_date is per-Marina Config, but each Assignment carries its own start/end. Need to verify the resolver handles edge cases (mid-season split changes).
- Booking exclusion constraint must allow `canceled` rows to not block re-booking. The WHERE clause handles this; needs a test.

### EPIC-2B — Document Collection

**Goal:** Holders can log in (magic link) and upload COI / registration / indemnification / survey / lease docs. Expirations trigger reminders. Kathy reviews and approves. Compliance dashboard shows org-wide status.

**Stories:** STORY-45 through STORY-53.

**Epic acceptance criteria:**
- Magic-link login works; first-time holders provisioned via admin "Send invite."
- Holder portal: single-page with documents card grid + status badges (Current / Expiring / Expired / Missing).
- Document upload to R2 via signed PUT URLs; max 25MB; PDF/JPG/PNG only.
- Doc types: COI, REGISTRATION, INDEMNIFICATION, CAPTAIN, SURVEY, RESIDENT_LEASE.
- Reminder cron job runs daily; sends emails at T-60, T-30, T-7, T-0 days before expiration.
- Kathy's review queue: list + PDF preview + Approve / Reject (with comment ≥20 chars).
- Compliance dashboard: % holders fully compliant, drill-down to non-compliant.
- Reject sends an email with the reason; suppressed once renewal is approved.

**Estimated hours:** 30–40 (mid-point 35).
**Dependencies:** EPIC-0 (auth + R2 setup) and EPIC-2A (holder records must exist).
**Risks:**
- R2 signed-URL upload from the browser has a CORS configuration step that varies by R2 region. Quick spike.
- Holder portal adoption is uncertain (Office Hours warning); admin must be able to upload docs on a holder's behalf as a fallback. Design that in from the start.
- Lease doc + indemnification doc are sometimes long. PDF preview in browser may fail for some files; fallback is "download to view."

### EPIC-3 — Reports + Launch

**Goal:** All boardroom-relevant reports exist; CSV export to AppFolio works; accessibility audit passes; holder onboarding emails sent; production cutover from staging is documented.

**Stories:** STORY-54 through STORY-60.

**Epic acceptance criteria:**
- Reports: Occupancy YoY (by lease type), Compliance Summary, Revenue Projection (by lease type), Transient Activity, Slip-fit Override Log. All PDF + CSV exportable.
- AppFolio CSV export endpoint produces the locked strawman schema (Section 3.8 of PRD). Verified against a dry-run import with Kathy.
- WCAG 2.1 AA audit on patron + holder pages passes.
- Onboarding emails sent to all holders 2 weeks before launch with magic-link first-login URL.
- Runbook documented (rotate secrets, restore backup, onboard a new admin).
- Data backfill from AppFolio export validated against the holder/slip tables.

**Estimated hours:** 20–30 (mid-point 25).
**Dependencies:** All prior epics complete. Q-AF1 validated with Kathy (CSV dry-run).
**Risks:**
- AppFolio CSV schema may differ from strawman; mapping function is centralized but a real-format mismatch could be ~5-10 hrs of rework.
- Accessibility audit may surface issues that require revisiting older epics. Plan a buffer.

---

## 4. Stories — Issue-Ready

Detailed story content lives in `BACKLOG.md`. This section is the index.

### EPIC-0 — Foundation (9 stories, ~35 hrs)

| ID | Title | Hrs |
|---|---|---|
| STORY-01 | Bootstrap Next.js 14 App Router + TypeScript + Tailwind | 3 |
| STORY-02 | Set up Neon Postgres + Drizzle + first migration | 4 |
| STORY-03 | Create core schema: marina_config, slip, holder, vessel, assignment, document, fee_schedule, scenario, audit_log, app_user, auth_session | 6 |
| STORY-04 | Implement Postgres `EXCLUDE USING gist` constraint on assignment + `btree_gist` extension | 3 |
| STORY-05 | Configure Auth.js v5 with magic-link (holders) + email/password + TOTP (admins) | 6 |
| STORY-06 | Set up Cloudflare R2 bucket + signed-URL upload/download helpers | 3 |
| STORY-07 | Set up Resend + first transactional email template (account invite) | 2 |
| STORY-08 | GitHub Actions CI (lint + typecheck + test); Vercel project + preview deploys | 3 |
| STORY-09 | Seed script: minimal user fixtures + smoke-test data | 3 |
| _SPIKE-A_ | btree_gist on Neon — verify availability + perf | 1 |
| _SPIKE-B_ | Auth.js v5 TOTP + magic-link combined config | 1 |

### EPIC-1A — Patron Site + Public Transient Form (8 stories, ~35 hrs)

| ID | Title | Hrs |
|---|---|---|
| STORY-10 | Public layout shell: nav, footer, branded color palette + typography | 4 |
| STORY-11 | `/` home page: hero, "I'm here to..." cards, quick info, NOAA embed | 5 |
| STORY-12 | `/rules` page: lift WMCA Handbook content into Markdown, render with TOC | 4 |
| STORY-13 | `/emergency` + `/contact` + `/faq` + `/services` + `/forms` pages (markdown-driven) | 5 |
| STORY-14 | `/map` page: read-only SVG slip map (no assignment data, just slip outlines) | 5 |
| STORY-15 | `/transient` public form + server action → `transient_request` row + confirmation email | 5 |
| STORY-16 | SEO: sitemap.xml + robots.txt + metadata API + JSON-LD `LocalBusiness/Marina` | 3 |
| STORY-17 | Domain + DNS setup; production deploy (CONDITIONAL on Q-DOMAIN1) | 2 |

### EPIC-1B — Pricing Modeler (13 stories, ~60 hrs)

| ID | Title | Hrs |
|---|---|---|
| STORY-18 | Mock data seed: 86 slips + 50 assignments + 1 Active fee schedule (Option B only) | 4 |
| STORY-19 | Pure-function `resolveFee()` for all 4 holder states × 4 lease types × 3 slip tiers; unit tests | 6 |
| STORY-20 | Active Fee Schedule read-only view | 3 |
| STORY-21 | "Model a scenario from this" → clone Active → new draft scenario | 3 |
| STORY-22 | Rate matrix editor: 3-tier × 3-lease-type grid, Excel-style keyboard nav, inline edit | 8 |
| STORY-23 | Holder multipliers + amenity fee + buy-in editors (form section under matrix) | 3 |
| STORY-24 | Season-date override editor (start, end, half-split) | 3 |
| STORY-25 | Right-pane projection: total revenue + delta vs. Active + by-holder-type bar + by-lease-type bar | 5 |
| STORY-26 | Live recalc with ~250ms debounce; autosave drafts to scenario row every 5s | 4 |
| STORY-27 | Per-holder impact view: sortable table of 86 rows; CSV export | 5 |
| STORY-28 | Compare view: Active vs. Scenario A vs. Scenario B 3-column inline table | 4 |
| STORY-29 | Scenario library list view + Scenario state machine (Draft → Submitted → Approved → Active → Archived) with audit log on every transition | 6 |
| STORY-30 | PDF export of fee schedule (Wharfside-branded) for board email | 5 |
| _SPIKE-C_ | PDF library choice (react-pdf / puppeteer / pdfkit) | 1 |

### EPIC-2A — Slip Operations (14 stories, ~60 hrs)

| ID | Title | Hrs |
|---|---|---|
| STORY-31 | Marina Config CRUD: create version, clone slips from prior, activate (only one active) | 5 |
| STORY-32 | Slip CRUD: edit attributes (LOA limit, beam limit, depth, tier, amenities); audit on every change | 4 |
| STORY-33 | Marina Config season params editor (season_start_date, season_end_date, half_season_split_date, residency_lock_date, defaults) | 3 |
| STORY-34 | SVG slip map renderer with click-to-detail panel | 6 |
| STORY-35 | SVG polygon editor — admin draws slip polygons over background image (CONDITIONAL on SPIKE-D outcome) | 8 |
| STORY-36 | Holder CRUD with 4 holder states + residency lock + lease_doc_id for resident_renter | 5 |
| STORY-37 | Vessel CRUD (1:N per holder) | 2 |
| STORY-38 | Assignment creation flow: select slip + holder + vessel + lease_type → server action with slip-fit check + override | 6 |
| STORY-39 | Assignment confirmation + state machine (proposed → confirmed → closed / canceled) | 3 |
| STORY-40 | Slip-fit enforcement: server-side check on LOA/beam/draft+margin; block insert with explanatory error | 3 |
| STORY-41 | Admin override flow: 20-char justification → `override_reason` populated + audit log entry | 2 |
| STORY-42 | Per-slip booking calendar (timeline strip view) | 5 |
| STORY-43 | Transient request review queue: list + calendar overlay + Approve / Deny / Hold actions; confirmation emails | 6 |
| STORY-44 | Dockmaster mobile slip lookup (search "47" → slip detail + tap-to-call) | 3 |
| _SPIKE-D_ | SVG polygon editor — build vs. existing libs (react-konva, leaflet-image, etc.) | 1 |

### EPIC-2B — Document Collection (9 stories, ~35 hrs)

| ID | Title | Hrs |
|---|---|---|
| STORY-45 | Holder portal layout: anchored single-page navigation | 3 |
| STORY-46 | Holder dashboard sections: my slip, my vessels, my docs, my fees, my contact info | 5 |
| STORY-47 | Document upload via R2 signed PUT URL; doc type + expiration_date entry | 5 |
| STORY-48 | Document status badges (Current / Expiring / Expired / Missing) computed at query time | 3 |
| STORY-49 | Doc review queue (Kathy): list + PDF preview + Approve / Reject (≥20-char comment) | 5 |
| STORY-50 | Reminder cron job: Vercel Cron daily, scans for T-60/T-30/T-7/T-0 expirations, sends emails | 4 |
| STORY-51 | Reminder email templates (React Email) for each cadence point | 3 |
| STORY-52 | Compliance dashboard: % current, drill-down list of non-compliant holders | 4 |
| STORY-53 | Admin-uploads-on-behalf-of-holder flow (fallback for low-portal-adoption holders) | 3 |

### EPIC-3 — Reports + Launch (7 stories, ~25 hrs)

| ID | Title | Hrs |
|---|---|---|
| STORY-54 | Report: Occupancy YoY by lease type (PDF + CSV) | 3 |
| STORY-55 | Report: Compliance Summary (PDF + CSV) | 2 |
| STORY-56 | Report: Revenue Projection by lease type (PDF + CSV) | 3 |
| STORY-57 | Report: Transient Activity + Slip-fit Override Log (PDF + CSV) | 3 |
| STORY-58 | AppFolio CSV export endpoint; locked strawman schema (Section 3.8); dry-run with Kathy | 5 |
| STORY-59 | Holder onboarding email blast: first-login magic-link URL with personalized note | 3 |
| STORY-60 | Accessibility audit (WCAG 2.1 AA) + runbook documentation (backup restore, secret rotation, admin onboarding) | 6 |

---

## 5. Cross-cutting / Shared Work

These threads run across multiple epics. They are NOT separate stories; they are baked into the relevant stories above.

| Concern | Built in | Reused by |
|---|---|---|
| **Database migrations (Drizzle)** | EPIC-0 STORY-02 + STORY-03 | All epics |
| **Auth + role-based authorization middleware** | EPIC-0 STORY-05 | All authed routes |
| **Audit logging utility** (`lib/audit/log.ts`) | EPIC-0 STORY-03 | EPIC-1B (scenario transitions), EPIC-2A (override, assignment), EPIC-2B (doc review) |
| **Email templates (Resend + React Email)** | EPIC-0 STORY-07 (account invite); EPIC-1A STORY-15 (transient confirm); EPIC-2A STORY-43 (transient approve); EPIC-2B STORY-51 (doc reminders) | — |
| **File upload to R2** | EPIC-0 STORY-06 + EPIC-2B STORY-47 | EPIC-2A STORY-35 (map background images) |
| **SVG slip map component** | EPIC-1A STORY-14 (read-only) | EPIC-2A STORY-34 (read-write w/ click handlers) |
| **AppFolio CSV export** | EPIC-3 STORY-58 | None — single-use |
| **Sentry + Vercel logs** | EPIC-0 STORY-08 | All epics |
| **Mock data seeder** | EPIC-1B STORY-18 (Option B) | Staging environment forever |

---

## 6. Spikes / Technical Risks Needing Pre-work

These are time-boxed (≤2 hrs each) investigations that resolve a technical unknown before the affected stories start. They appear inline in the epic story tables above.

| Spike | Resolves | Blocks | Effort |
|---|---|---|---|
| **SPIKE-A: `btree_gist` on Neon** | Verify the extension is available on Neon free + Launch tiers; benchmark a sample EXCLUDE constraint on ~200 rows. | STORY-04 (and all of EPIC-2A booking logic) | 1 hr |
| **SPIKE-B: Auth.js v5 TOTP + magic-link** | Confirm the combined config (admins use email+pw+TOTP, holders use magic-link) works in one Auth.js setup; identify config gotchas. | STORY-05 | 1 hr |
| **SPIKE-C: PDF library choice** | Compare react-pdf (in-app React components → PDF), puppeteer (HTML → PDF, heavyweight), pdfkit (programmatic). Decide based on board-ready aesthetics + Vercel runtime constraints. | STORY-30 (modeler PDF), STORY-54/55/56/57 (report PDFs) | 1 hr |
| **SPIKE-D: SVG polygon editor build vs. buy** | Evaluate react-konva, react-svg-pan-zoom, hand-built. The map has ~86 polygons; need draw + edit + delete. Decide build vs. library. | STORY-35 | 1 hr |

**Spike budget:** 4 hrs total. Run all four in the first week of EPIC-0 so subsequent stories aren't blocked.

---

## 7. Decision Points (Block Specific Stories)

Listed in order of urgency. Each names the stories blocked.

| Decision | Blocks | Default if unresolved | Owner | Target resolution |
|---|---|---|---|---|
| **D1. Phasing — Option A (linear) vs. Option B (modeler-first)** | STORY-18 (mock data layer); changes scope of STORY-17 (production deploy timing) | Option B (per recommendation in §2) | Nick + Linda (15-min conversation) | **Before STORY-01 starts** — by end of week 1 |
| **D2. TOTP for admin auth — required or optional?** | STORY-05 | Required (per architecture §12.1) | Nick | End of week 1 |
| **D3. Q-DOMAIN1 — `wharfsidemarina.com` vs. subdomain** | STORY-17 (DNS + production deploy) | `wharfsidemarina.com` (per architecture §11.2) | Nick + board email | End of EPIC-0 |
| **D4. Q-PRIORITY1 — Booking priority order + offer cadence dates** | STORY-38 (assignment creation flow business rules); STORY-43 (transient queue messaging) | Full-season offers Feb 1 → close Feb 28, half-season opens Mar 1 → close Mar 31, transient opens Apr 1 (sample defaults; need board confirm) | Nick + board | Before EPIC-2A starts (Nov 2026) |
| **D5. Q-DEPOSIT1 — Slot locking / what moves `proposed` → `confirmed`?** | STORY-39 | Slot is `proposed` at admin entry, becomes `confirmed` on admin click (no deposit gate at MVP); board may want a deposit-acceptance gate later | Nick + ECI | Before EPIC-2A starts |
| **D6. Q-TRANSIENT1 — Transient activation trigger (manual / auto / hybrid)** | STORY-43 | Hybrid (Option C: auto-eligibility + ECI review queue before public visibility) | Nick + Kathy | Before EPIC-2A starts |
| **D7. Q-AF1 — AppFolio CSV schema validation** | STORY-58 | Strawman schema in PRD §3.8 | Nick + Kathy (CSV dry-run) | Before EPIC-3 starts (Feb 2027) |
| **D8. Q-RESDISCT1 — Resident discount on transient?** | STORY-19 (resolver logic) | Yes (consistent treatment) | Linda | Before EPIC-1B starts |
| **D9. PDF library choice** | STORY-30 | (from SPIKE-C) | Nick | Week 1 of EPIC-1B |
| **D10. Q-COMP1 — What happens when COI expires?** | STORY-50 (reminder enforcement) | Warning emails only at MVP; no slip suspension | Nick + ECI + Cutolo | Before EPIC-2B starts |

**Decisions D1, D2, D3 are all in the first 2 weeks.** Everything else has more time.

---

## 8. MVP Cut Line

If pace drops to 5 hr/wk and full scope can't ship by April 2027, these stories can be **deferred to Phase 1.5 (post-launch hardening, late 2027)** without breaking the season-1 use case.

### Defer (saves ~60 hrs, brings 290-hr scope to ~230 hrs)

| Story | Why it can wait | Workaround for MVP |
|---|---|---|
| STORY-28 (Compare view) | Linda can open two browser tabs for comparison | None needed |
| STORY-35 (SVG polygon editor) | Polygons can be hand-edited in JSON for MVP | Nick edits JSON for the ~86 slips one-time |
| STORY-42 (Per-slip booking calendar timeline) | Grid view (rows × dates) is sufficient | Use Marina Grid view |
| STORY-44 (Dockmaster mobile lookup) | Kathy can use desktop view on her phone | Acceptable; the responsive admin works mobile-OK |
| STORY-53 (Admin-uploads-on-behalf-of-holder) | Kathy can use the admin doc CRUD directly | Acceptable |
| STORY-57 (Transient + Override reports) | Can run SQL queries directly | Acceptable; reports are quarterly |
| **STORY-30 (PDF export of fee schedule)** | Can export HTML and "Save as PDF" from browser | Linda accepts browser-print PDF for MVP |
| Per-holder impact CSV in STORY-27 | Total revenue is the load-bearing piece | Defer per-holder breakdown to v1.1 |

### Keep (the irreducible MVP for season 1)

- All of EPIC-0 (no foundation, no app)
- All of EPIC-1A except STORY-17 conditional-on-domain (patron site is the public face; can't ship without it)
- STORY-19–STORY-27, STORY-29 (the modeler's core math + state machine + library — the differentiated capability)
- STORY-31, STORY-32, STORY-33, STORY-34, STORY-36, STORY-37, STORY-38, STORY-39, STORY-40, STORY-41, STORY-43 (slip ops core)
- STORY-45–STORY-52 (doc collection — required for Kathy's compliance workflow)
- STORY-54, STORY-55, STORY-56 (the three reports the board reads at every meeting)
- STORY-58 (AppFolio CSV — the integration that makes billing work)
- STORY-59, STORY-60 (onboarding + accessibility)

### Defer-or-skip-entirely

- **Phase 1.5 items from PRD §2.3:** COI parsing, lease-doc parsing, waitlist, bulk season-end ZIP, photo gallery, no-code CMS, auto-trigger transient activation. **None of these are in the MVP plan above.**

---

## 9. Risks & Mitigations (Planning-Specific)

These are risks to the *plan*, not the architecture. Architecture risks are covered in `ARCHITECTURE.md` §16.

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **P1** | Nick's time commitment drops below 5 hr/wk (job, family, board, life) | Medium | High (MVP slips past Spring 2027) | Apply the §8 cut line aggressively. If pace stays low for 4 weeks, kill Option B's mock-data layer (saves 10 hrs) and ship in Option A order. **Re-check pace every 4 weeks.** |
| **P2** | Marina restoration timing delays slip layout finalization beyond Feb 2027 | Medium | Medium | Marina config versioning handles this. Slip-data backfill can be scheduled within the EPIC-3 buffer window (Mar 2027). If restoration delivers post-launch, run pre-restoration config for season 1 and switch in season 2. |
| **P3** | Scope creep ("just one more feature" from board / Linda / Kathy) | Medium-High | High | Every new request reviewed against the §8 cut line. If it's not in the MVP keep-list, it's Phase 1.5. **Nick to print this list and tape it to his monitor.** |
| **P4** | Linda doesn't want modeler until full launch (kills Option B's main reason) | Low-Medium | Medium | If Linda confirms in D1 conversation, fall back to Option A. Saves 30 hrs but loses the Oct 2026 board-demo opportunity. |
| **P5** | Kathy's commitment softens between now and EPIC-2A (Nov 2026) | Low | High | Office Hours flagged this. Mitigation: ship EPIC-1A + EPIC-1B first (Option B). If Kathy disengages, those two ship anyway and ops/doc work becomes optional. |
| **P6** | A spike (SPIKE-A through SPIKE-D) blows up — e.g., `btree_gist` unavailable on Neon free | Low | Medium | All spikes run in week 1. If `btree_gist` fails, app-layer locking is the fallback (architecture mentions it). Adds ~6 hrs to STORY-04 + STORY-38. |
| **P7** | AppFolio CSV dry-run reveals a major schema mismatch in EPIC-3 | Low-Medium | Low-Medium | Mapping is centralized (`lib/appfolio/mapping.ts`). 5-10 hr rework, within the EPIC-3 buffer. Worst case: ship with manual CSV edit step for season 1. |
| **P8** | Holder portal adoption is low → doc upload doesn't happen → compliance dashboard is meaningless | Medium | Low | STORY-53 (admin upload on behalf) covers this. Plan from day 1 that Kathy may upload everything. Portal becomes a nice-to-have, not a requirement. |
| **P9** | A pre-existing service (Resend, Neon, Vercel) changes pricing or limits mid-build | Low | Low | All have free tiers. Budget already has headroom. Switching is possible (architecture §3 has backups for each). |

---

## 10. What "Done" Looks Like

For each phase, the litmus test:

- **EPIC-0 done:** Nick can `git push`, see a Vercel preview deploy, log into it as super_admin with TOTP, and see the admin shell. DB has all tables. Tests pass.
- **EPIC-1A done:** Public site lives at `wharfsidemarina.com`, indexed by Google, and a real transient form submission lands in the DB + emails Kathy + emails the submitter.
- **EPIC-1B done:** Linda clones a scenario, edits 3 rates, sees the projection update, exports a PDF, walks it Draft → Submitted → Approved → Active, and the audit log shows all 4 transitions with her actor + timestamp.
- **EPIC-2A done:** Kathy assigns Joe Petracco to slip 47 for FY27 in <5 clicks, slip-fit passes, the assignment shows on the map and in the booking calendar, and the dockmaster can look it up on his phone.
- **EPIC-2B done:** A holder uploads a COI through the portal, gets a "pending review" status, Kathy approves it, and the holder's badge flips to "Current." A T-60 reminder fires correctly on the cron schedule.
- **EPIC-3 done:** The fee-schedule CSV exports, Kathy imports it into AppFolio successfully (or surfaces the mismatch), and Nick has a runbook he can hand to the next maintainer.

**Project done:** April 2027, Kathy uses the app at least weekly, Linda has run at least one scenario end-to-end, and the AppFolio CSV has driven at least one billing cycle (PRD §10 success criteria).

---

*End of dev plan v1.0. Next step: 15-minute Linda conversation to resolve D1 (phasing), then start EPIC-0 STORY-01.*
