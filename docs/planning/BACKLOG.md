# Wharfside Marina — Issue-Ready Backlog (v1.0)

**Project:** `wharfside-marina`
**Status:** v1.0 — paired with `DEV-PLAN.md`. Each story below is formatted for direct paste into a GitHub issue.
**Author:** Dev Planning specialist (Software Project team)
**Date:** 2026-05-19
**Companion file:** `DEV-PLAN.md` (calendar, phasing, decision points)

**Conventions used in this file:**
- All architecture refs (`ARCH §X`) point to `docs/architecture/ARCHITECTURE.md`.
- All PRD refs (`PRD FR-3.x.y`) point to `docs/requirements/draft-prd-v0.3.md`.
- All UX refs (`UX §X`) point to `docs/ux/UX-SPEC.md`.
- "Dependencies" lists upstream stories that must complete first.

---

# EPIC-0 — Foundation (35 hrs)

## EPIC-0-STORY-01: Bootstrap Next.js 14 App Router + TypeScript + Tailwind
**Epic:** Foundation
**Estimate:** 3 hrs
**Dependencies:** None

### Description
As Nick, I want a fresh Next.js 14 App Router project with TypeScript, Tailwind, ESLint, and Prettier so that subsequent feature work has a clean base.

### Acceptance Criteria
- [ ] `pnpm create next-app` with App Router + TypeScript + Tailwind selected
- [ ] ESLint + Prettier configured with project-standard rules
- [ ] `pnpm dev` runs locally without errors
- [ ] Root layout has the brand color palette (navy `#1a3a5c`, gold `#c9a227`) defined in Tailwind config
- [ ] `.env.example` checked into repo listing all required env vars

### Technical Notes
- ARCH §3.1 (Next.js 14 + TypeScript)
- UX §5.1 (color palette)

### Out of Scope
- Any actual page content (covered in EPIC-1A)
- Any database setup (covered in STORY-02)

---

## EPIC-0-STORY-02: Set up Neon Postgres + Drizzle + first migration
**Epic:** Foundation
**Estimate:** 4 hrs
**Dependencies:** STORY-01

### Description
As Nick, I want a Neon Postgres database (production branch + dev branch) connected to the Next.js app via Drizzle ORM so that I can write typed queries and manage migrations.

### Acceptance Criteria
- [ ] Neon project created with `production` and `dev` branches
- [ ] Connection strings stored in Vercel env + local `.env.local`
- [ ] Drizzle ORM + `drizzle-kit` installed and configured
- [ ] `drizzle.config.ts` points at the right DB
- [ ] First migration (empty schema) generated, applied, and committed
- [ ] `pnpm db:generate` and `pnpm db:migrate` scripts work locally and in CI

### Technical Notes
- ARCH §3.3 (Neon Postgres), ARCH §3.6 (Drizzle)
- ARCH ADR-006 (Drizzle decision)

### Out of Scope
- Any actual table definitions (covered in STORY-03)
- Schema migration strategy beyond the first migration

---

## EPIC-0-STORY-03: Create core schema (marina_config, slip, holder, vessel, assignment, document, fee_schedule, scenario, audit_log, app_user, auth_session)
**Epic:** Foundation
**Estimate:** 6 hrs
**Dependencies:** STORY-02

### Description
As Nick, I want all core tables defined in Drizzle so that subsequent feature stories can reference them without scope creep.

### Acceptance Criteria
- [ ] All 11 tables defined per ARCH §4 schemas
- [ ] All foreign keys and CHECK constraints in place
- [ ] All unique indexes (one_active_config, one_active_schedule)
- [ ] `document` table has the XOR `(holder_id IS NOT NULL) + (vessel_id IS NOT NULL) = 1` CHECK
- [ ] `holder` includes residency-lock fields (`residency_state_locked_at`, `residency_state_for_season_year`, `lease_doc_id`) and 4-state enum (`resident_owner`, `resident_renter`, `non_resident_owner`, `non_resident`)
- [ ] Drizzle migration applied to dev branch successfully
- [ ] Generated TypeScript types are exported from `lib/db/schema.ts`

### Technical Notes
- ARCH §4 (full schema)
- PRD §3.2 (holder model — 4 states + residency lock)

### Out of Scope
- Exclusion constraint on `assignment` (covered in STORY-04)
- Seed data (covered in STORY-09)

---

## EPIC-0-STORY-04: Postgres `EXCLUDE USING gist` constraint on assignment + `btree_gist` extension
**Epic:** Foundation
**Estimate:** 3 hrs
**Dependencies:** STORY-03, SPIKE-A

### Description
As Nick, I want the booking exclusion constraint enforced at the database level so that no two assignments can overlap on the same slip — regardless of app-layer bugs.

### Acceptance Criteria
- [ ] `btree_gist` extension enabled on the Neon production + dev branches
- [ ] `daterange` GENERATED column on `assignment`
- [ ] `EXCLUDE USING gist (slip_id WITH =, daterange WITH &&) WHERE (status IN ('proposed','confirmed'))` constraint added
- [ ] Integration test: attempting to insert an overlapping confirmed assignment raises a constraint violation error
- [ ] Integration test: a `canceled` assignment does NOT block a new overlapping assignment

### Technical Notes
- ARCH §5.2 (the hard constraint)
- ARCH §5.6 (cancellation behavior)
- SPIKE-A must confirm btree_gist availability first

### Out of Scope
- The app-side slip-fit check (covered in STORY-40)
- The assignment creation UI (covered in STORY-38)

---

## EPIC-0-STORY-05: Configure Auth.js v5 — magic-link (holders) + email/password + TOTP (admins)
**Epic:** Foundation
**Estimate:** 6 hrs
**Dependencies:** STORY-03, SPIKE-B

### Description
As Nick, I want a single Auth.js setup that supports both magic-link (for holders) and email+password+TOTP (for admins) so that the right factor is used per role.

### Acceptance Criteria
- [ ] Auth.js v5 installed and configured with the Drizzle adapter
- [ ] Magic-link provider configured with Resend
- [ ] Credentials provider with bcrypt/argon2 + TOTP enrollment for admin role
- [ ] `auth()` helper returns `{ user, role }` in server components and server actions
- [ ] Middleware enforces role: `/admin/*` requires `super_admin`/`eci_admin`/`board`; `/holder/*` requires `holder`
- [ ] Sign-in pages: `/sign-in` (admin) and `/holder/sign-in` (magic-link)
- [ ] First super_admin (Nick) seeded via a one-time script

### Technical Notes
- ARCH §9 (auth + roles)
- ARCH §12.1 (auth security: TOTP, rate limits, session lifetime)
- SPIKE-B resolves the TOTP + magic-link combined-config approach

### Out of Scope
- Holder portal pages (EPIC-2B)
- Admin onboarding flow beyond the initial super_admin (EPIC-2A)

---

## EPIC-0-STORY-06: Set up Cloudflare R2 bucket + signed-URL upload/download helpers
**Epic:** Foundation
**Estimate:** 3 hrs
**Dependencies:** STORY-01

### Description
As Nick, I want an R2 bucket configured with signed-URL upload (PUT) and download (GET) helpers so that document and map-background uploads work securely.

### Acceptance Criteria
- [ ] Cloudflare R2 bucket created
- [ ] API credentials stored in Vercel env
- [ ] `lib/r2/upload.ts` — server action that issues a signed PUT URL (15-min expiry)
- [ ] `lib/r2/download.ts` — server action that issues a signed GET URL (5-min expiry)
- [ ] CORS configured on the bucket to allow uploads from the production + preview domains
- [ ] Manual smoke test: upload a 1MB PDF via signed PUT, retrieve via signed GET

### Technical Notes
- ARCH §3.5 (R2 choice)
- ARCH §12.3 (signed URL expirations)

### Out of Scope
- Document upload UI (STORY-47)
- Virus scanning (Phase 1.5)

---

## EPIC-0-STORY-07: Set up Resend + first transactional email template (account invite)
**Epic:** Foundation
**Estimate:** 2 hrs
**Dependencies:** STORY-01

### Description
As Nick, I want Resend configured with a React Email-based template library so that all subsequent transactional emails share one branded shell.

### Acceptance Criteria
- [ ] Resend account + API key configured
- [ ] Sender domain `wharfsidemarina.com` verified (SPF/DKIM)
- [ ] React Email installed
- [ ] First template: "Account Invite" with magic-link first-login URL
- [ ] `lib/email/send.ts` helper takes `{ to, template, props }` and dispatches via Resend
- [ ] Smoke test: send an invite to a test address and confirm delivery

### Technical Notes
- ARCH §3.6 (Resend choice)

### Out of Scope
- Reminder templates (STORY-51)
- Transient confirmation template (STORY-15, STORY-43)

---

## EPIC-0-STORY-08: GitHub Actions CI + Vercel preview deploys
**Epic:** Foundation
**Estimate:** 3 hrs
**Dependencies:** STORY-01

### Description
As Nick, I want every PR to run lint + typecheck + test in GitHub Actions and produce a Vercel preview deploy so that I always have a working URL to validate changes.

### Acceptance Criteria
- [ ] `.github/workflows/ci.yml` runs `pnpm lint && pnpm typecheck && pnpm test` on every PR
- [ ] Vercel project linked to the GitHub repo
- [ ] Preview deploy URL posted to PR conversations
- [ ] `main` branch auto-deploys to production
- [ ] Sentry SDK integrated; errors from preview + production both reach Sentry's free tier
- [ ] Dependabot enabled for npm + GitHub Actions

### Technical Notes
- ARCH §11.4 (CI/CD)
- ARCH §11.5 (monitoring)

### Out of Scope
- Production domain DNS (STORY-17)

---

## EPIC-0-STORY-09: Seed script — minimal user fixtures + smoke-test data
**Epic:** Foundation
**Estimate:** 3 hrs
**Dependencies:** STORY-03, STORY-05

### Description
As Nick, I want a `pnpm db:seed` script that creates a super_admin (me), one eci_admin (Kathy stub), one board user (Linda stub), and a small fixture set so that I can smoke-test auth + role middleware from day one.

### Acceptance Criteria
- [ ] `scripts/seed.ts` creates 4 users (one per role)
- [ ] One sample `marina_config` row with 3 sample slips
- [ ] One sample holder per state (4 holders)
- [ ] Idempotent — running twice doesn't error
- [ ] Script clearly distinguishes between dev-only seed and prod-safe seed

### Technical Notes
- Seed data is NOT the modeler's mock data (that's STORY-18)
- ARCH §9.3 (admin onboarding)

### Out of Scope
- The 86-slip mock dataset for the modeler (STORY-18)

---

# EPIC-1A — Patron Site + Public Transient Form (35 hrs)

## EPIC-1A-STORY-10: Public layout shell — nav, footer, branded color palette + typography
**Epic:** Patron Site
**Estimate:** 4 hrs
**Dependencies:** STORY-01

### Description
As a public visitor, I want a consistent header, navigation, and footer so that the site feels like one professional marina, not a collection of pages.

### Acceptance Criteria
- [ ] Top nav (52px height) with logo + links to Rules / Map / Forms / Contact + Login button on the right
- [ ] Footer with rules, forms, contact, privacy, copyright
- [ ] Source Serif Pro for headings; Inter for body; loaded from Google Fonts or self-hosted
- [ ] Navy `#1a3a5c` + gold `#c9a227` + sand `#e8dcc4` + paper `#fafaf7` applied
- [ ] WCAG 2.1 AA contrast on all text + nav items
- [ ] Mobile responsive: nav collapses to hamburger on <768px

### Technical Notes
- UX §5.1 (color palette), UX §5.2 (typography)

### Out of Scope
- Per-page content (STORY-11 onward)

---

## EPIC-1A-STORY-11: `/` home page — hero, "I'm here to..." cards, quick info, NOAA embed
**Epic:** Patron Site
**Estimate:** 5 hrs
**Dependencies:** STORY-10

### Description
As a public visitor landing on `wharfsidemarina.com`, I want a clear hero image and 4-6 "I'm here to..." cards so that I can find what I need in two clicks.

### Acceptance Criteria
- [ ] Hero with marina photograph (placeholder OK at MVP) + name + location
- [ ] Six action cards: Rules · Map · Forms · FAQ · Contact · Request a Slip
- [ ] "Quick info" section: VHF channel, ECI phone, after-hours emergency
- [ ] NOAA tide chart embed for nearest Shrewsbury River station (loads async, doesn't block page)
- [ ] SSG-rendered; <2s load on 4G mobile
- [ ] WCAG 2.1 AA passes

### Technical Notes
- UX §4.7 (homepage wireframe)
- PRD §3.9 (patron site)

### Out of Scope
- Photo gallery (Phase 1.5)
- News/notices CMS (Phase 1.5)

---

## EPIC-1A-STORY-12: `/rules` page — WMCA Handbook content rendered with TOC
**Epic:** Patron Site
**Estimate:** 4 hrs
**Dependencies:** STORY-10

### Description
As a public boater, I want the marina rules in a readable web format with a table of contents so that I can find VHF / hailing / fueling info quickly.

### Acceptance Criteria
- [ ] Rules content lifted from WMCA Handbook §Marina Area into Markdown
- [ ] Markdown rendered with TOC sidebar (desktop) / collapsible TOC (mobile)
- [ ] Headings anchor-linked
- [ ] Print stylesheet so boaters can print a copy
- [ ] WCAG 2.1 AA passes; body text ≥16px

### Technical Notes
- PRD §3.9 (rules content from WMCA Handbook)

### Out of Scope
- CMS editing (Phase 1.5)
- PDF download of the rules (covered by STORY-13's Forms library if relevant)

---

## EPIC-1A-STORY-13: `/emergency` + `/contact` + `/faq` + `/services` + `/forms` pages
**Epic:** Patron Site
**Estimate:** 5 hrs
**Dependencies:** STORY-10

### Description
As a public visitor, I want pages for emergency procedures, contact info, FAQ, local services, and a forms library so that I have one canonical place for marina-adjacent information.

### Acceptance Criteria
- [ ] `/emergency` — fire / medical / USCG / storm prep procedures; ECI + after-hours numbers prominent
- [ ] `/contact` — ECI office, dockmaster, after-hours emergency; tap-to-call links on mobile
- [ ] `/faq` — pets, smoking, generators, dinghy storage, garbage/recycling locations
- [ ] `/services` — local fuel, pump-out, ice, repairs, provisioning, restaurants
- [ ] `/forms` — downloadable PDFs (slip application, indemnification, gate-key request, transient request); links point to R2-hosted PDFs
- [ ] All pages SSG-rendered; pass WCAG 2.1 AA

### Technical Notes
- PRD §3.9 (patron site pages)

### Out of Scope
- Restoration status page (skip unless requested)
- Photo gallery (Phase 1.5)

---

## EPIC-1A-STORY-14: `/map` page — read-only SVG slip map
**Epic:** Patron Site
**Estimate:** 5 hrs
**Dependencies:** STORY-10

### Description
As a public visitor, I want to see the marina layout so that I can find my friend's slip or evaluate the marina before requesting a transient slip.

### Acceptance Criteria
- [ ] SVG marina diagram with slip polygons rendered (read-only, no click handlers showing assignment data)
- [ ] Slip numbers labeled on hover
- [ ] Background image (PNG/SVG marina diagram) loads from R2 or `/public/`
- [ ] Mobile-responsive: pinch-zoom enabled
- [ ] No login required; no assignment data exposed publicly

### Technical Notes
- ARCH §3.8 (HTML/SVG maps)
- UX §4.2 + §4.7 (map design)
- Shared SVG component reused by EPIC-2A STORY-34 (admin map)

### Out of Scope
- Click-to-detail (admin only — STORY-34)
- Marker for "available transient slips" (Phase 2+ public widget)

---

## EPIC-1A-STORY-15: `/transient` public form + server action + confirmation emails
**Epic:** Patron Site
**Estimate:** 5 hrs
**Dependencies:** STORY-10, STORY-07, STORY-03

### Description
As a visiting boater, I want to submit a transient slip request without an account so that ECI knows I want to visit.

### Acceptance Criteria
- [ ] Public form at `/transient`: name, email, phone, vessel name, LOA/beam/draft, arrival/departure dates, purpose, rules-acknowledgment checkbox
- [ ] Required fields validated client + server side (Zod)
- [ ] Submission writes a `transient_request` row with `status='pending'`
- [ ] Confirmation page: "Request received. We'll respond within 24 hours."
- [ ] Confirmation email to the requester (via Resend)
- [ ] Notification email to Kathy (Resend)
- [ ] Rate-limit: max 5 submissions per IP per hour (Upstash Rate Limit)
- [ ] Mobile-first design; WCAG 2.1 AA

### Technical Notes
- PRD FR-3.4.1, FR-3.9.2
- UX §4.6 (form wireframe)

### Out of Scope
- ECI queue review (STORY-43)
- Approval workflow + slip assignment (STORY-43)
- COI upload link with 48h expiration (STORY-43)

---

## EPIC-1A-STORY-16: SEO — sitemap.xml + robots.txt + metadata API + JSON-LD
**Epic:** Patron Site
**Estimate:** 3 hrs
**Dependencies:** All STORY-10 through STORY-15

### Description
As Nick, I want the patron site indexed by Google as soon as it's live so that "Wharfside Marina rules" returns this site within 90 days.

### Acceptance Criteria
- [ ] `app/sitemap.ts` generates sitemap.xml for all public routes
- [ ] `app/robots.ts` generates robots.txt allowing all crawlers
- [ ] Next.js metadata API populated on every public page (title, description, OpenGraph image)
- [ ] JSON-LD `LocalBusiness` + `Marina` on `/`
- [ ] Google Search Console verified (manual step, documented)
- [ ] Bing Webmaster Tools verified (manual step, documented)

### Technical Notes
- ARCH §8.3 (SEO targets)

### Out of Scope
- Active link-building / outreach
- Analytics dashboards beyond Vercel Analytics free tier

---

## EPIC-1A-STORY-17: Domain + DNS setup + production deploy
**Epic:** Patron Site
**Estimate:** 2 hrs
**Dependencies:** STORY-16, D3 resolved

### Description
As Nick, I want the production site live at the chosen domain so that the patron site is publicly accessible.

### Acceptance Criteria
- [ ] Domain purchased (e.g., `wharfsidemarina.com`) — pending D3 resolution
- [ ] DNS A/CNAME records pointing at Vercel
- [ ] TLS auto-provisioned by Vercel
- [ ] Production deploy succeeds; site reachable at https://wharfsidemarina.com
- [ ] Redirect from `www` to apex (or vice versa, per convention)
- [ ] **CONDITIONAL on Option B:** site is publicly launched at this point even though authed app is still in development

### Technical Notes
- ARCH §11.2 (domain + SSL)
- D3 in DEV-PLAN.md §7

### Out of Scope
- Branding final review (depends on Q-BRAND1)

---

# EPIC-1B — Pricing Modeler (60 hrs)

## EPIC-1B-STORY-18: Mock data seed — 86 slips + 50 assignments + 1 Active fee schedule
**Epic:** Pricing Modeler
**Estimate:** 4 hrs
**Dependencies:** STORY-03, STORY-09

### Description
As Linda (Option B early-ship user), I want realistic-looking mock data loaded so that I can use the modeler in Oct 2026 even though real slip-ops data won't exist until EPIC-2A is done.

### Acceptance Criteria
- [ ] `scripts/seed-mock-data.ts` creates 86 slips across Premium / Standard / Restricted tiers per a JSON config file
- [ ] 50 assignments (mix of FULL_SEASON / HALF_SEASON_1 / HALF_SEASON_2) for season 2027 against 4 sample holders per holder state (16 holders total)
- [ ] One Active fee schedule with PRD §3.6.1 seed defaults
- [ ] Mock data is clearly marked: holder names prefixed with `[MOCK]` so production data is distinguishable
- [ ] Idempotent — running twice clears prior mock data
- [ ] **Option A only:** This story is dropped from scope; modeler uses whatever real data exists.

### Technical Notes
- DEV-PLAN.md §2 (Option B mock-data layer)
- PRD §3.6.1 (seed defaults)

### Out of Scope
- Production data import from AppFolio (STORY-60 buffer / data backfill)

---

## EPIC-1B-STORY-19: Pure-function `resolveFee()` — all 4 holder states × 4 lease types × 3 slip tiers
**Epic:** Pricing Modeler
**Estimate:** 6 hrs
**Dependencies:** STORY-03

### Description
As Nick, I want a deterministic, pure-function pricing resolver so that the Active engine and the Scenario Modeler use the same code path with different `fee_schedule_id` inputs.

### Acceptance Criteria
- [ ] `lib/pricing/resolve.ts` exports `resolveFee(holder, slip, leaseType, feeSchedule, season): { total, lineItems }`
- [ ] Handles all 4 holder states (resident_owner, resident_renter, non_resident_owner, non_resident) — resident states get the resident multiplier
- [ ] Handles all 4 lease types (FULL_SEASON, HALF_SEASON_1, HALF_SEASON_2, TRANSIENT)
- [ ] Handles 3 slip tiers (Premium / Standard / Restricted) with `fee_modifier`
- [ ] Amenity fee + buy-in stacking per PRD §3.6.1
- [ ] Transient = LOA × per-foot-per-night × nights
- [ ] Unit tests cover ≥20 scenario combinations including edge cases (zero LOA, missing multiplier, etc.)
- [ ] `schema_version` field on `fee_schedule.base_config` for future model variants

### Technical Notes
- ARCH §7.1, §7.2, §7.3 (resolver)
- PRD FR-3.6.1.2, PRD §3.6.1 (charge component matrix)
- D8 (resident discount on transient) resolution affects this

### Out of Scope
- CSV export (STORY-58)
- Per-holder impact aggregation (STORY-27)

---

## EPIC-1B-STORY-20: Active Fee Schedule read-only view
**Epic:** Pricing Modeler
**Estimate:** 3 hrs
**Dependencies:** STORY-19

### Description
As Linda or Kathy, I want to view the currently-Active fee schedule with every component visible so that I know what's being billed today.

### Acceptance Criteria
- [ ] Page at `/admin/pricing/active`
- [ ] Renders all components: base rates by tier, holder multipliers, lease-type multipliers, transient $/ft/night, amenity fee, buy-in, premium surcharge
- [ ] Shows `approval_reference` (source email/minutes) and `activated_at` timestamp
- [ ] "Model a scenario from this" button top-right
- [ ] Read-only — no edit affordances

### Technical Notes
- PRD FR-3.6.1.1
- UX §4.1 (modeler entry point)

### Out of Scope
- Scenario creation (STORY-21)

---

## EPIC-1B-STORY-21: "Model a scenario from this" — clone Active → new draft scenario
**Epic:** Pricing Modeler
**Estimate:** 3 hrs
**Dependencies:** STORY-20

### Description
As Linda, I want to clone the Active fee schedule into a new Draft scenario in one click so that I can edit a hypothetical without touching production.

### Acceptance Criteria
- [ ] Click "Model a scenario from this" → server action creates a new `fee_schedule` row with `state='draft'`, `base_config` copied from Active
- [ ] Linked `scenario` row created with default name "Untitled draft"
- [ ] User redirected to `/admin/pricing/scenarios/[id]/edit`
- [ ] Toast confirms scenario creation
- [ ] Audit log entry `scenario.create`

### Technical Notes
- ARCH §4.1 (scenario model)
- UX Flow A step 2-3

### Out of Scope
- Editing the matrix (STORY-22)

---

## EPIC-1B-STORY-22: Rate matrix editor — Excel-style keyboard nav + inline edit
**Epic:** Pricing Modeler
**Estimate:** 8 hrs
**Dependencies:** STORY-21

### Description
As Linda, I want to edit the rate matrix with Excel-style keyboard navigation so that the tool feels at least as fast as the Excel I'm replacing.

### Acceptance Criteria
- [ ] 3-row (Premium / Standard / Restricted) × 3-column (Full / Half-1 / Half-2) grid
- [ ] Click cell → inline edit input appears with current value
- [ ] Enter commits + moves down; Tab commits + moves right; Esc cancels; arrows navigate
- [ ] Sticky row + column headers
- [ ] Tabular-numeral font (JetBrains Mono) on cells
- [ ] Edits update local state immediately; server save happens via STORY-26 autosave
- [ ] Transient $/ft/night editor (3 rows, 1 column) below the main grid
- [ ] Validation: blank or negative values turn cell soft red

### Technical Notes
- UX §4.1.1 (rate matrix wireframe)
- UX §4.1.3 (validation micro-states)

### Out of Scope
- Live recalc + autosave (STORY-26)
- Other component editors (STORY-23, STORY-24)

---

## EPIC-1B-STORY-23: Holder multipliers + amenity fee + buy-in editors
**Epic:** Pricing Modeler
**Estimate:** 3 hrs
**Dependencies:** STORY-22

### Description
As Linda, I want to edit the holder multipliers, amenity fee, and buy-in below the matrix so that I can model resort-fee structures and resident discount variants.

### Acceptance Criteria
- [ ] Resident multiplier (decimal input, default 0.75)
- [ ] Non-resident multiplier (decimal input, default 1.00) — applies to both non-resident states
- [ ] Amenity fee: amount + toggles "Applies to non-residents" / "Applies to residents (waived per HOA)"
- [ ] Buy-in: amount + "Applies to" multi-select (resident_owner, resident_renter, non_resident_owner, non_resident)
- [ ] All edits update local state + trigger recalc via STORY-26

### Technical Notes
- PRD §3.6.1 (charge components)
- UX §4.1.1 (sections)

### Out of Scope
- Season-date overrides (STORY-24)

---

## EPIC-1B-STORY-24: Season-date override editor (start, end, half-split)
**Epic:** Pricing Modeler
**Estimate:** 3 hrs
**Dependencies:** STORY-22

### Description
As Linda, I want to model "What if we open 2 weeks earlier?" by overriding the season start/end and half-split dates on a scenario so that I can quantify revenue impact of calendar changes.

### Acceptance Criteria
- [ ] Season dates editor in the rate matrix area: start date, end date, half-split date
- [ ] Overrides stored in `scenario.season_overrides` JSONB
- [ ] If unset, Marina Configuration defaults apply
- [ ] Changing dates triggers projection recalc via STORY-26
- [ ] Resolver `resolveFee()` accepts a `season` parameter that reads from scenario overrides first, then Marina Config

### Technical Notes
- PRD FR-3.6.2.4 (season-date variance modeling)
- ARCH §4.1 (scenario.season_overrides)

### Out of Scope
- Marina Config editor itself (STORY-33)

---

## EPIC-1B-STORY-25: Right-pane projection — total + delta + by-holder-type bar + by-lease-type bar
**Epic:** Pricing Modeler
**Estimate:** 5 hrs
**Dependencies:** STORY-19, STORY-22

### Description
As Linda, I want a live projection panel showing total projected revenue, the delta vs. Active, and breakdowns so that I see the impact of every edit immediately.

### Acceptance Criteria
- [ ] Right pane (40% width on desktop) sticky to header on scroll
- [ ] Topline card: projected revenue (large), delta vs. Active in green/red with arrow
- [ ] Horizontal stacked bar: revenue by holder type (resident_owner, resident_renter, non_resident_owner, non_resident, transient guest)
- [ ] Horizontal stacked bar: revenue by lease type (full / half / transient)
- [ ] Occupancy assumptions section: editable percentages (full season %, half-1 %, half-2 %, transient avg nights/yr)
- [ ] All projections computed via `resolveFee()` applied across all current assignments + occupancy assumptions

### Technical Notes
- UX §4.1.1 (projection wireframe)
- ARCH §7.4 (scenario projection function)

### Out of Scope
- Per-holder impact (STORY-27)
- Compare view (STORY-28)

---

## EPIC-1B-STORY-26: Live recalc with ~250ms debounce + autosave drafts every 5s
**Epic:** Pricing Modeler
**Estimate:** 4 hrs
**Dependencies:** STORY-22, STORY-25

### Description
As Linda, I want the projection to update ~250ms after I stop typing and my draft to autosave every 5s so that editing feels Excel-fluent without losing work.

### Acceptance Criteria
- [ ] Cell edit → 250ms debounce → recalc fires → right pane updates
- [ ] Delta header pulses green/red briefly on change (300ms)
- [ ] Autosave fires every 5s if there are unsaved local edits
- [ ] Footer pip shows "Saving…" → "Saved [time ago]"
- [ ] On network failure: keep edits in browser local storage; banner "Couldn't save — [Retry]"
- [ ] Optimistic concurrency: if scenario is open in two tabs, second tab shows yellow banner "Another session is editing this scenario"

### Technical Notes
- UX §4.1.1 (live recalc), UX §8.1 (optimistic UI), UX §8.3 (save-state indicators)
- Confirm 250ms debounce with Linda (open design Q #1)

### Out of Scope
- Compare view (STORY-28)

---

## EPIC-1B-STORY-27: Per-holder impact view — sortable table + CSV export
**Epic:** Pricing Modeler
**Estimate:** 5 hrs
**Dependencies:** STORY-25, STORY-19

### Description
As Linda, I want to see how this scenario affects each individual slip-holder so that I can answer "who pays more" without VLOOKUP gymnastics.

### Acceptance Criteria
- [ ] Collapsed by default; "► Show per-holder impact (86)" expands it
- [ ] Table: holder name · current fee · scenario fee · delta · delta %
- [ ] Sortable by any column
- [ ] Click holder name → slide-over with full line-item breakdown
- [ ] CSV export button — downloads all rows
- [ ] Excluded holders flagged (e.g., transient guests appear as a separate footer row)

### Technical Notes
- UX §4.1.1 (per-holder impact spec)
- UX §4.1.2 ("Excel-killer feature")

### Out of Scope
- Email this view to the board (out — PDF is the export channel)

---

## EPIC-1B-STORY-28: Compare view — Active vs. Scenario A vs. Scenario B 3-column inline
**Epic:** Pricing Modeler
**Estimate:** 4 hrs
**Dependencies:** STORY-25

### Description
As Linda, I want to compare two scenarios side-by-side with the Active baseline so that I can quickly evaluate alternatives.

### Acceptance Criteria
- [ ] "Compare ▾" button in header → modal lets Linda pick a second scenario or "no comparison"
- [ ] On select → inline 3-column compare strip renders below the matrix
- [ ] Per-component rows highlighted where values differ
- [ ] Per-holder delta exportable to CSV
- [ ] Can close compare to return to single-scenario view

### Technical Notes
- PRD FR-3.6.2.3
- UX §4.1.2 (compare moment)

### Out of Scope
- Side-by-side dedicated page (deferred per UX open Q #3)

---

## EPIC-1B-STORY-29: Scenario library + state machine (Draft → Submitted → Approved → Active → Archived)
**Epic:** Pricing Modeler
**Estimate:** 6 hrs
**Dependencies:** STORY-21, STORY-22

### Description
As Linda, I want to walk a scenario through Draft → Submitted → Approved → Active so that the workbook respects the board's approval process and every state change is audited.

### Acceptance Criteria
- [ ] `/admin/pricing/scenarios` library list: sortable by date, state, projected revenue, owner; archive (not delete) button
- [ ] In-scenario state-machine actions: Submit for Approval, Mark Approved, Promote to Active, Archive
- [ ] State transitions write audit log with actor + timestamp + free-text note + (for Approve) `approval_reference`
- [ ] Submitted, Approved, Active, Archived all lock editing
- [ ] "Promote to Active" requires typing "APPROVED" to confirm; archives the prior Active
- [ ] Only one scenario in Active state at any time (unique partial index)
- [ ] State badge in header: Draft (gray) · Submitted (blue) · Approved (green) · Active (gold) · Archived (slate)

### Technical Notes
- PRD §3.6.4 (state machine)
- UX Flow A steps 11-14
- UX §4.1.1 (state badges + primary-action conditional)

### Out of Scope
- PDF export (STORY-30)

---

## EPIC-1B-STORY-30: PDF export of fee schedule (Wharfside-branded)
**Epic:** Pricing Modeler
**Estimate:** 5 hrs
**Dependencies:** STORY-22, STORY-25, SPIKE-C

### Description
As Linda, I want a one-click branded PDF of the scenario suitable for emailing to the board so that approval out-of-band is easy.

### Acceptance Criteria
- [ ] "Export PDF" button in scenario header
- [ ] PDF includes: Wharfside logo + scenario name + projected revenue summary + component breakdown + scenario state + watermark "DRAFT — not yet board-approved" if state=Draft
- [ ] Filename: `wharfside-[scenario-name]-[state]-[YYYY-MM-DD].pdf`
- [ ] Generated server-side via the library chosen in SPIKE-C
- [ ] Download starts within 3s of click
- [ ] Audit log entry `scenario.export_pdf`

### Technical Notes
- PRD FR-3.6.4.2
- UX Flow A step 9

### Out of Scope
- CSV export of billable line items (STORY-58)

---

# EPIC-2A — Slip Operations (60 hrs)

## EPIC-2A-STORY-31: Marina Config CRUD — versioning, clone, activate
**Epic:** Slip Operations
**Estimate:** 5 hrs
**Dependencies:** STORY-03

### Description
As Kathy, I want to create a new marina configuration version (e.g., post-restoration) by cloning slips from the prior version so that I can prepare the new layout without disturbing the current active version.

### Acceptance Criteria
- [ ] `/admin/marina-config` list of all versions with status (active / draft / archived)
- [ ] "New version" button → create with name + effective_date + clone-from option
- [ ] Activate button → atomic swap (set prior active to archived; set this to active); only one active enforced by unique partial index
- [ ] Cannot delete a version with assignments — only archive
- [ ] Audit log on create / activate

### Technical Notes
- ARCH §4 (marina_config schema, `one_active_config` index)
- PRD FR-3.1.1, FR-3.1.4

### Out of Scope
- Slip editing (STORY-32)
- Visual map editor (STORY-35)

---

## EPIC-2A-STORY-32: Slip CRUD — attributes + audit
**Epic:** Slip Operations
**Estimate:** 4 hrs
**Dependencies:** STORY-31

### Description
As Kathy, I want to add/edit slip attributes (LOA limit, beam limit, depth, tier, amenities, fee_modifier, status) on the active or future config so that the slip inventory reflects reality.

### Acceptance Criteria
- [ ] Slip list per config version: searchable, sortable
- [ ] Edit form: slip_number, position_polygon (JSON for MVP if STORY-35 deferred), loa_limit_ft, beam_limit_ft, min_depth_at_mlw_ft, slip_type, amenities, status, tier, fee_modifier, notes
- [ ] Edit on active version requires admin justification ≥20 chars if assignments exist
- [ ] Audit log on every change (before/after)
- [ ] Bulk import via CSV (admin paste)

### Technical Notes
- PRD FR-3.1.2

### Out of Scope
- Visual polygon editor (STORY-35)

---

## EPIC-2A-STORY-33: Marina Config season params editor
**Epic:** Slip Operations
**Estimate:** 3 hrs
**Dependencies:** STORY-31

### Description
As Kathy or Linda, I want to edit the per-season parameters (start, end, half-split, lock date, defaults) so that season variations are first-class and modelable.

### Acceptance Criteria
- [ ] Form: season_year, season_start_date, season_end_date, half_season_split_date, residency_lock_date, default_resident_discount_mode + value, default_half_season_pricing_mode + value, notes
- [ ] Edits before `residency_lock_date` are free; edits after require ≥20-char justification + audit log
- [ ] Half-split defaults to midpoint of [start, end] with manual override allowed
- [ ] Values flow through to `resolveFee()` via the season parameter

### Technical Notes
- PRD §3.1.A, PRD FR-3.1.5

### Out of Scope
- Modeling overrides per scenario (STORY-24)

---

## EPIC-2A-STORY-34: SVG slip map renderer with click-to-detail panel
**Epic:** Slip Operations
**Estimate:** 6 hrs
**Dependencies:** STORY-32

### Description
As Kathy, I want to see the marina as a clickable map with a side panel for each slip's details so that I can navigate by location instead of slip number.

### Acceptance Criteria
- [ ] `/admin/slip-board` renders the active config's slips as SVG polygons over a PNG background
- [ ] Color coded by status: Available / Full / Half / Transient / OOS per UX §4.2 palette
- [ ] Click a slip → right-side detail panel slides in (380px) with slip attributes + current assignment + booking calendar + assignment history + edit buttons
- [ ] Click another slip → panel updates (stays open)
- [ ] Click map background → panel collapses
- [ ] Hover tooltip: status, holder name, vessel name
- [ ] Map | Grid toggle (Grid view is a sortable table — same data, no map)
- [ ] Global `/` search highlights matching slip

### Technical Notes
- ARCH §3.8 (SVG maps)
- UX §4.2 (slip map wireframe)
- PRD FR-3.1.3

### Out of Scope
- Polygon drawing/editing (STORY-35)
- Drag-and-drop assignment (Phase 1.5)

---

## EPIC-2A-STORY-35: SVG polygon editor (admin draws slip polygons)
**Epic:** Slip Operations
**Estimate:** 8 hrs
**Dependencies:** STORY-34, SPIKE-D

### Description
As Kathy, I want to draw and edit slip polygons over a background image so that the map reflects post-restoration changes without Nick editing JSON by hand.

### Acceptance Criteria
- [ ] Admin upload of background image (PNG/SVG) to R2 per config version
- [ ] Drawing mode: click points → polygon → assign to a slip
- [ ] Edit mode: drag vertices, delete polygon, re-assign to a slip
- [ ] Polygon coordinates saved to `slip.position_polygon` JSONB
- [ ] Save button persists all changes in one transaction
- [ ] Audit log on save
- [ ] **CONDITIONAL** — may be cut per MVP cut line (§8) if pace drops

### Technical Notes
- SPIKE-D resolves build vs. library
- DEV-PLAN.md §8 (cut line candidate)

### Out of Scope
- Snap-to-grid (Phase 1.5)
- Multi-polygon undo/redo (Phase 1.5)

---

## EPIC-2A-STORY-36: Holder CRUD — 4 states + residency lock + lease_doc_id
**Epic:** Slip Operations
**Estimate:** 5 hrs
**Dependencies:** STORY-03

### Description
As Kathy, I want to add, edit, and deactivate holders across all 4 states with the right validations so that the holder database matches Wharfside's lease-pricing reality.

### Acceptance Criteria
- [ ] Holder list at `/admin/holders` with filter by state + status + search by name/slip/vessel/unit
- [ ] New/edit form fields per PRD §3.2.B
- [ ] State-conditional validation: resident_owner / resident_renter / non_resident_owner require `wharfside_unit_number`; resident_renter additionally requires `lease_doc_id`
- [ ] Snapshot action on `residency_lock_date`: writes `residency_state_locked_at` + `residency_state_for_season_year` for all active holders
- [ ] Cannot delete — only deactivate (preserve assignment history)
- [ ] Mid-season state override requires ≥20-char justification + audit log
- [ ] "Residency Watch" view (FR-3.2.5) lists resident_renter holders whose lease expires before season_end_date

### Technical Notes
- PRD §3.2.A, §3.2.B, FR-3.2.1, FR-3.2.4, FR-3.2.5

### Out of Scope
- Holder self-editing (STORY-46)
- Lease doc upload (STORY-47)

---

## EPIC-2A-STORY-37: Vessel CRUD (1:N per holder)
**Epic:** Slip Operations
**Estimate:** 2 hrs
**Dependencies:** STORY-36

### Description
As Kathy, I want to add multiple vessels per holder so that holders with more than one boat are modeled correctly.

### Acceptance Criteria
- [ ] Vessel list nested under holder detail
- [ ] Edit form: name, loa_ft, beam_ft, draft_ft, hull_color, propulsion, registration
- [ ] Cannot delete a vessel with assignment history — only set status=inactive
- [ ] Audit log

### Technical Notes
- PRD §3.3.A

### Out of Scope
- Vessel-fit pre-check on save (covered by slip-fit at assignment time — STORY-40)

---

## EPIC-2A-STORY-38: Assignment creation flow — slip + holder + vessel + lease_type + slip-fit check
**Epic:** Slip Operations
**Estimate:** 6 hrs
**Dependencies:** STORY-04, STORY-32, STORY-36, STORY-37, STORY-40

### Description
As Kathy, I want to assign a holder to a slip for a season with a lease type and have the system block invalid combinations so that double-booking and slip-fit violations are impossible.

### Acceptance Criteria
- [ ] Form: select slip + holder + vessel + season_year + lease_type
- [ ] For HALF_SEASON_1 / HALF_SEASON_2: start/end auto-fill from Marina Config (overridable)
- [ ] For FULL_SEASON: start/end = season_start_date / season_end_date
- [ ] For TRANSIENT: explicit start/end pickers
- [ ] Server action runs slip-fit check (STORY-40), then attempts insert
- [ ] DB EXCLUDE constraint blocks any overlap; friendly app-layer error message shown
- [ ] Booking priority order (D4) shown as a banner at top of page
- [ ] Audit log

### Technical Notes
- ARCH §5 (booking model)
- PRD §3.3.B, FR-3.3.1, §3.3.C

### Out of Scope
- Override (STORY-41)

---

## EPIC-2A-STORY-39: Assignment confirmation + state machine
**Epic:** Slip Operations
**Estimate:** 3 hrs
**Dependencies:** STORY-38, D5

### Description
As Kathy, I want to move an assignment from `proposed` → `confirmed` (and later `closed` / `canceled`) so that the system reflects deposit/agreement state.

### Acceptance Criteria
- [ ] Assignment detail page shows state + action buttons (Confirm / Close / Cancel)
- [ ] Each transition is audit-logged with reason
- [ ] Canceled assignments don't block re-booking (EXCLUDE constraint WHERE clause)
- [ ] Default state on insert: per D5 resolution (default = `confirmed` if no deposit gate at MVP)

### Technical Notes
- ARCH §5.6 (cancellations)
- D5 in DEV-PLAN.md §7

### Out of Scope
- Holder-initiated cancellation (Phase 1.5)

---

## EPIC-2A-STORY-40: Slip-fit enforcement — server-side check with explanatory error
**Epic:** Slip Operations
**Estimate:** 3 hrs
**Dependencies:** STORY-03

### Description
As Kathy, I want the system to block any assignment where vessel.LOA > slip.LOA or vessel.beam > slip.beam or vessel.draft + 0.5 > slip.min_depth so that I cannot accidentally mis-fit a boat.

### Acceptance Criteria
- [ ] `lib/booking/checkSlipFit.ts` per ARCH §6.1
- [ ] Called server-side on every assignment insert
- [ ] On failure, returns the failing dimension(s) + vessel vs. slip values
- [ ] App-layer error message names the failure ("Beam: 9'2" > slip limit 8'0"")
- [ ] Client-side runs the same check for UX (server is authoritative)

### Technical Notes
- ARCH §6 (slip-fit enforcement)
- PRD FR-3.3.2

### Out of Scope
- Override (STORY-41)

---

## EPIC-2A-STORY-41: Admin override flow — 20-char justification + audit log
**Epic:** Slip Operations
**Estimate:** 2 hrs
**Dependencies:** STORY-40

### Description
As Kathy (admin role), I want to override a slip-fit block with a written justification so that I can handle real-world exceptions without losing the audit trail.

### Acceptance Criteria
- [ ] After a slip-fit block, "Override with justification" button surfaces (only for eci_admin / super_admin roles)
- [ ] Click → expand inline justification text area
- [ ] Submit requires ≥20 chars
- [ ] Insert succeeds with `assignment.override_reason` populated + audit log entry `assignment.override` with `metadata = { failures, justification, actor }`

### Technical Notes
- ARCH §6.2 (override workflow)
- PRD FR-3.3.3

### Out of Scope
- Override report UI (covered by STORY-57)

---

## EPIC-2A-STORY-42: Per-slip booking calendar (timeline strip view)
**Epic:** Slip Operations
**Estimate:** 5 hrs
**Dependencies:** STORY-38

### Description
As Kathy, I want to see a slip's entire season as a timeline strip showing which windows are Full / Half-1 / Half-2 / Transient / Available so that I can spot gaps for transient activation.

### Acceptance Criteria
- [ ] Per-slip detail page renders a timeline strip (Apr → Nov)
- [ ] Color-coded segments per UX §4.2 palette
- [ ] Click segment → assignment detail slide-over
- [ ] Empty segments labeled "Available" with "Open to transient" action button
- [ ] Marina-wide pivot view (rows = slips, columns = days) — **CONDITIONAL** (cut line candidate per §8)

### Technical Notes
- PRD FR-3.3.6, FR-3.4.A
- UX §4.3 (booking calendar wireframe)
- DEV-PLAN.md §8 (marina-wide grid is the cut-line candidate)

### Out of Scope
- Drag-to-resize assignment ranges (Phase 1.5)

---

## EPIC-2A-STORY-43: Transient request review queue + Approve / Deny / Hold
**Epic:** Slip Operations
**Estimate:** 6 hrs
**Dependencies:** STORY-15, STORY-38, STORY-42, D6

### Description
As Kathy, I want a queue of pending transient requests with availability overlay and approval actions so that I can process visitors in <2 minutes per request.

### Acceptance Criteria
- [ ] `/admin/transient-queue` list, oldest first, with status filter
- [ ] Request detail: requester info, vessel dims, dates, purpose
- [ ] "Check availability" → calendar overlay of transient-eligible slips for requested dates, filtered by slip-fit
- [ ] Approve action: assigns specific slip, creates `lease_type=TRANSIENT` assignment, sends confirmation email with COI upload link (48h expiry token)
- [ ] Deny action: requires ≥20-char reason, sends email
- [ ] Hold action: sends "request more info" email, marks status=hold
- [ ] Transient activation per D6 resolution (manual / auto / hybrid)
- [ ] Mobile-responsive (Kathy from her phone)

### Technical Notes
- PRD FR-3.4.1 through FR-3.4.6
- UX Flow C (transient review)
- UX §4.3 (calendar overlay)

### Out of Scope
- Public-facing transient slip-availability widget (Phase 2+)

---

## EPIC-2A-STORY-44: Dockmaster mobile slip lookup
**Epic:** Slip Operations
**Estimate:** 3 hrs
**Dependencies:** STORY-32, STORY-38

### Description
As the dockmaster on my phone, I want to look up slip 47 and see the current holder, vessel, contact info, and tap-to-call so that I can resolve "whose boat is this" in seconds.

### Acceptance Criteria
- [ ] Mobile-responsive route at `/admin/dockmaster` (uses existing admin auth)
- [ ] Search box at top — type "47" or "Petracco" or "Lulu"
- [ ] Result <1s on 4G
- [ ] Detail: slip + current assignment (date-resolved) + holder name + tap-to-call phone + vessel name
- [ ] Works on iPhone Safari + Android Chrome
- [ ] **CONDITIONAL** — cut line candidate per §8 (responsive admin works as fallback)

### Technical Notes
- PRD FR-3.3.5
- DEV-PLAN.md §8 (cut line)

### Out of Scope
- Native mobile app (deferred indefinitely)

---

# EPIC-2B — Document Collection (35 hrs)

## EPIC-2B-STORY-45: Holder portal layout (anchored single-page)
**Epic:** Document Collection
**Estimate:** 3 hrs
**Dependencies:** STORY-05

### Description
As a slip-holder, I want a single scrollable page with my slip, vessels, docs, fees, and contact info so that I never have to navigate.

### Acceptance Criteria
- [ ] `/holder` route, holder-role-only
- [ ] Top sticky nav with anchor jump-links: My slip · My vessels · My documents · My fees · Contact info
- [ ] Single-page scroll, anchor navigation works on mobile
- [ ] WCAG 2.1 AA; 18px base body size; ≥44px tap targets

### Technical Notes
- UX §2.2 (portal IA)
- UX §6.2 (older users)

### Out of Scope
- Each section's content (STORY-46)

---

## EPIC-2B-STORY-46: Holder dashboard sections (slip, vessels, docs, fees, contact)
**Epic:** Document Collection
**Estimate:** 5 hrs
**Dependencies:** STORY-45, STORY-19

### Description
As a slip-holder, I want each section populated with my actual data + my fee line items so that I have one source of truth on my account.

### Acceptance Criteria
- [ ] My slip section: current + upcoming season assignment(s), slip number, lease type, dates
- [ ] My vessels: list of vessels with attributes; edit button submits a request to ECI (no direct mutation)
- [ ] My documents: card grid with status badges (rendered by STORY-48)
- [ ] My fees: read-only line-item breakdown from `resolveFee()` against the Active fee schedule
- [ ] Contact info: editable inline (name, phone, email, mailing address, emergency contact)
- [ ] All sections use plain-English copy ("Insurance certificate" not "COI")

### Technical Notes
- UX §4.4 (document center wireframe)
- PRD FR-3.2.2, FR-3.9.3

### Out of Scope
- Vessel/slip change requests to ECI workflow on admin side (out — accept as ECI handles via email at MVP)

---

## EPIC-2B-STORY-47: Document upload via R2 signed PUT URL
**Epic:** Document Collection
**Estimate:** 5 hrs
**Dependencies:** STORY-06, STORY-45

### Description
As a slip-holder, I want to upload my COI / registration / indemnification / survey / lease doc through the portal so that ECI has a current copy on file.

### Acceptance Criteria
- [ ] "Upload a document" route with deep-link target (`/holder/upload?type=COI` lands with COI pre-selected)
- [ ] Drag-and-drop (desktop) + file picker (mobile)
- [ ] File-type allowlist: PDF, JPG, PNG; max 25MB
- [ ] User selects doc_type + expiration_date (default = +1 yr, editable)
- [ ] Signed PUT URL flow per STORY-06; on success, writes `document` row with status=pending
- [ ] Confirmation: "Got it. ECI will review within 1–2 business days."
- [ ] Audit log

### Technical Notes
- UX §4.4 (upload flow)
- PRD FR-3.5.1

### Out of Scope
- OCR pre-fill (Phase 1.5)
- Virus scan (Phase 1.5)

---

## EPIC-2B-STORY-48: Document status badges (computed at query time)
**Epic:** Document Collection
**Estimate:** 3 hrs
**Dependencies:** STORY-47

### Description
As a holder or Kathy, I want each document to show Current / Expiring / Expired / Missing at a glance so that I know what action is required.

### Acceptance Criteria
- [ ] Computed from `expiration_date` + `status` per PRD §3.5
- [ ] Visual: pill shape with color + icon (per UX §4.4)
  - Current (green): approved, >60 days to expiration
  - Expiring (amber): approved, ≤60 days
  - Expired (red): past expiration_date
  - Missing (slate): required for this holder/vessel, never uploaded
- [ ] Logic exposed via a `lib/documents/computeStatus.ts` helper
- [ ] Used by holder portal + Kathy's compliance dash

### Technical Notes
- PRD §3.5 (status definitions)
- UX §4.4 (badge design)

### Out of Scope
- Bulk status update (none — always computed)

---

## EPIC-2B-STORY-49: Doc review queue (Kathy) — list + preview + approve/reject
**Epic:** Document Collection
**Estimate:** 5 hrs
**Dependencies:** STORY-47

### Description
As Kathy, I want a queue of pending uploads with PDF preview and one-click approve / reject so that I can process docs in under 30s each.

### Acceptance Criteria
- [ ] `/admin/documents/review` list, oldest first
- [ ] Click row → right pane shows PDF preview (in-browser iframe with signed GET URL)
- [ ] Approve = single click; 5s undo toast; status → approved + audit log
- [ ] Reject opens modal requiring ≥20-char comment; comment emails to holder; status → rejected + audit log
- [ ] Keyboard shortcuts: ↑/↓ navigate; `a` approve; `r` reject
- [ ] Bulk approve (selection + bulk action) — useful at season start

### Technical Notes
- UX §4.5 (review queue wireframe)
- PRD FR-3.5.3

### Out of Scope
- OCR-pre-filled verify fields (Phase 1.5)

---

## EPIC-2B-STORY-50: Reminder cron job — daily T-60/T-30/T-7/T-0 scan
**Epic:** Document Collection
**Estimate:** 4 hrs
**Dependencies:** STORY-47, STORY-51

### Description
As Kathy, I want the system to remind holders automatically at T-60, T-30, T-7, and T-0 days before any document expires so that compliance does not depend on me sending emails.

### Acceptance Criteria
- [ ] Vercel Cron job runs daily at 06:00 ET
- [ ] Scans `document` for `status='approved'` rows where `expiration_date - today() ∈ {60, 30, 7, 0}`
- [ ] Sends the corresponding email template (STORY-51) per row
- [ ] Suppresses reminders if a renewal of the same doc_type has status=approved
- [ ] Writes audit_log entry per email sent
- [ ] Idempotent — running twice in a day does not double-send

### Technical Notes
- ARCH §2.3 (Vercel Cron flow)
- PRD FR-3.5.2

### Out of Scope
- Enforcement actions on expired docs (covered by D10)

---

## EPIC-2B-STORY-51: Reminder email templates (React Email)
**Epic:** Document Collection
**Estimate:** 3 hrs
**Dependencies:** STORY-07

### Description
As a slip-holder, I want clearly written reminder emails with one big button to upload my renewal so that I can comply without thinking.

### Acceptance Criteria
- [ ] Four templates: T-60, T-30, T-7, T-0
- [ ] Each has: subject line, plain greeting, doc context (which doc, which vessel, when expires), big "Upload my [doc]" button with deep-link to `/holder/upload?type=COI`
- [ ] T-0 template includes urgency language but stays courteous
- [ ] Branded with Wharfside header

### Technical Notes
- UX Flow D step 1 (T-60 email example)

### Out of Scope
- Custom messaging per holder (none at MVP)

---

## EPIC-2B-STORY-52: Compliance dashboard — % current + drill-down
**Epic:** Document Collection
**Estimate:** 4 hrs
**Dependencies:** STORY-48

### Description
As Kathy or a board member, I want a compliance dashboard showing the % of holders fully compliant with drill-down to non-compliant holders so that I can answer "are we OK on docs" in one screen.

### Acceptance Criteria
- [ ] `/admin/compliance` dashboard with: total holders, % fully compliant, % with any expired/missing doc
- [ ] Drill-down list of non-compliant holders with the specific missing/expired docs
- [ ] Filter by doc_type
- [ ] CSV export
- [ ] Board users get read-only view (no action buttons)
- [ ] Residency Watch (resident_renter lease expirations before season end) surfaces here

### Technical Notes
- PRD FR-3.5.4, FR-3.5.5

### Out of Scope
- Chart visualizations (CUT LINE candidate per §8 — table-only is acceptable for MVP)

---

## EPIC-2B-STORY-53: Admin-uploads-on-behalf-of-holder
**Epic:** Document Collection
**Estimate:** 3 hrs
**Dependencies:** STORY-47, STORY-49

### Description
As Kathy, I want to upload a document on behalf of a holder who emails me a PDF so that adoption-resistant holders are still tracked.

### Acceptance Criteria
- [ ] Admin doc CRUD page at `/admin/holders/[id]/documents`
- [ ] "Upload on behalf" button → same upload flow as STORY-47 but writes status=approved + reviewer_id=Kathy + audit log notes "uploaded by admin on behalf of holder"
- [ ] Holder sees the doc in their portal with a note "Uploaded for you by ECI"

### Technical Notes
- Mitigation for risk P8 (holder portal adoption uncertainty)

### Out of Scope
- Holder notification email (the holder didn't ask for this; admin discretion)

---

# EPIC-3 — Reports + Launch (25 hrs)

## EPIC-3-STORY-54: Report — Occupancy YoY by lease type (PDF + CSV)
**Epic:** Reports + Launch
**Estimate:** 3 hrs
**Dependencies:** STORY-38, STORY-19

### Description
As the board, I want a year-over-year occupancy report broken down by lease type so that I can see capacity trends.

### Acceptance Criteria
- [ ] `/admin/reports/occupancy` page
- [ ] Year selector + comparison year
- [ ] Breakdown by lease type (full / half-1 / half-2 / transient) per season
- [ ] Per-slip-tier counts
- [ ] PDF + CSV export

### Technical Notes
- PRD FR-3.7.1

### Out of Scope
- Waitlist length (Phase 1.5)

---

## EPIC-3-STORY-55: Report — Compliance Summary (PDF + CSV)
**Epic:** Reports + Launch
**Estimate:** 2 hrs
**Dependencies:** STORY-52

### Description
As the board, I want a compliance summary I can read at a meeting so that I understand insurance / registration risk.

### Acceptance Criteria
- [ ] Same data as STORY-52 dashboard, packaged for print
- [ ] PDF formatted for one-page board printout
- [ ] CSV export

### Technical Notes
- PRD FR-3.7.2

### Out of Scope
- Historical compliance trends (Phase 1.5)

---

## EPIC-3-STORY-56: Report — Revenue Projection by lease type (PDF + CSV)
**Epic:** Reports + Launch
**Estimate:** 3 hrs
**Dependencies:** STORY-19, STORY-38

### Description
As Linda, I want a revenue projection based on the Active fee schedule + actual assignments so that I can compare projected vs. actual at season end.

### Acceptance Criteria
- [ ] `/admin/reports/revenue` page
- [ ] Total marina revenue forecast for current and next season
- [ ] Per-lease-type breakdown
- [ ] Per-component contribution
- [ ] PDF + CSV export

### Technical Notes
- PRD FR-3.7.3

### Out of Scope
- Actuals comparison vs. AppFolio (Phase 2+)

---

## EPIC-3-STORY-57: Report — Transient Activity + Slip-fit Override Log (PDF + CSV)
**Epic:** Reports + Launch
**Estimate:** 3 hrs
**Dependencies:** STORY-41, STORY-43

### Description
As the board, I want visibility into transient activity AND any slip-fit overrides so that I can evaluate transient policy + governance.

### Acceptance Criteria
- [ ] Transient activity report: count, total revenue, avg stay length, per-slip utilization per season
- [ ] Slip-fit override log: list every assignment with `override_reason` populated + actor + justification + audit reference
- [ ] PDF + CSV exports

### Technical Notes
- PRD FR-3.7.4, FR-3.7.5

### Out of Scope
- "Approval rate" of transient requests (not yet a meaningful metric)

---

## EPIC-3-STORY-58: AppFolio CSV export endpoint — strawman schema + dry-run with Kathy
**Epic:** Reports + Launch
**Estimate:** 5 hrs
**Dependencies:** STORY-19, STORY-38, D7

### Description
As Kathy, I want a one-click CSV export of the Active fee schedule's billable line items in the locked AppFolio schema so that I can drive at least one billing cycle without manual reconciliation.

### Acceptance Criteria
- [ ] Route handler `/api/exports/appfolio.csv` (admin-only)
- [ ] CSV columns per PRD §3.8.A: `holder_id, unit_code, slip_number, season_year, charge_type, charge_date, amount, description`
- [ ] One row per `charge_type` per holder per slip per season
- [ ] `charge_type` enum: SLIP_FULL_SEASON / SLIP_HALF_SEASON_1 / SLIP_HALF_SEASON_2 / TRANSIENT_NIGHT / AMENITY_FEE / PREMIUM_SURCHARGE
- [ ] Header row + footer row with totals
- [ ] Mapping centralized in `lib/appfolio/mapping.ts` so schema shifts don't require code rewrites
- [ ] Dry-run import with Kathy completed and documented before launch

### Technical Notes
- PRD §3.8, FR-3.6.1.3, FR-3.8.1
- ARCH §10.1 (CSV export design)
- D7 in DEV-PLAN.md §7

### Out of Scope
- Live AppFolio API push (deferred indefinitely)

---

## EPIC-3-STORY-59: Holder onboarding email blast — first-login magic-link
**Epic:** Reports + Launch
**Estimate:** 3 hrs
**Dependencies:** STORY-05, STORY-36

### Description
As Nick, I want to send all current holders their first-login magic-link with a friendly intro 2 weeks before launch so that the portal is populated on Day 1.

### Acceptance Criteria
- [ ] Admin batch action at `/admin/holders` — "Send portal invites to selected"
- [ ] Per-holder magic-link URL valid 14 days
- [ ] Email template explains: what the portal is, how to log in, what to do (upload docs)
- [ ] Audit log entry per email sent
- [ ] Bounce / undeliverable handling: surface in admin

### Technical Notes
- ARCH §9.3 (holder onboarding)

### Out of Scope
- SMS reminders (Phase 2+)

---

## EPIC-3-STORY-60: Accessibility audit + runbook documentation
**Epic:** Reports + Launch
**Estimate:** 6 hrs
**Dependencies:** All prior stories complete

### Description
As Nick, I want a WCAG 2.1 AA audit pass + a written runbook for backup restore, secret rotation, and admin onboarding so that the next maintainer (or future-Nick) is not stranded.

### Acceptance Criteria
- [ ] Lighthouse Accessibility score ≥90 on all public pages + holder portal
- [ ] Manual WCAG 2.1 AA pass: contrast, keyboard nav, screen-reader semantics, focus indicators
- [ ] Runbook `docs/ops/RUNBOOK.md` covers: secret rotation, restore from Neon PITR, restore from R2 weekly dump, onboard new admin user, export all data, switch DNS in an outage
- [ ] Backup restore tested into a Neon dev branch — documented results
- [ ] Stitched-fallback documented per ARCH §16.3 (if Nick disappears)

### Technical Notes
- PRD §4 (NFR accessibility)
- ARCH §11.3 (backups), §16.3 (bus factor)

### Out of Scope
- Penetration test (Phase 1.5 if scope/budget allows)

---

*End of backlog v1.0. 60 stories across 6 epics totaling ~250 hrs at realistic pace. Story IDs are intended as the canonical issue identifiers; copy each block into a GitHub issue as-is.*
