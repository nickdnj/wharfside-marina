# Wharfside Marina — QA Strategy (v1.0)

**Project:** `wharfside-marina`
**Status:** v1.0 — initial test strategy, scoped to MVP
**Author:** QA Strategy specialist (Software Project team)
**Date:** 2026-05-19
**Inputs:** `draft-prd-v0.3.md` · `architecture/ARCHITECTURE.md` · `ux/UX-SPEC.md`
**Target launch:** Spring 2027 (April)
**Build budget context:** ~210–290 hour MVP (solo dev); test work is folded into each phase, not a separate phase.

---

## 0. Philosophy

This is a single-tenant internal tool for ~100 named users, written by one developer in his evenings. Test work must be **commensurate with the risk it retires**, not aspirational. The bar is not "SOC2-ready test pyramid"; the bar is "the things that would hurt to break are caught before they ship."

Five operating rules:

1. **Test what would HURT if it broke.** Pricing math, booking conflicts, fee-schedule state machine, document expiration, slip-fit. Everything else gets manual smoke or framework defaults.
2. **Don't test what frameworks already test.** No tests for Next.js routing, Auth.js's own internals, Drizzle's SQL generation, or React rendering correctness.
3. **Lean on Postgres constraints over app-layer validation tests.** The architecture is deliberately constraint-heavy (`EXCLUDE USING gist`, NOT NULL, CHECK, partial unique indexes). Trusting the database is the cheapest, strongest test you can buy.
4. **Manual smoke is acceptable for low-risk paths.** Patron marketing pages, FAQ, slip-map pan/zoom — Nick clicks them before deploy. That's fine.
5. **Manual UAT with Kathy and Linda is the most valuable test of all.** No automated suite will tell you "Linda feels at home in the Modeler." That's a human check.

---

## 1. Test Scope & Risk Tiering

### Tier 1 — Critical (MUST have automated tests)

These are money-adjacent, contract-shaped, or governance-critical. If they break, real consequences follow (wrong charges to AppFolio, double-booked slips, lost board approvals, expired insurance not flagged).

| Capability | PRD ref | Test approach | Tooling |
|---|---|---|---|
| Pricing engine math (`resolveFee`) | FR-3.6.1.2 | Pure-function unit tests with fixtures covering every (holder_state × lease_type × tier) combination | Vitest |
| Booking calendar conflict prevention | ADR-005, §5 | Integration tests against real Postgres; assert `EXCLUDE` constraint rejects overlaps | Vitest + pg-mem rejected → real Neon branch in CI |
| Fee schedule state machine | FR-3.6.4.1 | Integration tests for every allowed/disallowed transition + audit-row assertion | Vitest + Postgres |
| Slip-fit enforcement + override | FR-3.3.2, FR-3.3.3 | Integration tests on the server action: blocked → overridden with justification → audit row | Vitest + Postgres |
| AppFolio CSV export schema | FR-3.6.1.3, §3.8.A | Schema-fixture test: known inputs → assert columns, enum values, decimals, row count | Vitest snapshot of CSV |
| Audit log writes | NFR audit logging | Assert every Tier-1 mutation writes an audit row with actor + before/after | Asserted as part of the above suites |

### Tier 2 — Important (mix of automated + manual)

These have moderate consequences and are testable but not worth exhaustive coverage.

| Capability | PRD ref | Test approach |
|---|---|---|
| Document expiration reminder cron | FR-3.5.2 | One integration test per cadence (T-60/30/7/0) with time-injected fixtures |
| Holder onboarding (4 states, residency lock) | FR-3.2.1, FR-3.2.4 | One Playwright E2E for resident_renter (the most rule-heavy state) + manual smoke for the others |
| Transient request workflow | FR-3.4.1 → FR-3.4.6 | One Playwright E2E: public submit → ECI approve → 48h upload link → COI uploaded |
| Scenario projection math | FR-3.6.2.1 | Unit test: known assignments + scenario fee schedule → expected projection total |
| PDF/CSV report rendering | FR-3.6.4.2, FR-3.7.x | Smoke test that endpoint returns 200 + valid file; do not test pixel layout |
| Auth + role enforcement | §9 | Integration tests for middleware: role-X cannot access role-Y route |

### Tier 3 — Low risk (manual smoke only)

These have low consequences and either are framework-handled or are visual.

| Capability | Test approach |
|---|---|
| Patron site pages (rules, emergency, FAQ, contact) | Manual click-through before deploy + Lighthouse on /rules and / |
| Slip map zoom/pan/click | Manual smoke on desktop + iPad |
| UI responsiveness across breakpoints | Manual smoke + axe-core scan |
| Marketing copy | Eyeballed |
| Photo gallery (Phase 1.5) | N/A for MVP |

---

## 2. Test Stack Recommendation

Concrete tooling decisions for Next.js 14 + Postgres + solo dev:

| Layer | Recommendation | Why |
|---|---|---|
| **Unit tests** | **Vitest** | Faster than Jest, ESM-native, drop-in API, plays well with TS + Next 14. No reason to choose Jest here. |
| **Integration tests** | **Vitest** running against a **real Postgres** (Neon dev branch in CI; local Postgres via Docker for dev) | Tests that interact with the DB need real Postgres — `EXCLUDE USING gist` and `btree_gist` are not faithfully reproduced by SQLite or pg-mem. Cost is one Neon dev branch + ~30s of CI time. |
| **E2E tests** | **Playwright**, ~10–15 critical paths, headless Chromium only | Chromium covers >95% of admin traffic (Kathy is on a Mac in Chrome/Safari; same engine for these tests). Skip Firefox/WebKit matrix unless a real bug shows up. |
| **Component tests** | **Skipped.** Cover via E2E where it matters. | Solo dev, no design system to maintain, no consumers of a shared component library. Component tests would be testing React, not your business logic. |
| **Visual regression / snapshot UI tests** | **Skipped.** | Pure cost, near-zero value at this scale. The screens change too often during build to make snapshots useful. |
| **Manual exploratory** | Documented UAT checklists for Kathy and Linda (§4 below) | The highest-signal "test" in the project. |
| **Accessibility** | **axe-core via @axe-core/playwright** on `/`, `/rules`, `/emergency`, `/transient`, `/holder` (portal landing) | WCAG 2.1 AA is an explicit NFR. axe-core catches ~50% of issues automatically; manual audit covers the rest. |
| **Type safety** | **TypeScript strict mode** + **Zod** schemas on every server action input | Half of "tests" in TS apps are really "did this typecheck." Free coverage. |
| **Lint** | **ESLint** with Next + Tailwind plugins, **Prettier** for formatting | Standard. |

**One opinionated call: do not adopt Cypress.** Playwright is strictly better for greenfield Next.js apps in 2026 (parallelism, network mocking, auto-wait, multiple contexts).

**One thing to NOT spin up:** a separate test database server. Use a Neon branch per CI run (branches are cheap and ephemeral) or wrap each test in a Postgres transaction that rolls back. See §8.

---

## 3. Critical Test Cases (the ones that MUST pass)

These are the named tests that gate every PR merging to `main` and every deploy to production. Each is written as a Given/When/Then so it can be lifted directly into a `*.test.ts` file.

### 3.1 Pricing engine math correctness — `pricing.resolveFee.test.ts`

**Why this matters:** This function is the sole source of truth for every dollar that ends up on an AppFolio CSV. A 1-line bug here means real money charged incorrectly. The engine is a pure function — there's no excuse not to exhaustively unit-test it.

**Fixtures required:**

- A canonical `FeeSchedule` JSON with: base rates for Premium/$5,250, Standard/$4,250, Restricted/$3,500; resident multiplier 0.75; half-season multiplier 0.60; premium surcharge +10% (via `slip.fee_modifier=1.10`); amenity fee $200 (waived for resident); transient $4.50/ft/night.
- A canonical `MarinaConfig` with season Apr 1 → Nov 30, split Jul 31.
- 4 holders (one per state), 2 slips (one Premium, one Standard), 1 transient vessel (32 ft LOA).

**Test cases:**

| # | Scenario | Inputs | Expected total |
|---|---|---|---|
| 3.1.1 | Resident-owner, Full-Season, Premium slip | tier=Premium, holder=resident_owner, lease=FULL_SEASON | 5,250 × 0.75 × 1.00 × 1.10 + 0 amenity = **$4,331.25** |
| 3.1.2 | Resident-renter, Half-Season-1, Standard slip | tier=Standard, holder=resident_renter, lease=HALF_SEASON_1 | 4,250 × 0.75 × 0.60 × 1.00 + 0 amenity = **$1,912.50** |
| 3.1.3 | Non-resident, Half-Season-1 only, Standard slip | tier=Standard, holder=non_resident, lease=HALF_SEASON_1 | 4,250 × 1.00 × 0.60 + $200 × 0.5 amenity (if half-prorated) = **$2,650.00** `[VERIFY proration logic with board — Q in PRD §3.6.1]` |
| 3.1.4 | Non-resident-owner, Full-Season, Premium slip | tier=Premium, holder=non_resident_owner, lease=FULL_SEASON | 5,250 × 1.00 × 1.10 + $200 = **$5,975.00** |
| 3.1.5 | Transient guest, 3 nights, Premium slip, 32ft vessel | lease=TRANSIENT, vessel.loa_ft=32, nights=3 | 32 × 4.50 × 3 = **$432.00** |
| 3.1.6 | Resident-owner, both halves on same slip | 0.75 × 0.60 × full × 2 + 0 amenity | should equal **2 × half-1 amount** (idempotency) |
| 3.1.7 | Rounding edge: 0.75 × 1,733 = 1,299.75 | assert banker's rounding policy is consistent | exactly **$1,299.75** (or documented rounding rule) |
| 3.1.8 | Amenity waiver: resident gets $0 amenity regardless of slip tier | resident_owner on any slip + amenity_fee enabled | amenity line item = **$0** |
| 3.1.9 | Premium surcharge stacking: resident discount applied BEFORE surcharge | resident_owner × Premium | 5,250 × 0.75 × 1.10 = **$4,331.25** (NOT 5,250 × 1.10 × 0.75 — same result, but order matters if surcharge ever becomes flat) |
| 3.1.10 | Determinism: same inputs called twice → identical line items | any input set | byte-equal output |

**Total: ~15 unit tests on this function.** This is the highest-leverage test investment in the project.

### 3.2 Booking calendar conflict prevention — `assignment.constraints.test.ts`

**Why this matters:** Double-booking a slip is a customer-facing disaster. The Postgres `EXCLUDE USING gist` constraint is the architectural guarantee against it; if a future ORM change or migration accidentally drops the constraint, the app is silently broken until two boats show up at the same slip. These tests serve as a tripwire.

**Test cases (all run against real Postgres):**

| # | Scenario | Expected outcome |
|---|---|---|
| 3.2.1 | Insert two FULL_SEASON assignments on same slip in same season | Second INSERT → constraint violation (`exclusion_violation`) |
| 3.2.2 | Insert HALF_SEASON_1 + HALF_SEASON_2 on same slip, non-overlapping dates | Both succeed |
| 3.2.3 | Insert HALF_SEASON_1 [Apr 1, Jul 31] + TRANSIENT [Jun 15, Jun 17] | Second INSERT → constraint violation |
| 3.2.4 | Insert FULL_SEASON + later attempt to insert HALF_SEASON_1 | Second INSERT → constraint violation |
| 3.2.5 | Insert TRANSIENT [Aug 1, Aug 4] then TRANSIENT [Aug 3, Aug 6] (overlapping) | Second INSERT → constraint violation |
| 3.2.6 | Insert TRANSIENT into a gap between HALF_1 [Apr 1, Jul 31] and HALF_2 [Aug 15, Nov 30] — say [Aug 5, Aug 10] | Succeeds (the constraint's WHERE clause respects status) |
| 3.2.7 | Insert overlapping assignment with `status = 'canceled'` | Succeeds (constraint excludes canceled rows) |
| 3.2.8 | Update an existing CONFIRMED assignment's `status` to `canceled`, then insert overlapping new one | Both succeed (status change frees the slot) |
| 3.2.9 | Concurrent inserts (two transactions racing for the same slip-window) | Exactly one succeeds; the other gets constraint violation. (Tests that the constraint, not app logic, is the arbiter.) |
| 3.2.10 | Server-action layer: assignment-state transition from `proposed → confirmed` does not bypass DB constraint | Tested via the server action wrapper, not raw SQL |

**~8–10 integration tests.** Use a fixture builder that resets the `assignment` table per test or wraps each test in `BEGIN; … ROLLBACK;`.

### 3.3 Fee schedule state machine — `feeSchedule.stateMachine.test.ts`

**Why this matters:** The state machine is the governance layer. A bug that lets a Draft skip straight to Active means a non-board-approved rate card becomes the source of truth for AppFolio billing. That is a board-relations incident.

**Test cases:**

| # | From | To | Expected |
|---|---|---|---|
| 3.3.1 | Draft | Submitted | Succeeds; audit row written with actor + timestamp |
| 3.3.2 | Submitted | Approved | Succeeds; requires `approval_reference` field non-empty |
| 3.3.3 | Approved | Active | Succeeds; **previously-Active schedule is automatically Archived** (single-active invariant via `one_active_schedule` unique index) |
| 3.3.4 | Active | Archived | Succeeds (typically as a side-effect of 3.3.3, but allowed manually too) |
| 3.3.5 | Active | Draft | **Blocked** — cannot revert |
| 3.3.6 | Approved | Draft | **Blocked** — cannot revert |
| 3.3.7 | Archived | Active | **Blocked** — terminal state |
| 3.3.8 | Draft | Approved (skipping Submitted) | **Blocked** — cannot skip states |
| 3.3.9 | Promote a second schedule to Active while one is already Active | First either auto-Archived (per 3.3.3) OR second insert fails (whichever the implementation chose). Test asserts the chosen invariant. |
| 3.3.10 | Edit a Submitted/Approved/Active schedule's `base_config` JSONB | **Blocked at the API layer**; tested by attempting via the server action |
| 3.3.11 | Every transition writes exactly one `audit_log` row with `action='fee_schedule.transition'`, before/after state captured | Asserted alongside each above test |

**~10 integration tests.**

### 3.4 Slip-fit enforcement — `assignment.slipFit.test.ts`

**Why this matters:** A boat too big for its slip can damage docks, neighboring boats, or itself. The slip-fit check is both a customer-protection feature and a liability boundary. The override path must be auditable.

**Setup fixtures:**

- Slip A: `loa_limit_ft=35, beam_limit_ft=14, min_depth_at_mlw_ft=6`
- Vessel "Overgrown": `loa_ft=38, beam_ft=12, draft_ft=5`  (fails LOA only)
- Vessel "Wide-Body": `loa_ft=30, beam_ft=15, draft_ft=4`  (fails beam only)
- Vessel "Deep-Draft": `loa_ft=30, beam_ft=10, draft_ft=5.6` (fails draft when safety margin = 0.5)

**Test cases:**

| # | Scenario | Expected |
|---|---|---|
| 3.4.1 | Assign "Overgrown" to Slip A as a `holder` role | Blocked with `dim: 'LOA', vessel: 38, limit: 35` |
| 3.4.2 | Assign "Wide-Body" to Slip A | Blocked with `dim: 'Beam', vessel: 15, limit: 14` |
| 3.4.3 | Assign "Deep-Draft" to Slip A (safety margin 0.5) | Blocked with `dim: 'Draft', vessel: 5.6, limit: 6` (effective limit 5.5) |
| 3.4.4 | Assign "Overgrown" to Slip A as `eci_admin` with `override_reason="Owner accepts risk per phone call 5/12"` (length ≥20) | Succeeds; assignment row has `override_reason` populated; `audit_log` row with `action='assignment.override'`, `metadata.failures=[{dim:'LOA',...}]` |
| 3.4.5 | Same override attempt with justification of 15 chars | API rejects with 400; no row inserted |
| 3.4.6 | Override attempt as role `board` or `holder` | API rejects with 403 |
| 3.4.7 | Vessel that fits all three dimensions exactly at limit | Succeeds without override |
| 3.4.8 | Draft + safety margin boundary: draft=5.5, slip min_depth=6, margin=0.5 → 5.5 + 0.5 = 6.0; passes (not strictly greater) | Succeeds. Documents the `>` vs. `>=` choice. |

**~7–8 integration tests.**

### 3.5 Document expiration reminders — `documentReminders.test.ts`

**Why this matters:** Lapsed COI is a real insurance exposure for the marina. The reminder cron is the only thing standing between "Joe forgot to renew" and "Joe's boat is here uninsured." A cron that silently fails to fire is the worst possible bug — there is no UI surface that would reveal it.

**Test approach:** mock `Date.now()` to "today" and seed documents with expiration dates at each cadence offset. Run the reminder job function directly (not via Vercel Cron). Assert the right emails are queued.

**Test cases:**

| # | Doc expiration | Expected behavior |
|---|---|---|
| 3.5.1 | today + 60 days | Email queued with subject "Action needed: Your insurance certificate expires in 60 days" |
| 3.5.2 | today + 30 days | Email queued, escalated tone |
| 3.5.3 | today + 7 days | Email queued, urgent tone |
| 3.5.4 | today (T-0) | Email queued, "expired today" wording; doc `status` transitions to `expired` |
| 3.5.5 | today + 45 days | **No** email queued (not a cadence point) |
| 3.5.6 | today - 1 day, doc already `status=expired` | No duplicate email queued |
| 3.5.7 | today + 60 days, but a replacement doc with later expiration is already `approved` | No email queued (reminder suppressed per FR-3.5.2 acceptance) |
| 3.5.8 | Reminder job is idempotent: running it twice on the same day queues each email only once | Asserted via Resend mock call count |
| 3.5.9 | After T-0, holder's compliance dashboard shows them in non-compliant list | Asserted via a follow-up query |

**~7–8 integration tests.** This suite plus a quarterly manual spot-check ("Nick, run the cron locally with today() set to ECI's calendar and confirm Joe gets the email") is sufficient.

### 3.6 AppFolio CSV export schema correctness — `appfolio.csvExport.test.ts`

**Why this matters:** The CSV is a contract with AppFolio. Schema drift means failed imports and a manual scramble at billing time. The schema is locked in PRD §3.8.A; tests pin it.

**Test cases:**

| # | Assertion | Expected |
|---|---|---|
| 3.6.1 | Header row matches exactly: `holder_id,unit_code,slip_number,season_year,charge_type,charge_date,amount,description` | Byte-equal |
| 3.6.2 | Every row's `charge_type` is one of: `SLIP_FULL_SEASON`, `SLIP_HALF_SEASON_1`, `SLIP_HALF_SEASON_2`, `TRANSIENT_NIGHT`, `AMENITY_FEE`, `PREMIUM_SURCHARGE` | Enum-validated |
| 3.6.3 | Every `amount` has exactly 2 decimal places (e.g., `4331.25`, never `4331.250` or `4331`) | Regex `/^\d+\.\d{2}$/` |
| 3.6.4 | Resident holders have `unit_code` populated; non_resident holders have `unit_code=""` (empty, not null) | Asserted per row |
| 3.6.5 | One row per `(holder, slip, charge_type)` combination; full-season holder with amenity has 2 rows; same with premium surcharge broken out → 3 rows | Row count math |
| 3.6.6 | A holder with both halves on the same slip produces `SLIP_HALF_SEASON_1` + `SLIP_HALF_SEASON_2` rows (not one combined) | Row count |
| 3.6.7 | Transient row's `amount` = `vessel.loa_ft × transient_per_foot_per_night × nights` to 2dp | Math sanity |
| 3.6.8 | **PII boundary:** CSV contains no `email`, no `phone`, no full vessel registration number, no insurance policy number, no SSN | Asserted via column-name allowlist and a scan of cell values for `@`, `policy`, etc. |
| 3.6.9 | Footer totals row (per FR-3.8.1) sums all `amount` cells exactly | Math sanity |
| 3.6.10 | Filename pattern matches `wharfside-appfolio-{season_year}-{YYYY-MM-DD}.csv` | Asserted at HTTP layer |

**~8–10 unit/integration tests.** Plus a one-time **AppFolio dry-run** with Kathy before the first real export goes out — that's the manual UAT step that catches schema mismatch the spec didn't anticipate.

### 3.7 Auth + role enforcement — `auth.middleware.test.ts`

**Why this matters:** A `holder` who can access `/admin/*` is a privilege-escalation bug. Auth.js handles the auth flow correctly; what we test is **our middleware that maps session role → route access**.

**Test cases:**

| # | Scenario | Expected |
|---|---|---|
| 3.7.1 | Anonymous user requests `/admin/holders` | 302 redirect to `/login` |
| 3.7.2 | Anonymous user requests `/holder/dashboard` | 302 redirect to `/login` |
| 3.7.3 | Anonymous user requests `/`, `/rules`, `/emergency`, `/transient` | 200 OK |
| 3.7.4 | Holder requests `/admin/holders` | 403 Forbidden |
| 3.7.5 | Holder requests `/holder/dashboard` | 200 OK |
| 3.7.6 | Holder requests `/holder/dashboard?holder_id=2` where session.holder_id=1 | Either ignored (server reads holder_id from session, not query) OR 403. Test that no cross-holder data leaks. |
| 3.7.7 | Board role calls `fee_schedule.promote_to_active` server action | 403 |
| 3.7.8 | eci_admin calls `fee_schedule.promote_to_active` | Succeeds |
| 3.7.9 | super_admin calls user-role mutation; eci_admin cannot | Per matrix in §9.2 |
| 3.7.10 | Logout invalidates session cookie; subsequent request to `/holder/dashboard` redirects to `/login` | Standard |
| 3.7.11 | Admin login requires TOTP after magic-link/password (assert the middleware demands `mfa_verified=true` claim) | Asserted via session-stub test |

**~10 integration tests + 1 Playwright E2E** ("happy path" magic-link login as a holder).

---

## 4. Pre-Launch UAT Plan

Automated tests prove the system *works*. UAT proves the system is *usable* and *trusted*. Both Kathy and Linda must sign off before go-live.

### 4.1 Kathy's Acceptance Checklist (ECI Primary Admin)

Format: each item is something Kathy clicks through and either approves or rejects with a comment. Run as a single 90-minute session in late March 2027 (~2 weeks before go-live) at her desk on her actual computer.

**Marina configuration**
- [ ] I can view the active marina configuration and see all 86 slips on the map.
- [ ] I can edit a slip's attributes (LOA limit, tier, fee modifier) and the change is reflected immediately.
- [ ] I can create a new marina configuration version (e.g., "Post-Restoration 2028") cloned from the current one.

**Holders**
- [ ] I can search a holder by last name and find them in <2 seconds.
- [ ] I can create a new holder in each of the 4 states (resident_owner, resident_renter, non_resident_owner, non_resident).
- [ ] For resident_renter, the form requires me to upload the lease doc; I cannot save without it.
- [ ] I can see the "Residency Watch" list of resident_renter holders whose lease expires this year.

**Assignments**
- [ ] I can assign a holder + vessel + slip + lease type in fewer than 5 clicks from the Slip Board.
- [ ] When I attempt to assign a vessel too big for the slip, I get a clear error message with the failing dimension named.
- [ ] When I click "Override," I am required to type a justification of at least 20 characters before saving.
- [ ] I can view a slip's full assignment history and export it to CSV.
- [ ] I can put two half-season holders on the same slip with non-overlapping dates.
- [ ] When I try to put a transient on a date already covered by a half-season, the system blocks me.

**Documents**
- [ ] I can see the review queue with the oldest pending doc at the top.
- [ ] I can approve a doc in one click; rejected docs require a comment ≥20 chars.
- [ ] The compliance dashboard shows me the % of holders fully current at a glance.
- [ ] I receive a test reminder email at T-60 for a doc I've seeded to expire in 60 days.

**Transient queue**
- [ ] I receive an email notification when a public transient request comes in.
- [ ] From the queue I can see eligible slips for the requested dates, filtered by slip-fit on the requested vessel.
- [ ] I can approve a request; the requester receives an upload link valid for 48h.

**AppFolio export**
- [ ] I can export the season's CSV in one click.
- [ ] The CSV opens cleanly in Excel and AppFolio's import wizard accepts it on a dry-run.
- [ ] The dollar totals on the footer row match what I'd expect from my own back-of-envelope.

**Mobile / dockmaster**
- [ ] On my iPad, I can search "47" and see who is in slip 47 today within 2 seconds.
- [ ] Tap-to-call works on the holder's phone number.

**Comfort**
- [ ] If I'm uncertain about something I just did, I can find it in the audit log within 30 seconds.
- [ ] No screen made me feel like I needed a manual to understand.

### 4.2 Linda's Acceptance Checklist (Treasurer / Scenario Modeler)

Format: 60-minute working session with a real Q3 2027 rate-card-modeling task. Run twice — once at MVP feature-complete (~Nov 2026 per the inverted phasing) and once at pre-launch.

**The "better than Excel" bar**
- [ ] I can clone the Active Fee Schedule as a draft scenario in fewer than 3 clicks.
- [ ] I can edit any rate cell in the matrix using Excel-style keyboard navigation (Enter to move down, Tab to move right).
- [ ] The projected revenue updates within 1 second of my edit, without me having to press a recalc button.
- [ ] The "vs. Active" delta is prominent and color-coded (green = increase, red = decrease).
- [ ] I can expand "Per-holder impact" and see all 86 slip-holders, sortable by delta.
- [ ] I can export the scenario as a branded PDF marked "DRAFT — not yet board-approved."

**The "governance built in" bar**
- [ ] I can submit the scenario for approval; once submitted, I cannot edit it.
- [ ] When marking approved, I am required to enter a reference to the board approval (e.g., minutes link).
- [ ] When promoting to Active, I am required to type the word "APPROVED" to confirm.
- [ ] The previously-Active schedule is automatically Archived.

**The "Excel-killer" features**
- [ ] I can model a 5% across-the-board rate increase and see the per-lease-type revenue impact in 30 seconds.
- [ ] I can model a 2-week earlier season opening and see the projected new-revenue line.
- [ ] I can compare two scenarios + Active in a 3-column side-by-side view.

**The "would you use this instead of Excel" question** (asked verbally at end of session)
- [ ] "Yes, I would."  ← required for sign-off.
- [ ] Notes / friction points: ____________________________________

### 4.3 Board Sign-Off Criteria

A short list, signed by Nick + at least 2 other board members:

- [ ] Kathy has signed her acceptance checklist (all items ✓ or accepted with note).
- [ ] Linda has signed her acceptance checklist AND verbally affirmed "I would use this instead of Excel."
- [ ] AppFolio CSV dry-run successful with no schema errors.
- [ ] At least one full doc-reminder cycle (T-60 → T-0) has fired correctly in staging.
- [ ] Audit log shows all UAT actions, queryable.
- [ ] Backup restore drill performed within the last 30 days (Nick verified a Neon PITR + R2 file recovery).
- [ ] Lighthouse score ≥90 on `/`, `/rules`, `/emergency`.
- [ ] axe-core scan returns 0 critical issues on patron site routes.

---

## 5. Continuous Quality Gates

Light, fast, and only as much as is automation-payback-positive. CI runs on GitHub Actions.

| Stage | Gate | Time budget | Action on failure |
|---|---|---|---|
| **Pre-commit** (local, via husky + lint-staged) | Prettier format + ESLint + TypeScript check on staged files | <5s | Commit blocked locally |
| **Pre-push** (local) | `pnpm test --run` (unit tests only, no DB) | <15s | Push blocked locally |
| **CI on PR** (GitHub Actions) | Full unit + integration test suite against ephemeral Neon branch + Playwright E2E suite (~10–15 paths) + Lighthouse CI on `/` and `/rules` | <5 min total | PR cannot merge |
| **CI on PR — accessibility** | axe-core scan on key pages | <1 min | Warning, not blocking, except for "critical" severity items (block) |
| **Pre-deploy** (Vercel preview → prod) | Smoke test: hit `/`, `/admin/login`, `/holder/login`, `/api/health` against the preview URL; assert 200s | <30s | Deploy aborted |
| **Post-deploy** (Vercel webhook → UptimeRobot) | Sentry watch for new errors in first 5 min; manual page-through by Nick | n/a | Manual rollback via Vercel one-click |

**Skipped on purpose:** load tests (no scale concern at 10 concurrent users; Vercel + Neon handle 100× headroom), penetration tests (not a security-target product), browser-matrix tests (Chromium only).

---

## 6. What NOT to Test

Solo dev permission slip. Skip these and feel no guilt.

1. **Do not snapshot-test UI components.** They change too often, the snapshots add noise, and the failures are almost always "I changed something on purpose." Net value at this scale: negative.
2. **Do not unit-test Drizzle queries** in isolation. If the query needs testing, that means you have business logic in it — move that logic out, then test the moved logic. The query itself is testing Drizzle, which Drizzle's own test suite already covers.
3. **Do not test Next.js routing.** `/admin/holders` resolves to `app/admin/holders/page.tsx`. There is no logic to test.
4. **Do not test Auth.js's internal flow.** Magic-link generation, token hashing, session creation — all framework code. Test only the **role-enforcement middleware you write**, which is in §3.7.
5. **Do not write component tests for buttons, inputs, badges, etc.** React renders them. The design system is single-tenant; the UI either works in E2E or it doesn't.
6. **Do not chase coverage numbers.** Coverage is a vanity metric in a project this size. A test suite at 38% coverage with the right 38% is better than 90% with the wrong 90%.
7. **Do not test third-party integrations beyond contract.** Resend's email delivery is not your concern; only that you called the right endpoint with the right payload is. Use Resend's test API key in CI.
8. **Do not test SSG output of marketing pages.** Read it, look at it, ship it.
9. **Do not test the slip map's pan/zoom behavior.** It's a UI affordance, not a correctness issue.
10. **Do not write tests for things that aren't yet implemented.** Tests are coupled to implementation; writing them too early creates dead weight to refactor.

---

## 7. Bug Triage Rubric (post-launch)

For when something does break in production. Nick is the sole responder; the rubric exists to keep him from over-investing in P2s while a P0 burns.

### P0 — Drop everything (same-day fix)

- Pricing math returns a wrong number (any holder, any lease type, any tier).
- Double-booking happens (two confirmed assignments overlap on a slip).
- Document expiration reminders fail to send for >24h.
- Anyone cannot log in (auth outage).
- Audit log fails to write (governance bypass).
- A holder can see another holder's data (PII breach).
- Production site returns 5xx for >5 min.
- AppFolio CSV export schema diverges from contract on a real export.

**Response:** roll back the offending deploy on Vercel (one-click), email Kathy and the board within 1 hour with status, fix forward, post-mortem within 7 days.

### P1 — This week (5 business days)

- UX friction reported by Kathy or Linda that materially slows their work.
- Transient request workflow broken (form 500s, approval doesn't email, upload link expired prematurely).
- Slip-fit override report shows incorrect data.
- Compliance dashboard miscounts.
- Magic-link emails delayed >5 min.
- Holder portal mobile layout broken on iPad.
- Reports (PDF, CSV) render wrong but the underlying data is correct.
- AppFolio CSV schema drift not yet hitting a real export (catch it in dry-run).

**Response:** ticket it, fix it in the next deploy cycle (Wednesdays).

### P2 — Next sprint or backlog

- Cosmetic issues (badge spacing, color slightly off).
- Edge-case UI (form looks weird at 320px viewport).
- Patron site typo.
- Feature ideas Kathy mentioned but didn't insist on.
- Performance improvements where pages are already <2s.
- Nice-to-have keyboard shortcuts.

**Response:** ticket it, batch into a quarterly polish pass.

---

## 8. Test Data / Fixtures Strategy

### 8.1 Seed Script (`scripts/seed-dev.ts`)

A single TypeScript script Nick runs to populate a fresh Neon dev branch with realistic data. Idempotent — drops + recreates per run.

**Volume:**
- **86 slips** spread across tiers (≈20 Premium, ≈50 Standard, ≈16 Restricted) with representative LOA/beam/depth limits and a fee_modifier of 1.10 on Premium.
- **50 holders** distributed across the 4 states: 25 resident_owner, 10 resident_renter (with lease docs), 10 non_resident_owner, 5 non_resident.
- **30 vessels** linked to those holders, with realistic dimensions (some intentionally close-to-limit to exercise slip-fit edges).
- **5 fee schedules**: one Active, one Archived (last year), one Approved (pending Activate), one Submitted, one Draft.
- **100 sample assignments** for the active season: ~60 full-season, ~20 half-season pairs (10 pairs = 20 rows), ~20 transients spread through the summer.
- **30 documents** with varied expiration dates: some current, some expiring in 60 days, some expiring in 7, some already expired.

**Why this volume:** mirrors real production scale (Kathy will see ~the same screen density on day 1). Tests written against seed data behave like tests against prod, minus the names.

### 8.2 Test Isolation

Two acceptable patterns; pick one and stick to it:

**Pattern A — Postgres transaction rollback per test (recommended for unit/integration speed):**

```ts
beforeEach(async () => {
  await db.execute(sql`BEGIN`);
});
afterEach(async () => {
  await db.execute(sql`ROLLBACK`);
});
```

Fast, no cross-test pollution, works for everything except tests that need a real commit (e.g., testing that an `EXCLUDE` constraint fires across two transactions — for those, use Pattern B).

**Pattern B — Ephemeral Neon branch per CI run:**

GitHub Actions creates a Neon branch from `main`, runs migrations + seed, runs the suite, deletes the branch. ~30s overhead per CI run; costs roughly $0 on Neon's Launch plan.

**Recommended split:** Pattern A for the ~80% of tests that just need DB access; Pattern B for the ~20% that need true cross-transaction concurrency or migration testing.

### 8.3 Fixtures vs. Factories

Use a small set of **named, hand-built fixtures** for the critical-path tests in §3 (one canonical "Joe Petracco, resident-owner, slip 47, Lulu" that every pricing test reuses). For volume tests (seed script, occupancy reports), use a **factory function** with seeded random data.

Avoid generic Faker-style randomness in critical-path tests — when a test fails, "Joe Petracco" is easier to reason about than "Aaron Aaronson generated at run 4,328."

### 8.4 Mocking External Services

| Service | Test approach |
|---|---|
| **Resend (email)** | Use Resend's test API key in CI; in unit tests, mock `resend.emails.send` and assert call args. Never send real email from CI. |
| **R2 (object storage)** | Mock the signed-URL generator at the function boundary. Don't hit real R2 in tests. One Playwright E2E uploads a real file to a R2 test bucket to validate end-to-end. |
| **Sentry** | Mock; don't pollute the real project's error stream. |
| **AppFolio** | No mocking needed — only file output (CSV) is the interface for MVP. |

---

## 9. Effort Estimate

How much of the 210–290 hour MVP budget should be test work? Recommendation: **30–40 hours total**, woven into each phase rather than back-loaded.

| Test work | Estimated hours |
|---|---|
| Vitest + Playwright + axe-core + CI setup (Phase 0) | 4–6 |
| Pricing engine unit tests (§3.1) — high ROI | 4–5 |
| Booking conflict integration tests (§3.2) | 3–4 |
| Fee-schedule state-machine tests (§3.3) | 3–4 |
| Slip-fit + override tests (§3.4) | 2–3 |
| Document reminder tests (§3.5) | 3–4 |
| AppFolio CSV schema tests (§3.6) | 2–3 |
| Auth + role-enforcement tests (§3.7) | 3–4 |
| Playwright E2E paths (10–15 of them) | 4–6 |
| Seed script + fixtures | 2–3 |
| UAT prep + facilitating Kathy/Linda sessions | 2–3 (Nick's time, not pure test code) |
| **Total** | **~32–45 hours** |

That's ~12–15% of the build budget, which is a reasonable ratio for a constraint-heavy money-adjacent internal tool. Lower than the typical "20% of time on tests" rule of thumb, justified by: (a) the constraint-heavy architecture pre-tests the boring stuff, (b) solo dev with no team-wide regression risk, (c) the critical paths are small and well-scoped.

---

## 10. The Single Highest-Value Test Investment

If Nick has only ONE evening to invest in tests, that evening should be spent **writing the §3.1 pricing-engine unit tests with the 10 fixture cases** (Premium-resident-full, Standard-renter-half, non-resident-half-with-amenity, transient-by-foot, the proration edge case, the rounding edge case, the determinism check, etc.).

**Why:**

- **Highest blast radius if wrong.** A pricing bug touches every charge on every CSV that goes to AppFolio. Every other system error has a bounded blast radius (one assignment, one doc, one user). This one is global.
- **Cheapest to test.** Pure function. No DB, no auth, no React, no network. A test file with 15 cases takes 2–3 hours and runs in <100ms.
- **Highest reuse over time.** The pricing engine is called by the Active resolver, the Scenario Modeler, the AppFolio CSV exporter, and (eventually) any v2 live AppFolio push. Locking it down with tests locks down four downstream surfaces for free.
- **Catches regression on Phase 1.5 changes.** When Linda asks for a per-foot pricing variant in 2028, the existing tests will fire instantly if the change breaks tier-based pricing. That's exactly the kind of multi-year payoff a solo-maintained codebase needs.

The Postgres `EXCLUDE USING gist` constraint is a close second — it catches the next-most-disastrous class of bug (double-booking) — but Postgres does the work for you. Trust it. Just write the tripwire (§3.2) so a future migration can't silently drop it.

Everything else is a distant third.

---

## 11. Open Questions for Nick

A short list of things the QA strategy can't decide unilaterally:

1. **Test DB choice in CI** — Neon ephemeral branches (cleanest) vs. a Postgres container in GitHub Actions (faster, free-er, but doesn't catch Neon-specific behavior). Recommend **Neon branch per CI run.**
2. **Should we test against multiple browsers in Playwright?** Recommendation: Chromium only for MVP. Add WebKit if a real Safari bug shows up.
3. **Where does the half-season amenity-fee proration logic actually land?** PRD §3.6.1 flags it for board verification. The §3.1 tests are written assuming half-proration; if the board says "full amenity fee on a half-season holder," the test fixtures shift.
4. **UAT timing** — Kathy's checklist in late March 2027 is ~2 weeks pre-launch. Is that too late if she finds something material? Consider an earlier 60% checklist in February to surface big issues with time to act.
5. **Manual reminder-cron verification** — should there be a documented quarterly runbook ("Nick runs the cron locally with today() set to ECI's calendar")? Recommend yes — it's the cheapest insurance for a silent-failure mode.

---

*End of QA Strategy v1.0. Next step: Nick reviews scope and ROI assumptions, then this gets folded into Phase 0 setup time during the build kick-off.*
