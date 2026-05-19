# Wharfside Marina — Product Requirements Document (v0 — Corrected Scope)

**Project:** `wharfside-marina`
**Status:** Draft v0.2 — pre-architecture, scope corrected
**Author:** Product Requirements agent (under Software Project team)
**Date:** 2026-05-19
**Sponsor:** Nick DeMarco (Secretary, Wharfside Manor Board)
**Operator (admin user):** East Coast – Ideal Management (ECI), Kathy Vanecek
**Anchor target:** Spring 2027 marina season (target April 2027 go-live) `[MEDIUM — VERIFY Q-G1]`

---

## Revision History

| Version | Date       | Author | Notes |
|---------|------------|--------|-------|
| 0.1     | 2026-05-19 | Product Requirements (prior pass) | Initial discovery — over-scoped (included billing path, reservation/marketplace path, transient self-booking). |
| **0.2** | **2026-05-19** | **Product Requirements (this pass)** | **Scope corrected. Three pillars only: slip assignment, document collection, patron website. AppFolio owns billing. Not a Dockwa replacement.** |

---

## Confidence Legend

- **`[HIGH]`** — Confirmed by Wharfside governing docs, handbook, session logs, or sponsor statement.
- **`[MEDIUM]`** — Reasonable inference from context; needs explicit confirmation.
- **`[LOW — VERIFY]`** — Placeholder until Nick answers a discovery question.

---

## 1. Overview & Purpose `[HIGH]`

Wharfside Manor operates a small private marina (~86 slips on the Shrewsbury River, adjacent to the condominium property in Monmouth Beach, NJ) for the use of unit-owners and a limited number of non-residents. Marina operations are run day-to-day by **East Coast – Ideal Management (ECI)**, the property management firm contracted by the Wharfside Manor Board. Billing, payments, and financial accounting for slip-owners are handled in **AppFolio Property Manager** (referred to colloquially by the sponsor as "Folio"; the WMCA Handbook confirms it is AppFolio), which ECI uses as its primary platform across all property functions.

Today, slip assignments are tracked informally (likely a mix of spreadsheets, email threads, and institutional memory at ECI). Required slip-owner documents — proof of insurance, vessel registration, indemnification — are collected via email and stored in ad-hoc locations. There is no patron-facing website with marina rules, contact info, or emergency procedures; that information lives in the WMCA Handbook PDF that few residents read end-to-end.

**The purpose of this system is to consolidate three discrete operational needs into a single tool:**

1. A **slip assignment management** interface — internal ops tool for ECI and the dockmaster to track which boat is in which slip, with full vessel and owner details, season-over-season history.
2. A **document collection** portal — slip-owners and any approved transients upload required documents (insurance, registration, indemnification); the system tracks expirations and sends renewal reminders.
3. A **patron-facing website** — public/semi-public pages with marina rules, ECI/dockmaster contact, emergency procedures, marina map, FAQ, and downloadable forms.

### What this is NOT `[HIGH]`

| Out of Scope | Why |
|---|---|
| Billing, invoicing, payments | AppFolio owns this. The system reads paid-up status at most. |
| Financial accounting | AppFolio + ECI's accounting workflow. |
| Reservation marketplace / Dockwa-style booking | Slips are owned/leased annually by residents; no transient discovery market needed. |
| Boater discovery / public booking | Not a marketplace. |
| POS / ship store / retail | Not a feature of Wharfside Marina. |
| Fuel management | No fuel dock at Wharfside. |
| Charter or rental management | Not applicable. |
| Dry stack or launch scheduling | Wet slips only; fixed/seasonal assignments. |

This scope discipline is deliberate. The hardest, riskiest, most regulated parts of marina software (payments, PCI, tax reporting, multi-state insurance, dynamic pricing, boater marketplaces) are explicitly delegated to AppFolio. What remains is a focused internal ops tool plus a small public website — well within solo-developer scope.

---

## 2. Stakeholders `[HIGH]`

| Stakeholder | Role | Type of Engagement |
|---|---|---|
| **East Coast – Ideal Management (ECI)** | Operator. Day-to-day admin of marina. | **Primary admin user.** Without their adoption, this tool fails. Buy-in must be confirmed early (see Q-G4). |
| **Wharfside Manor Board** | Oversight. Approves policy, budgets, and the existence of this tool. | Read-only oversight access; approval gates. Pres Giuseppe Gencarelli, Treasurer Linda Masessa (CPA, CAMS), Secretary Nick DeMarco. |
| **Dockmaster** | Day-to-day boots on the ground. May be ECI staff, a paid contractor, or a volunteer board member. `[LOW — VERIFY Q-A2 + ops]` | Read/write on assignments, doc review. |
| **Slip-owners (residents)** | Primary boater users. ~86 expected. | Upload docs, view own assignment, update contact info. |
| **Transients / non-resident slip-holders** | Secondary boater users. `[LOW — VERIFY Q-A4]` | Same as slip-owners if applicable. May be zero. |
| **Public visitors** | Anyone viewing rules, contact, emergency info on the patron site. | Read-only access to public pages. |
| **Wharfside Manor unit owners (non-boaters)** | Read patron website; indirect interest in marina rules. | Same as public visitors. |
| **Wharfside Manor attorney (Hubert Cutolo)** | Reviews indemnification language, document policy. | Consulted at policy gates. |
| **Baldwin Insurance** | Association insurance broker. May define COI requirements for slip-owners. | Consulted for COI minimums and additional-insured language. |

---

## 3. In Scope `[HIGH]`

### 3.1 Slip Assignment Management (Pillar 1)

Internal admin tool. Tracks:
- Slip inventory (slip number, length class, special attributes — covered/uncovered, services available, T-head/finger, etc.)
- Annual assignment per slip → slip-holder
- Vessel record per slip-holder (LOA, beam, draft, name, hull color, USCG doc # or state registration #, propulsion type)
- Contact info per slip-holder (name, phone, email, mailing address, emergency contact)
- Season/year stamping on every assignment record
- Full historical view: who had slip 47 in 2024, 2025, 2026, etc.
- Notes/incident log per slip or slip-holder
- Optional: waitlist management `[LOW — VERIFY Q-A5]`

### 3.2 Document Collection (Pillar 2)

Portal where slip-owners (and approved transients) upload:
- **Certificate of Insurance** — naming Wharfside Manor Condo Association as additionally insured. (Confirmed in handbook for vendors; verify for slip-owners — Q-B2.)
- **Vessel registration** — state registration or USCG documentation.
- **Signed indemnification/hold-harmless** — annual or one-time. `[LOW — VERIFY Q-B3]`
- Other documents per Q-B1.

System features:
- Per-document expiration date (entered manually at upload, or extracted via OCR if feasible later)
- Automated renewal reminder emails at T-60, T-30, T-7 days. `[MEDIUM — VERIFY cadence Q-B3]`
- Review/approval workflow: uploaded → reviewed by ECI → approved or rejected with comment
- Compliance dashboard: % of slip-owners current on all required docs
- Download original docs (PDF/JPG) by reviewer
- Audit log: who uploaded what, when, who approved

### 3.3 Patron Website (Pillar 3)

Public-facing (or hybrid public + gated) website with:
- **Marina rules & regulations** (from WMCA Handbook §Marina Area, expanded)
- **Contact info** — ECI office, Kathy Vanecek, after-hours/emergency lines
- **Dockmaster contact + hours** `[LOW — VERIFY who/what]`
- **Marina map** — slip layout, parking, dumpster, pump-out station (if any)
- **Emergency procedures** — 911, after-hours 732-970-6886, fire/spill response
- **FAQ** — common questions (when does the season open? what docs do I need?)
- **Downloadable forms** — COI template, indemnification form, registration checklist
- **Seasonal notices** — current-year opening/closing dates, work schedule
- **News/updates** — restoration project status, board notices to slip-owners

Branding: Wharfside Manor navy + gold (per existing brand) unless a separate marina sub-brand is desired (Q-C3).

---

## 4. Out of Scope `[HIGH]` (explicit)

**Anything AppFolio does:**
- Billing slip-owners
- Processing payments (credit card, ACH, check)
- Generating invoices or receipts
- Recurring/automatic billing
- 1099 / tax reporting
- General ledger / accounting
- Vendor payments
- Owner account statements

**Anything Dockwa does:**
- Reservation marketplace listing
- Transient discovery and booking by strangers
- Pay-per-night transient billing
- Boater app for finding marinas
- Marinas.com or chart-plotter listings
- Dynamic / demand-based pricing

**Anything that isn't one of the three pillars:**
- POS / ship store / fuel / charter
- Storage scheduling (dry stack, land storage)
- Service work orders (handled in AppFolio or ECI's workflow)
- Wharfside HOA-wide functions (already covered by AppFolio)

---

## 5. Functional Requirements

### 5.1 Slip Assignment (Pillar 1) `[HIGH]`

**FR-1.1 (ECI admin):** As ECI staff, I can view the full slip inventory in a grid, see which slips are assigned and to whom for the current season, and filter by slip class or status.
- *Acceptance:* Grid renders all ~86 slips in <1s. Status badges: "assigned", "open", "waitlist-pending", "out-of-service". Filter by class works without page reload.

**FR-1.2 (ECI admin):** As ECI staff, I can create a slip assignment by selecting a slip + slip-holder + vessel for a given season.
- *Acceptance:* Form prevents duplicate assignment (one slip = one assignment per season). Auto-fills slip-holder contact if previously on record. Saves audit trail (who, when, why).

**FR-1.3 (ECI admin):** As ECI staff, I can view the full history of any slip — every assignment back to system inception, with vessel and slip-holder details.
- *Acceptance:* History view loads in <2s. Tabular timeline. Exportable to CSV.

**FR-1.4 (slip-owner):** As a slip-owner, I can log in and see my own current assignment, vessel record, and contact info on file.
- *Acceptance:* Slip-owner dashboard shows current slip #, vessel summary, contact info. Edit button on contact info; vessel/slip changes require ECI approval.

**FR-1.5 (dockmaster):** As the dockmaster, I can view who is in slip 47 right now (vessel name, owner name, owner phone) on my phone.
- *Acceptance:* Mobile-responsive view. Search "47" → instant result. Tap-to-call owner phone number.

**FR-1.6 (board officer):** As a board officer, I can pull a year-over-year occupancy and assignment-change report.
- *Acceptance:* Report shows occupied/open by class, new assignments, vacated, waitlist length. Exportable to PDF or CSV.

### 5.2 Document Collection (Pillar 2) `[HIGH]`

**FR-2.1 (slip-owner):** As a slip-owner, I can upload my COI, registration, and signed indemnification via the portal.
- *Acceptance:* Upload supports PDF + JPG + PNG, max 25MB. Each upload tagged with doc type, expiration date, notes. Drag-and-drop from desktop; file picker from mobile.

**FR-2.2 (slip-owner):** As a slip-owner, I receive email reminders before my COI / registration expires.
- *Acceptance:* Reminders sent at T-60, T-30, T-7 days. One-click link to upload portal. Suppressed if owner has already uploaded the renewal.

**FR-2.3 (ECI admin):** As ECI staff, I can see a queue of newly-uploaded docs awaiting review.
- *Acceptance:* Queue view oldest-first. Click → PDF preview in browser. Approve / reject buttons. Reject requires a comment that emails the slip-owner.

**FR-2.4 (ECI admin):** As ECI staff, I can see a compliance dashboard showing % of slip-owners current on all required docs, with drill-down to non-compliant.
- *Acceptance:* Dashboard: total slip-owners, % fully compliant, % with any expired/missing doc, drill-down list. Refresh nightly.

**FR-2.5 (board officer):** As a board officer, I can review the compliance summary without granular write access.
- *Acceptance:* Read-only compliance view.

**FR-2.6 (audit):** As ECI or a board officer, I can see the full audit log of who uploaded what, when, who approved/rejected.
- *Acceptance:* Audit view filterable by slip-owner, doc type, date range. Exportable to CSV.

### 5.3 Patron Website (Pillar 3) `[HIGH]`

**FR-3.1 (public visitor):** As a member of the public, I can visit a marina website and read the rules, contact info, and emergency procedures.
- *Acceptance:* Public site accessible without login. Loads <2s on mobile 4G. Mobile-responsive.

**FR-3.2 (slip-owner):** As a slip-owner, I can download blank forms (COI template, indemnification, registration checklist).
- *Acceptance:* Forms page lists each form with description and download button. Files served from object storage.

**FR-3.3 (ECI admin):** As ECI staff, I can update the news/notices section of the patron site without writing code.
- *Acceptance:* Simple admin UI (rich-text editor or Markdown). Publish/unpublish toggle. Change reflected within 60 seconds.

**FR-3.4 (public visitor):** As a visitor, I can view a marina map showing slip layout and key landmarks.
- *Acceptance:* Static SVG or image-based map. Mobile-zoomable.

---

## 6. Non-Functional Requirements `[MEDIUM]`

| Category | Requirement | Rationale |
|---|---|---|
| **Performance** | Pages render <2s on 4G mobile. Admin queries <1s for typical loads. | Low-traffic HOA scale. |
| **Availability** | 99% uptime. No 24/7 SLA. | This is HOA-scale, not boater-marketplace-scale. |
| **Backup** | Daily automated backup; 30-day retention; RPO ≤24h, RTO ≤24h. | Standard low-criticality. |
| **Security** | HTTPS everywhere. PII encrypted at rest. Documents in private object storage with signed-URL access. Hashed passwords (bcrypt/argon2) or magic-link. | Owner PII + insurance docs require care. |
| **Data export** | One-click CSV export of all structured data. One-click zip of all uploaded docs. | Anti-lock-in. Required (Q-F3). |
| **Accessibility** | WCAG 2.1 AA for patron site. Admin can be looser. | Patron site reaches the public. |
| **Mobile** | Patron site + slip-owner dashboard fully mobile-responsive. Admin can be desktop-first. | Slip-owners use phones at the dock. |
| **Audit logging** | Every write action logged with user, timestamp, before/after state. | Governance / dispute resolution. |
| **Compliance** | No PCI scope (no payments). No HIPAA. Standard PII. | Payments explicitly out of scope. |

---

## 7. Technical Requirements `[RECOMMENDATION — VERIFY Q-F1]`

### 7.1 Recommended Stack (solo-developer-friendly)

| Layer | Recommendation | Rationale |
|---|---|---|
| **Frontend** | Next.js 14+ (React + TypeScript) | Nick has React experience (Batter Up, Cage Match). SSR for patron-site SEO. |
| **Backend** | Next.js API routes, or a thin FastAPI service | Either works. |
| **Database** | PostgreSQL (managed — Cloud SQL or Supabase) | Relational fit for slips/owners/assignments. |
| **Document storage** | Google Cloud Storage or S3-compatible | Signed URLs. ~$0.02/GB/mo. |
| **Auth** | Magic-link (passwordless) via NextAuth, Clerk, or Supabase Auth | Retirement-skewed users → reduce password support burden. |
| **Email** | Postmark, SendGrid, or Resend | Renewal reminders; low volume free tier. |
| **Hosting** | GCP Cloud Run + Cloud SQL (consistent with Cage Match/Batter Up) OR Vercel + Supabase | Cloud Run scales to zero. |
| **CMS for patron site** | Markdown in repo with simple admin form, OR a hosted headless CMS (Sanity, Contentful, Decap) | Lightest-weight that non-tech ECI staff can edit. |
| **OCR for doc expiration extraction** | Google Cloud Vision API (optional, v2) | Nice-to-have, not MVP. |
| **Monitoring** | Cloud Logging + Cloud Monitoring (or Sentry) | Standard. |

### 7.2 Hosting Cost Estimate `[MEDIUM]`

- Cloud Run: $0–10/mo (scales to zero)
- Cloud SQL (smallest instance): ~$15–25/mo
- Cloud Storage: <$5/mo for ~10GB of docs
- Email service: $0–10/mo (low transactional volume usually free)
- Domain: $15/year
- **Total: ~$30–50/mo** — well within HOA budget if approved

### 7.3 Integration: AppFolio `[VERIFY: Q-D2 — AppFolio API availability for this customer]`

**Known facts (from web research, May 2026):**
- AppFolio has an API platform: **AppFolio Stack** with a partner program.
- AppFolio Stack Premium is included with **AppFolio Property Manager Plus**, available as a paid add-on for the base AppFolio Property Manager product.
- Third-party providers (e.g., **Skywalk API**) sell wrappers for AppFolio data access.
- Becoming an official AppFolio API partner requires a multi-stage application + certification.

**Unknowns:**
- Does ECI/Ideal Management have AppFolio Plus or base?
- Has ECI offered API access to the Wharfside board, or is it gated by their commercial relationship with AppFolio?
- Practical timeline for partner certification?

**Options ranked by simplicity:**

1. **No integration (recommended for MVP).** The new system owns its own slip-owner contact data, entered manually or imported from a one-time CSV export from AppFolio. AppFolio remains the truth for billing; this system displays no AppFolio-sourced data live.
2. **Manual CSV sync.** ECI exports slip-owner contact info from AppFolio periodically (monthly or per-season). The new system imports it. No live connection.
3. **Live API integration.** Pursue AppFolio Stack partner certification, or pay for Skywalk API. Estimated 2–4 months of bureaucratic + integration work. Justified only if real-time paid-up status is operationally essential.

**Recommendation:** Ship MVP as Option 1. Revisit Option 3 in v2 if there's a clear operational pain point.

---

## 8. User Experience (UX) `[MEDIUM]`

### 8.1 Personas

- **Kathy at ECI** — middle-aged, busy, juggles HOA work for multiple properties, lives in AppFolio all day. Wants: minimum clicks, no surprises, exportable everything.
- **Dockmaster (TBD)** — possibly a retiree or part-time. Wants: mobile UI on iPhone at the dock, tap-to-call owners, search by slip number.
- **Slip-owner (typical)** — 50s–80s, NJ resident, owns a 25–40ft boat, low digital literacy. Wants: magic-link login, big buttons, "upload my insurance" as obvious flow.
- **Board officer** — quarterly engagement. Wants a dashboard that loads fast and tells them whether things are on track.
- **Public visitor** — looking for marina rules or contact phone on a phone. Wants the answer in three taps.

### 8.2 Information Architecture

```
Patron site (public)
├── Home (marina overview)
├── Rules & Regulations
├── Contact (ECI office, after-hours, dockmaster)
├── Emergency Procedures
├── Marina Map
├── Forms (downloadable)
├── FAQ
├── Seasonal Info & Notices
└── Login → Slip-owner Dashboard (gated)

Slip-owner Dashboard (logged in)
├── My Slip (current assignment)
├── My Vessel (record on file)
├── My Documents (upload + status)
├── My Contact Info (edit)
└── Help

Admin (ECI, dockmaster, board)
├── Slip Inventory & Assignments
├── Slip-owner Directory
├── Document Review Queue
├── Compliance Dashboard
├── History & Reports
├── Audit Log
├── Patron Site Content Editor
└── Users & Roles
```

### 8.3 Key UX Principles

- Magic-link login for slip-owners (no passwords for retirement-age users).
- Mobile-first for slip-owner + public pages; desktop-first for admin.
- Always export. Every data view has a CSV button.
- Confirmations on destructive actions (delete assignment, reject doc).
- Read-only by default for board officers; write requires ECI role.

---

## 9. Build vs. Buy vs. Stitch — Honest Analysis `[HIGH]`

With the **corrected** scope (no payments, no marketplace, no Dockwa-equivalent), the build-vs-buy math changes materially. The hard, defensive parts of marina software are no longer in scope. What's left is genuinely small.

### 9.1 Buy: Dockwa or competitor

**Verdict: Wrong tool.** Dockwa is a reservation marketplace + payments + boater discovery platform. None of those are in scope here. Dockwa would force a billing path that conflicts with AppFolio. Dockwa's document collection is weak. Dockwa's rules-page hosting is non-existent. **Eliminate Dockwa from consideration.**

DockMaster, MARINAGO, Storable Marine — similar reasoning. They are full marina ERPs designed around payments and operations far broader than this scope. Overkill and budget-prohibitive ($300+/mo) for a no-payments use case.

### 9.2 Stitch: No-code + off-the-shelf

The honest read at the corrected scope:

| Need | Off-the-shelf option | Approx Cost |
|---|---|---|
| Slip assignment tracking | Airtable, Google Sheet, or AppFolio custom fields | $0–24/mo |
| Document collection + expiration | Box, Dropbox, or Google Drive (folder per slip-owner); expiration in Airtable | $5–15/user/mo |
| Patron website | Squarespace, Wix, or static site (GitHub Pages / Netlify) | $0–24/mo |
| Renewal reminders | Airtable automations, or Mailchimp triggered campaigns | $0–15/mo |
| Owner login + access | Squarespace member areas or Notion | $0–24/mo |

**Total stitched cost: ~$30–80/mo. Build time: a few weekends of setup. Zero code maintenance.**

### 9.3 Build: Custom Next.js app

**Total monthly cost: ~$30–50/mo** (cloud infra, no SaaS fees)
**Build time: estimate 80–150 hours of solo work for MVP** (3 months at 10–12 hrs/week)
**Maintenance: ongoing — pager-style ownership for as long as Nick stays on the board**

### 9.4 Honest Verdict `[HIGH]`

With the corrected scope, the **custom build is no longer obviously justified by capability**. The stitched approach (Airtable + Box + Squarespace + Mailchimp/Airtable automations) covers ~80% of the functionality at lower cost, zero code maintenance, and dramatically better bus-factor outcome. ECI staff are far more likely to use Airtable or Google Drive than a bespoke web app.

**The build is justified IF and ONLY IF:**

1. **ECI insists on a single integrated UI** — they don't want to learn three new tools.
2. **The UX of the integrated experience is materially better for slip-owners** — magic-link login, one place to upload, one place to see their slip — vs. emailing Kathy.
3. **Nick wants the project for portfolio/learning value** (legitimate, but should be called out as a separate motivation, not load-bearing on operational need).
4. **The patron website needs custom integrations** with the slip data (e.g., live "X slips available" or seasonal notices keyed to assignment data).

**The build is NOT justified by:**
- Scope size (it's small now)
- Cost savings (stitched is cheaper)
- Capability gap (off-the-shelf covers it)

**Recommended decision path:**

1. Confirm ECI's actual reaction (Q-G4) — would they use a custom tool or prefer Airtable + Drive?
2. If ECI prefers stitched: ship the stitched version in 2026 as a pilot. Reassess in 2027 with usage data.
3. If ECI insists on a custom tool: build the MVP, scope tight, with explicit kill criteria.
4. If Nick is building for portfolio/learning: be honest about it and scope accordingly (smaller, hobbyist).

---

## 10. MVP Scope (Smallest Usable for Spring 2027) `[HIGH]`

If the decision is to build, the MVP is:

**Must-have:**
1. Slip inventory + current-season assignments (admin UI, importable from CSV)
2. Slip-owner directory + contact info (admin UI; slip-owner self-edit on contact)
3. Vessel record per slip-owner
4. Document upload (COI, registration, indemnification) with manual expiration entry
5. Email renewal reminders (T-30 only at MVP; expand to T-60/T-7 in v2)
6. Patron website: rules, contact, emergency, map, forms, FAQ (markdown-driven, edited by code commit at MVP)
7. Magic-link auth for slip-owners; password auth for admin
8. CSV export of slip data + doc index
9. Audit log of writes

**Defer to v2:**
- Compliance dashboard (manually pull in MVP via export)
- Multi-stage doc approval workflow (single-reviewer in MVP)
- OCR expiration extraction
- Waitlist management
- AppFolio integration (any flavor)
- Patron-site CMS UI for non-developers (markdown-by-commit in MVP is OK if Nick is the only editor)
- Mobile native app (web-responsive sufficient)

**MVP timeline target:** September 2026 functional preview to ECI; January 2027 board review; April 2027 go-live. `[MEDIUM — VERIFY Q-G1]`

---

## 11. Dependencies & Assumptions

### 11.1 Dependencies `[MEDIUM]`

- **ECI buy-in.** ECI must agree to be the admin user. Without this, the project has no users.
- **Board approval.** Hosting budget, domain, branding, document retention policy all need board sign-off.
- **AppFolio status** (only if integration is pursued). Requires ECI confirmation of plan tier + API access.
- **Domain.** Subdomain of wharfsidemb.com OR new (wharfsidemarina.com).
- **Branding.** Existing Wharfside navy/gold palette; logo at https://raw.githubusercontent.com/nickdnj/wharfside-assets/master/Wharfside_Logo_Cropped.png.
- **Marina restoration completion.** Restoration affects slip count and layout. Per April 2026 status: DEP approval secured, construction planning underway. Final slip layout should be locked before MVP go-live.
- **Initial slip-owner data.** Obtainable from ECI/AppFolio (export or manual transfer of ~86 owner records).

### 11.2 Assumptions `[MEDIUM]`

- ~86 slips; minor variance fine. `[LOW — VERIFY Q-A1]`
- Slip assignments are predominantly fixed annually (same owner = same slip). `[LOW — VERIFY Q-A2]`
- Required documents: COI + registration + indemnification. `[LOW — VERIFY Q-B1]`
- COI must name Wharfside Manor Condo Association as additionally insured. `[MEDIUM — implied from handbook vendor language]`
- Transient activity is limited or zero. `[LOW — VERIFY Q-A4]`
- Slip-owners willing to use a web portal (vs. paper/email). `[LOW — VERIFY Q-G2]`
- ECI will adopt the tool. `[HIGH RISK — VERIFY Q-G4]`
- Nick remains on the board for at least the MVP lifecycle (through 2027). `[MEDIUM]`

---

## 12. Risks `[HIGH]`

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **ECI doesn't adopt the tool** | Medium-High | Critical (kills project) | Get explicit ECI commitment before building. Q-G4 is the make-or-break question. If lukewarm, switch to stitched alternative. |
| **Nick rolls off the board** | Medium | High (maintenance orphan) | Scope MVP small. Document handoff. Prefer hosted services over self-hosted. Consider stitched alternative for handoff-ability. |
| **AppFolio integration complexity** | High (if pursued) | Medium | Defer integration; ship MVP without it. Revisit in v2 only if operationally essential. |
| **Marina Restoration changes slip count/layout** | Medium | Low-Medium | Build slip inventory as configurable data, not hardcoded. Easy re-import after restoration final. |
| **Scope creep into billing or reservations** | Medium | High | Explicit "out of scope" section here; refer back when feature requests arrive. |
| **Slip-owner adoption (low digital literacy)** | Medium | Medium | Magic-link auth; large buttons; phone support during launch. |
| **Board approval gates delay launch** | Medium | Medium | Identify and pre-clear all gates in Q-F5 before starting build. |
| **Sec 24(B) 1995 marina loan structure** introduces unexpected constraints | Low-Medium | Medium | Hubert Cutolo review before architecture commits. |
| **Privacy/legal exposure on stored insurance docs** | Low | Medium | Private object storage with signed-URL access; document retention policy approved by board. |

---

## 13. Open Questions

These map 1:1 to `discovery-questions.md`. Critical path:

- **Q-G4 — ECI adoption commitment.** Without this, nothing else matters.
- **Q-A1 — Slip count post-restoration.**
- **Q-A2 — Fixed vs. rotating assignments.**
- **Q-A4 — Transient activity scope.**
- **Q-B1 — Required document list.**
- **Q-D2 — AppFolio API availability.**
- **Q-F2 — Bus factor / handoff plan.**
- **Q-G1 — Anchor launch date.**

See `discovery-questions.md` for the full set (A through G).

---

## 14. Success Criteria (proposed) `[MEDIUM — VERIFY Q-G2]`

Six months post-launch, "this worked" looks like:

1. ≥80% of slip-owners have a current (non-expired) COI + registration on file in the system.
2. ECI staff log in at least weekly and report it as the primary place they go for slip info.
3. Patron website is the first Google result for "Wharfside Marina rules" or equivalent local searches.

"This failed" looks like:

1. ECI continues to use email/spreadsheets instead, OR
2. <30% of slip-owners ever log in to the portal, OR
3. Nick spends more than 4 hours/month on maintenance after the first 90 days.

---

## 15. Appendix — Key Wharfside Facts

- **Slip count:** ~86 boat slips along the Shrewsbury River (Master Deed). Verify post-restoration.
- **Property type:** ~150-unit condominium in Monmouth Beach, NJ; marina is an adjacent property accessed via perpetual easement.
- **Property management:** East Coast – Ideal Management (ECI), Kathy Vanecek, 732-751-1991, kathy.vanecek@idealmgt.com. After-hours: 732-970-6886. Mailing PO Box 730, Oakhurst NJ 07755. Office 331 Newman Springs Rd, Bldg 1 Ste 143, Red Bank NJ 07701.
- **Property management platform:** AppFolio Property Manager (used for owner accounts, payments, vendor insurance docs, work orders).
- **Marina rules (excerpted from WMCA Handbook 2025, §Marina Area):**
  - Boat slips available to residents and non-residents through the management office.
  - Slips are for boat owners who rented them and their guests.
  - Children not permitted on bulkhead walkway unattended.
  - Fishing/crabbing only from bulkhead walkway unless posted.
  - No bikes/skateboards in marina area.
- **Marina Restoration project:** Active April 2026. DEP Land Use Approval secured. Meeco Sullivan + Falcon Engineering involved.
- **Insurance broker:** Baldwin Insurance, (732) 837-1029.
- **Board (2026):** Giuseppe Gencarelli (Pres), Mike Serhat (VP), Nick DeMarco (Sec), Linda Masessa (Treas, CPA/CAMS), Thomas Bopp, Roberta Attanasi, Anthony D'Anna, Timmy Mucaj, Gary Passenti.
- **Attorney:** Hubert Cutolo (Cutolo Barros).
- **Brand:** navy `#1a3a5c`, gold `#c9a227`. Logo at github.com/nickdnj/wharfside-assets.
- **Master Deed Sec 24(B), 1995:** Marina loan structure — referenced as load-bearing for marina governance/financing. Verify with Hubert before architecture decisions touching marina finances.

---

*End of draft v0.2. Next step: Nick answers `discovery-questions.md`; PRD updates to v0.3 with locked-in answers and final build-vs-stitch decision.*
