# Wharfside Marina — Product Requirements Document (v0.2)

**Project:** `wharfside-marina`
**Status:** Draft v0.2 — pre-architecture, session decisions consolidated. **Q-G4 RESOLVED 2026-05-19: Kathy/ECI has confirmed she wants Nick to build this.** Critical adoption gate cleared.
**Author:** Product Requirements agent (Software Project team)
**Date:** 2026-05-19
**Sponsor:** Nick DeMarco (Secretary, Wharfside Manor Board)
**Operator (primary admin):** East Coast – Ideal Management (ECI), Kathy Vanecek
**Anchor target:** Spring 2027 marina season (April 2027 go-live) `[MEDIUM — VERIFY]`

---

## Revision History

| Version | Date       | Author | Notes |
|---------|------------|--------|-------|
| 0.1     | 2026-05-19 | Product Requirements (prior pass) | Initial discovery; over-scoped (billing path, reservation marketplace, transient self-booking). |
| 0.2 (corrected scope) | 2026-05-19 | Product Requirements (prior pass) | Scope corrected to three pillars: slip assignment, document collection, patron website. AppFolio owns billing. |
| **0.2 (this doc)** | **2026-05-19** | **Product Requirements (this pass)** | **Consolidated all session decisions. Added 4th pillar: Pricing Engine + Scenario Modeler. Three holder types defined. Versioned marina configuration. Slip-fit constraints with admin override. Transient request workflow. Fee schedule state machine. Build-vs-stitch verdict re-flipped: custom build is now justified.** |

---

## Confidence Legend

- `[HIGH]` — Confirmed by sponsor in session, by governing docs, or by handbook.
- `[MEDIUM]` — Reasonable inference; verifiable but not load-bearing.
- `[LOW — VERIFY]` — Placeholder; tracked in Section 8.
- `[ASSUMPTION — VERIFY]` — Inferred from session context, not explicitly confirmed.

---

## 1. Overview & Purpose `[HIGH]`

Wharfside Manor operates a private marina of **~86 boat slips** on the Shrewsbury River, adjacent to a ~150-unit condominium in Monmouth Beach, NJ. The marina is managed day-to-day by **East Coast – Ideal Management (ECI)**, the contracted property manager. ECI uses **AppFolio Property Manager** as the platform of record for owner accounts, billing, and accounting. A **Marina Restoration Project** (DEP-approved; Meeco Sullivan + Falcon Engineering) is active; final slip layout may change before MVP go-live.

Today, slip assignments are tracked informally; required documents (insurance, registration, indemnification) are collected via email; there is no patron-facing site for rules or emergency info; and there is no tool for modeling alternative fee structures — a gap that matters because the **Master Deed Sec 24(B) (1995)** governs marina-loan structure and is load-bearing for any pricing change.

**This system consolidates four operational needs into a single tool:**

1. **Slip Assignment + Marina Operations** — internal ops tool for ECI and the dockmaster: who is in which slip, with vessel and owner details, with season-over-season history.
2. **Document Collection** — owner and vessel portal with expiration tracking and automated reminders.
3. **Patron-facing Website** — public + gated pages with rules, contact, map, emergency procedures, FAQ, and forms.
4. **Pricing Engine + Scenario Modeler** — active fee schedule (resolves what each slip-holder owes per season), what-if scenario modeling (project revenue under hypothetical rate cards), and an audit-tracked approval workflow with CSV export to AppFolio.

### What this is NOT `[HIGH]`

| Out of Scope | Why |
|---|---|
| Billing / invoicing / payments | AppFolio owns this. The pricing engine exports line items; it does not collect money. |
| Financial accounting / GL | AppFolio + ECI accounting workflow. |
| Reservation marketplace (Dockwa-style) | Slips are owned/leased annually. No public discovery. |
| Boater app / public booking | Not a marketplace. |
| POS, ship store, fuel, charter | None of these exist at Wharfside. |
| Dry stack or launch scheduling | Wet slips only; fixed/seasonal. |
| Wharfside HOA-wide functions (work orders, owner ledgers, vendor mgmt) | AppFolio. |

---

## 2. Scope

### 2.1 Stakeholders `[HIGH]`

| Stakeholder | Role | Engagement |
|---|---|---|
| **ECI (Kathy Vanecek + team)** | Operator. Day-to-day marina admin. | **Primary admin user.** Critical adoption risk. |
| **Dockmaster** | Day-to-day boots on the ground; may be Kathy/ECI staff, a paid contractor, or volunteer. `[LOW — VERIFY]` | Mobile read/write on assignments, transient queue, doc review. |
| **Wharfside Board** | Oversight + approval. Pres Giuseppe, VP Mike Serhat, Sec Nick, Treas Linda (CPA/CAMS) + 5 trustees. | Read-only on most; **Treasurer Linda is primary user of Scenario Modeler**. |
| **Slip-owner — Resident** | Wharfside condo unit owner with slip. Discounted slip rate; amenity fee waived. (Whether unit renters qualify: see Q-OWN1.) | Boater portal: own assignment, vessel record, documents, contact info. |
| **Slip-owner — Non-Resident** | Non-Wharfside-owner holding a slip lease. Full slip rate; pays amenity fee if introduced. No buy-in. No secondary market. | Boater portal: same as resident. |
| **Transient** | Short-stay visitor. Not self-service. Submits public request form. | Public form only; ECI/dockmaster approves or denies. |
| **Public visitor** | Anyone reading rules, contact, emergency, map. | Read-only public pages. |
| **Wharfside attorney (Hubert Cutolo, Cutolo Barros)** | Reviews indemnification, fee schedule changes touching Sec 24(B). | Policy gates. |
| **Insurance broker (Baldwin Insurance)** | COI minimums + additional-insured language. | Consulted for COI policy. |

### 2.2 MVP vs. Phase 2+ `[HIGH]`

**MVP (target Spring 2027 launch — April 2027 go-live):**

- 3.1 Marina Configuration (versioned; visual map; slip metadata incl. tier + fee_modifier)
- 3.2 Holder Management (3 types; identity + contact + role)
- 3.3 Slip Assignment (annual; slip-fit enforcement with admin override; history)
- 3.4 Transient Request Workflow (public form → ECI queue → approve/deny/hold)
- 3.5 Document Collection (COI + registration + indemnification + others; expiration tracking; reminders at 60/30/7/0; approval workflow)
- 3.6 Pricing Engine + Scenario Modeler (Active Fee Schedule + Modeler + Library; state machine; CSV export to AppFolio)
- 3.7 Board Reporting (compliance dashboard; assignment + occupancy reports; revenue projection)
- 3.9 Patron Website (rules, contact, emergency, map, forms, FAQ, services directory, NOAA embed, transient request form, slip-owner login)

**Phase 1.5 enhancements (post-launch hardening, late 2027):**

- COI parsing (OCR/LLM extract of carrier, policy #, limits, expiration)
- Waitlist management
- Multi-stage doc approval workflow
- Bulk season-end export ZIP for ECI
- Photo gallery + news/notices content editor for non-developer

**Phase 2+ (2028+):**

- 3.8 AppFolio Stack API integration (live push of approved fee schedule)
- Mobile native app (web-responsive sufficient for MVP)
- Public-facing slip availability widget (only after restoration layout final)
- Per-foot pricing engine variant (if rate model evolves)

---

## 3. Functional Requirements

### 3.1 Marina Configuration `[HIGH]`

**Concept:** the marina layout itself is a first-class versioned entity. Pre- and post-restoration layouts must coexist; a season's assignment ties to the layout version active on that season's effective_date.

**Slip entity attributes:**
- `slip_number` (e.g., "47", "A-12")
- `position` (map coordinates / polygon coords for visual map)
- `loa_limit_ft` (max vessel length-overall)
- `beam_limit_ft` (max vessel beam)
- `min_depth_at_mlw_ft` (minimum water depth at mean low water — drives draft constraint)
- `type` (covered / open / end-tie / side-tie)
- `amenities` (30A power, 50A power, water, pump-out adjacency)
- `status` (active / out-of-service / restoration-pending)
- `tier` (Premium / Standard / Restricted) — feeds pricing
- `fee_modifier` (multiplier on base rate for premium surcharge)
- `tide_exposure_notes` (free text — wind exposure, current notes)
- `slip_config_version_id` (FK to config version)

**Config version entity:**
- `version_id`, `effective_date`, `name` (e.g., "Pre-Restoration 2026", "Post-Restoration 2027"), `notes`, `is_active` (only one active)

**FR-3.1.1 (admin):** As ECI staff, I can create a new marina configuration version with a name, effective date, and notes; clone slips from the prior version as a starting point.
- *Acceptance:* New version created with cloned slips in <5s. Editable independently of prior versions. Cannot delete a version that has assignments.

**FR-3.1.2 (admin):** As ECI staff, I can edit any slip's attributes on the active or future config version.
- *Acceptance:* Edits saved with audit (who, when, before/after). Cannot edit a version locked by historical assignments unless an admin-with-override role confirms.

**FR-3.1.3 (admin):** As ECI staff, I can view a visual marina map with all slips rendered as clickable polygons over a background diagram, color-coded by status/tier.
- *Acceptance:* Medium-fidelity. Background is a PNG/SVG marina diagram; slip polygons defined in JSON. Click a slip → side panel with full attributes, current assignment, fit history. Mobile-responsive (pinch-zoom).
- *Out of scope:* Photo-realistic CAD rendering. Live drone overlay.

**FR-3.1.4 (admin):** As ECI staff, I can mark a config version as Active. Only one version is Active at a time.
- *Acceptance:* Activating a version sets prior Active to Archived. Assignment workflows use the Active version's slip set. Audit logged.

### 3.2 Holder Management `[HIGH]`

**Holder types:**
- `resident` — Wharfside condo unit owner. Discounted slip rate. Amenity/resort fee waived (included in HOA dues if such a fee is introduced). `[ASSUMPTION — VERIFY]` Whether unit *renters* also qualify is Q-OWN1.
- `non_resident` — Slip lessee who is not a Wharfside unit owner. Full slip rate. Pays amenity fee if introduced. No buy-in. No secondary market.
- `transient` — Short-stay visitor. Per-foot per-night rate. Approved per request; no annual record.

**Holder entity attributes:**
- `holder_id`, `type`, `legal_name`, `phone`, `email`, `mailing_address`, `emergency_contact_name`, `emergency_contact_phone`
- For residents: `wharfside_unit_number` (FK to condo unit)
- `status` (active / inactive / suspended)
- `created_at`, `created_by`
- `notes` (free text, ECI use)

**FR-3.2.1 (admin):** As ECI staff, I can create, edit, and deactivate a holder record (resident or non-resident).
- *Acceptance:* Form validates required fields by type. Audit on every change. Cannot delete a holder with historical assignments — only deactivate.

**FR-3.2.2 (holder):** As a resident or non-resident holder, I can log in and edit my own contact info; vessel and assignment changes require ECI approval.
- *Acceptance:* Magic-link login. Edit button on contact; vessel/slip changes submit a request to ECI. Audit trail.

**FR-3.2.3 (admin):** As ECI staff, I can search holders by name, slip number, vessel name, or unit number.
- *Acceptance:* Instant search (<500ms). Filter by type and status.

### 3.3 Slip Assignment (annual) `[HIGH]`

**Vessel entity (1:N per holder):**
- `vessel_id`, `holder_id`, `name`, `loa_ft`, `beam_ft`, `draft_ft`, `hull_color`, `propulsion_type`, `uscg_doc_or_state_reg`

**Assignment entity:**
- `assignment_id`, `slip_id` (FK to specific config_version), `holder_id`, `vessel_id`, `season_year`, `start_date`, `end_date`, `status` (proposed / confirmed / closed / canceled), `created_by`, `created_at`, `override_reason` (nullable; populated only when fit constraints were overridden)

**FR-3.3.1 (admin):** As ECI staff, I can create a slip assignment by selecting slip + holder + vessel for a season.
- *Acceptance:* Form blocks duplicate assignments (one slip per season). Auto-fills holder if previously on record. Audit trail on save.

**FR-3.3.2 (admin) — SLIP-FIT ENFORCEMENT:** As ECI staff, the system blocks assignment if `vessel.loa_ft > slip.loa_limit_ft` OR `vessel.beam_ft > slip.beam_limit_ft` OR `vessel.draft_ft + safety_margin > slip.min_depth_at_mlw_ft` (default safety margin: 0.5 ft `[ASSUMPTION — VERIFY]`).
- *Acceptance:* Blocking message names the failing dimension with the specific values. No silent block.

**FR-3.3.3 (admin) — ADMIN OVERRIDE:** As ECI staff with admin role (Kathy/dockmaster), I can override a slip-fit block by entering a required justification text.
- *Acceptance:* Override button surfaces only after a block. Justification ≥20 characters required. Override saved on the assignment record (`override_reason`), exposed in audit log and in a "Slip-fit overrides" report.

**FR-3.3.4 (admin):** As ECI staff, I can view the full history of any slip — every assignment back to inception, vessel and holder details, exportable to CSV.
- *Acceptance:* History timeline renders in <2s. Filter by season range. CSV export with one click.

**FR-3.3.5 (dockmaster, mobile):** As the dockmaster, I can look up who is in slip 47 right now on my phone, with vessel name, owner name, owner phone (tap-to-call).
- *Acceptance:* Mobile-responsive. Search "47" → result in <1s. Tap-to-call works on iPhone Safari + Android Chrome.

### 3.4 Transient Request Workflow `[HIGH]`

**Public request form (no login):**
- Requester contact (name, phone, email)
- Vessel details (name, LOA, beam, draft)
- Requested arrival + departure dates
- Purpose / notes
- Acknowledgment of marina rules (checkbox)

**ECI queue features:**
- Calendar view of transient slip availability (TBD: which slips are designated transient — Q-TR1)
- Each request: approve / deny / hold
- Approve: assign specific slip + dates; auto-send confirmation email with COI + registration upload link (deadline 48h post-approval)
- Deny: auto-send email with reason
- Hold: send "request more info" email; track as pending

**FR-3.4.1 (public):** As a boater, I can submit a transient slip request via a public form without an account.
- *Acceptance:* Form accessible from patron site `/transient`. Required fields validated. Confirmation page + email to requester ("we've received your request"). Submission written to queue.

**FR-3.4.2 (admin):** As ECI staff or dockmaster, I can view a transient request queue and a calendar of transient slip availability for the requested dates.
- *Acceptance:* Queue shows pending oldest-first. Calendar overlays requested dates on the transient-designated slips with conflicts highlighted.

**FR-3.4.3 (admin):** As ECI, I can approve a transient request, assigning a specific slip and dates. The system creates a short-term assignment and emails the requester with an upload link valid for 48 hours.
- *Acceptance:* Approval creates a transient assignment with `type=transient` and slip-fit checked (overridable). Confirmation email sent within 60s. Upload link expires 48h after approval; expired links return a friendly error.

**FR-3.4.4 (admin):** As ECI, I can deny a transient request with a reason; requester receives an email with that reason.
- *Acceptance:* Denial requires reason text ≥20 chars. Email sent within 60s.

**FR-3.4.5 (admin):** As ECI, I can put a request on Hold and send a request-for-more-info email.
- *Acceptance:* Hold state visible in queue; requester can resubmit info; admin can then approve or deny.

**Open questions for this module:** number of transient slips, typical stay length, who reviews (likely Kathy/ECI), transient pricing — see Section 8.

### 3.5 Document Collection `[HIGH]`

**Document types (per holder + per vessel):**
- COI (insurance) — annual
- Vessel registration (state or USCG documentation) — 1–3 yr depending on state
- Indemnification / hold-harmless waiver — annual or one-time `[VERIFY]`
- Captain credential — if applicable to the vessel
- Vessel survey — if required (typically for older vessels or higher-value insurance)

**Doc entity:**
- `doc_id`, `holder_id` OR `vessel_id` (one of), `doc_type`, `file_url` (signed-URL object storage), `uploaded_at`, `uploaded_by`, `expiration_date`, `status` (current / expiring / expired / missing), `review_status` (pending / approved / rejected), `reviewer_id`, `review_notes`, `version` (revisions on the same doc type stack)

**Reminder cadence:** automated emails at **T-60, T-30, T-7, and T-0** days before expiration. Suppressed once a renewal upload is approved.

**Status badges** (computed):
- **Current** — approved, not expiring within 60 days
- **Expiring** — approved, within 60 days of expiration
- **Expired** — past expiration_date
- **Missing** — required for this holder/vessel and never uploaded

**FR-3.5.1 (holder):** As a slip-owner, I can upload my COI, registration, indemnification, captain credential, and survey through the portal.
- *Acceptance:* Drag-and-drop on desktop; file picker on mobile. PDF/JPG/PNG up to 25MB. Upload tags doc type + expiration date (manual entry at MVP).

**FR-3.5.2 (holder):** As a slip-owner, I receive automated reminders at 60, 30, 7, and 0 days before any document expires.
- *Acceptance:* Email sent at the cadence above. One-click link back to portal. Suppressed if renewal already approved.

**FR-3.5.3 (admin):** As ECI staff, I can see a queue of uploads awaiting review, approve or reject with a comment.
- *Acceptance:* Queue oldest-first. PDF preview in-browser. Approve / reject buttons. Reject requires comment ≥20 chars; comment emailed to holder.

**FR-3.5.4 (admin):** As ECI staff, I can view a compliance dashboard showing % of holders current on all required docs, with drill-down to non-compliant holders.
- *Acceptance:* Total holders, % fully compliant, % with any expired/missing doc, drill-down list. Refresh on page load.

**FR-3.5.5 (board):** As a board officer, I have a read-only view of the compliance dashboard.
- *Acceptance:* Same as 3.5.4 minus action buttons.

**FR-3.5.6 (audit):** As any admin, I can see the full audit log of who uploaded what, when, who approved/rejected.
- *Acceptance:* Filterable by holder, doc type, date range. CSV export.

**Phase 1.5:** COI parsing — OCR + LLM extract carrier, policy #, liability limits, expiration; auto-populate fields with human review.

### 3.6 Pricing Engine + Scenario Modeler `[HIGH]`

This is the most differentiated capability and the reason custom build beats Airtable+stitched. Three logical layers:

#### 3.6.1 Active Fee Schedule

The currently-board-approved rate card. Resolves for any season + slip + holder what is owed.

**Charge components (stackable, modeled independently):**
- `base_slip_rate` — per slip tier × holder-type multiplier, OR per-foot × LOA (model variant configurable)
- `amenity_fee` — flat $/year; waived for residents (always included in HOA dues if introduced)
- `buy_in` — one-time onboarding fee. **Wharfside today: $0.** Supported in data model for future or for benchmarking.
- `premium_surcharge` — tied to `slip.tier` / `slip.fee_modifier`
- `transient_nightly_rate` — per-foot per-night

**Holder-type multipliers (Wharfside):**
- Resident: discounted (e.g., 0.75× `[ASSUMPTION — VERIFY]`)
- Non-resident: 1.0× (full)
- Transient: per-foot per-night, distinct rate row

**FR-3.6.1.1 (admin):** As ECI or Linda, I can view the Active Fee Schedule with all components, multipliers, and effective dates.
- *Acceptance:* Single page summarizing every component + multiplier. Linked to the source approval record (audit reference to email/minutes).

**FR-3.6.1.2 (admin):** Given an Active Fee Schedule, the system resolves "Holder X on Slip Y for Season Z owes $TOTAL" with a line-item breakdown.
- *Acceptance:* Resolver function is deterministic; same inputs → same total. Breakdown shows each component and its contribution. Unit-tested.

**FR-3.6.1.3 (admin):** As ECI, I can export the full season's billable line items as a CSV formatted for AppFolio import.
- *Acceptance:* CSV columns aligned with AppFolio's import schema (see Section 3.8). One row per holder. Includes holder name, holder ID, slip #, line-item descriptions, amounts. Downloadable.

#### 3.6.2 Scenario Modeler (what-if)

A separate workspace where an admin edits a *hypothetical* fee schedule and the system recomputes projected revenue across all current assignments.

**FR-3.6.2.1 (admin):** As Linda (Treasurer), I can create a new scenario from the Active Fee Schedule, edit any component or multiplier, and see projected revenue update live.
- *Acceptance:* Side-by-side: Active vs. Scenario. Totals + per-slip-type + per-holder-type splits. Per-holder delta visible on demand. Recomputation <1s for ~86 slips.

**FR-3.6.2.2 (admin):** As Linda, I can save the scenario with a name + notes for later comparison.
- *Acceptance:* Scenarios persist with state (draft / under-review / submitted / approved-superseded). Owner-locked: only the creator + ECI can edit; everyone with admin role can read.

**FR-3.6.2.3 (admin):** As Linda, I can compare two scenarios side-by-side with a third "Active" baseline column.
- *Acceptance:* 3-column compare view. Per-component delta. Per-holder delta export to CSV.

#### 3.6.3 Scenario Library

Saved scenarios with notes, state, comparison view.

**FR-3.6.3.1 (admin):** As Linda, I can browse the Scenario Library, see each scenario's state, projected revenue, and creation metadata.
- *Acceptance:* List view sortable by date, state, projected revenue. Archive (don't delete) scenarios no longer relevant.

#### 3.6.4 Fee Schedule State Machine

```
Draft → Submitted → [export PDF/HTML/CSV] → Approved → Active → Archived
```

| State | Editable by | Notes |
|---|---|---|
| **Draft** | Creator + ECI | Free editing. |
| **Submitted** | (locked) | Frozen at submission. Exportable as PDF / HTML / CSV for board distribution. |
| **Approved** | (locked) | Marked Approved after board approval (out-of-band — email or minutes). Admin records who / when / source-document. |
| **Active** | (locked) | At most one Active per `effective_date` range. Drives all billing exports to AppFolio. |
| **Archived** | (locked, read-only) | Superseded by a new Active. Retained for audit. |

**FR-3.6.4.1 (admin):** As an admin, I can transition a scenario through the state machine via explicit actions (Submit, Approve, Activate, Archive).
- *Acceptance:* Each transition records actor, timestamp, free-text note, and (for Approve) a reference field for the approval-source (email subject/date, meeting minutes ID). Cannot skip states. Cannot edit anything past Draft.

**FR-3.6.4.2 (admin):** As an admin, I can export a Submitted scenario as PDF + HTML + CSV for distribution to the board prior to approval.
- *Acceptance:* PDF + HTML branded with Wharfside logo + scenario name + projected revenue summary + full component breakdown. CSV identical to 3.6.1.3 format but flagged "scenario / not yet active."

**FR-3.6.4.3 (audit):** As anyone with admin role, I can see the full audit trail of every state transition with actor, timestamp, source reference.
- *Acceptance:* Audit view filterable by scenario + date. Immutable.

### 3.7 Board Reporting `[HIGH]`

**FR-3.7.1:** Year-over-year occupancy and assignment-change report. Occupied/open by slip class, new assignments, vacated, waitlist length (Phase 1.5). Exportable to PDF + CSV.

**FR-3.7.2:** Compliance summary (per-doc-type % current, per-holder-type % current, drill-down to non-compliant). Refresh on page load.

**FR-3.7.3:** Active Fee Schedule revenue projection. Total marina revenue forecast for current and next season, with per-component contribution. Exportable.

**FR-3.7.4:** Slip-fit override report. Lists every assignment with `override_reason` populated, the dimension(s) that failed, who overrode, when, justification text. For board oversight.

### 3.8 AppFolio Integration `[HIGH for MVP, MEDIUM for v2]`

**MVP:** **No live integration.** ECI exports the Active Fee Schedule's billable line items as a CSV from this system, then manually imports into AppFolio.

**FR-3.8.1 (MVP):** One-click CSV export of the Active Fee Schedule's billable line items in AppFolio-compatible format.
- *Acceptance:* CSV columns match AppFolio's import schema for charges. Verified against an AppFolio import dry-run with ECI before launch. Includes a header row and a footer row with totals for reconciliation.

**Phase 2 (2028+):** AppFolio Stack API integration. Requires ECI's commercial cooperation (multi-stage partner certification or paid wrapper like Skywalk API). Out of scope for MVP.

### 3.9 Patron Website `[HIGH]`

**Public pages (no login):**
- Marina rules & regulations — lifted from WMCA Handbook §Marina Area
- Dockmaster + ECI contact, after-hours emergency line (732-970-6886)
- Slip map / marina layout (uses the visual map from 3.1.3, simplified, read-only)
- Local services directory (fuel, pump-out, ice, repairs, provisioning, restaurants in Monmouth Beach + Sea Bright)
- VHF channel + approach/hailing instructions
- Emergency procedures (fire / medical / USCG / storm prep)
- Garbage / recycling / pump-out / laundry / shower locations + hours
- FAQ (pets, smoking, overnight generators, dinghy storage)
- Photo gallery (Phase 1.5 CMS)
- Tide / weather / wind embed — NOAA station nearest Wharfside

**Login-gated pages:**
- Slip-owner dashboard (own assignment, vessel, documents, contact info)
- Forms library (slip application, transient request form, indemnification, gate-key request)
- Transient request form

**FR-3.9.1 (public):** As a member of the public, I can read marina rules, contact info, and emergency procedures without logging in.
- *Acceptance:* Public site renders <2s on 4G mobile. WCAG 2.1 AA. Mobile-responsive. NOAA embed loads asynchronously without blocking page render.

**FR-3.9.2 (public):** As a visiting boater, I can submit a transient slip request from the patron site.
- *Acceptance:* See FR-3.4.1.

**FR-3.9.3 (holder):** As a slip-owner, I can log in via magic-link and access my dashboard.
- *Acceptance:* Magic-link arrives in <60s. Session 30 days. No password.

**FR-3.9.4 (admin):** As ECI staff, I can edit news/notices and seasonal info via a simple content editor without writing code.
- *Acceptance:* Phase 1.5 for full CMS. MVP: markdown-by-commit acceptable if Nick is sole editor.

**Branding:** TBD — Wharfside navy `#1a3a5c` + gold `#c9a227` OR ECI co-brand. See Section 8.

---

## 4. Non-Functional Requirements `[MEDIUM]`

| Category | Requirement | Rationale |
|---|---|---|
| **Performance** | Public pages <2s on 4G mobile. Admin queries <1s for typical loads. Scenario recompute <1s for 86 slips. | Low-traffic HOA scale; modeler needs to feel interactive. |
| **Availability** | 99% uptime. No 24/7 SLA. | HOA-scale, not boater-marketplace. |
| **Backup** | Daily automated; 30-day retention; RPO ≤24h, RTO ≤24h. | Low-criticality data. |
| **Security** | HTTPS everywhere. PII encrypted at rest. Documents in private object storage with signed-URL access. Magic-link auth for holders; password+optional 2FA for admins. | Owner PII + insurance docs require care. |
| **Data export** | One-click CSV export of all structured data. One-click ZIP of all uploaded docs per holder (and bulk for ECI in Phase 1.5). | Anti-lock-in. |
| **Accessibility** | WCAG 2.1 AA on patron site. Admin can be looser. | Patron pages reach public. |
| **Mobile** | Patron site + holder dashboard + dockmaster slip-lookup fully mobile-responsive. Admin can be desktop-first. | Holders + dockmaster live on phones at the dock. |
| **Audit logging** | Every write logged with user, timestamp, before/after. State transitions on scenarios + assignments require explicit actor reference. | Governance + disputes. |
| **Compliance** | No PCI (no payments). No HIPAA. Standard PII handling. | Payments explicitly out of scope. |

---

## 5. Technical Requirements `[RECOMMENDATION — VERIFY]`

### 5.1 Recommended Stack

| Layer | Recommendation | Rationale |
|---|---|---|
| **Frontend** | Next.js 14+ (React + TypeScript) | Nick has React experience (Batter Up, Cage Match). SSR for patron-site SEO. |
| **Backend** | Next.js API routes; optional FastAPI for heavy compute (Scenario Modeler) | Single deploy preferred; modeler may justify a separate service if Python is preferred for matrix math. |
| **Database** | PostgreSQL (Cloud SQL or Supabase) | Relational fit. Strong constraints for slip-fit + assignment uniqueness. |
| **Object storage** | Google Cloud Storage with signed URLs | ~$0.02/GB/mo. Standard. |
| **Auth** | Magic-link for holders (NextAuth, Clerk, or Supabase Auth); password+2FA for admins | Retirement-skewed users → reduce password burden. |
| **Email** | Postmark, SendGrid, or Resend | Low volume; transactional. |
| **Hosting** | GCP Cloud Run + Cloud SQL (consistent w/ Cage Match, Batter Up) OR Vercel + Supabase | Cloud Run scales to zero. |
| **CMS (Phase 1.5)** | Decap CMS, Sanity, or simple admin form | Lightest weight; non-tech ECI staff. |
| **OCR (Phase 1.5)** | Google Cloud Vision + Anthropic Claude for COI extraction | Optional; not MVP. |
| **Monitoring** | Cloud Logging + Sentry | Standard. |

### 5.2 Cost Estimate `[MEDIUM]`

- Cloud Run: $0–10/mo (scales to zero)
- Cloud SQL (smallest): $15–25/mo
- Cloud Storage: <$5/mo for ~10GB docs
- Email: $0–10/mo
- Domain: $15/year
- **Total: ~$30–50/mo** — within HOA budget if approved.

### 5.3 Data Model Highlights

- Slip is FK to slip_config_version → versioning preserves history.
- Assignment is FK to slip + holder + vessel + season; uniqueness on (slip_id, season_year) blocks double-assignment.
- Doc is FK to holder OR vessel (XOR constraint), with version stacking on same type.
- Scenario is FK to base config_version + holder set; computation is pure-function over assignments × fee_schedule.
- Audit log is append-only.

---

## 6. UX `[MEDIUM]`

### 6.1 Personas

- **Kathy at ECI** — busy, multi-property, lives in AppFolio. Wants minimum clicks, exportable everything, no surprises.
- **Dockmaster** — likely retiree or part-time. Wants mobile UI, tap-to-call holders, search by slip number.
- **Linda (Treasurer, CPA)** — quarterly engagement for scenario modeling; precise about numbers; wants exportable PDFs to share with board.
- **Resident slip-owner** — 50s–80s, low digital literacy. Wants magic-link login, big buttons, "upload my insurance" as obvious flow.
- **Non-resident slip-owner** — typically more digitally fluent (younger boater profile); same UX works.
- **Transient** — submits one form, never logs in. Wants confirmation that the request was received.
- **Public visitor** — looking for rules or contact phone. Wants answer in three taps.

### 6.2 Information Architecture

```
Patron site (public)
├── Home
├── Rules & Regulations
├── Contact (ECI office, after-hours, dockmaster)
├── Emergency Procedures
├── Marina Map (read-only view of 3.1 map)
├── Local Services Directory
├── VHF + Approach Instructions
├── Tide / Weather / Wind (NOAA embed)
├── Forms Library
├── FAQ
├── Photo Gallery (Phase 1.5)
├── Transient Slip Request → form
└── Login → Holder Dashboard

Holder Dashboard (logged in)
├── My Slip (current assignment)
├── My Vessel(s)
├── My Documents (upload + status)
├── My Contact Info
├── My Fees (read-only line items from Active Fee Schedule)
└── Help

Admin (ECI, dockmaster, board)
├── Marina Configuration (versions, slips, visual map editor)
├── Holders Directory
├── Slip Assignments (grid + map view)
├── Transient Request Queue
├── Document Review Queue
├── Compliance Dashboard
├── Pricing
│   ├── Active Fee Schedule
│   ├── Scenario Modeler
│   ├── Scenario Library
│   └── State Machine + Audit
├── Reports
│   ├── Occupancy / Year-over-Year
│   ├── Compliance Summary
│   ├── Revenue Projection
│   └── Slip-fit Override Log
├── Audit Log
├── Patron Site Content Editor (Phase 1.5)
└── Users & Roles
```

### 6.3 UX Principles

- Magic-link login for holders; no passwords.
- Mobile-first for patron + holder + dockmaster; desktop-first for admin + Scenario Modeler.
- Always export. Every data view has a CSV button. PDF on reports.
- Confirmations on destructive actions (delete assignment, reject doc, archive scenario).
- State-machine transitions surface the next-step action prominently (don't make Linda hunt for "Submit").
- Slip-fit blocks are explanatory, not silent — name the failing dimension.

---

## 7. Build vs. Buy/Stitch Analysis — Refreshed for v0.2 `[HIGH]`

### 7.1 What changed since v0.1's stitched-is-fine verdict

v0.1 concluded that a stitched Airtable + Box + Squarespace solution covered ~80% of the (then 3-pillar) functionality at lower cost and zero maintenance. **The introduction of the Pricing Engine + Scenario Modeler (pillar 4) breaks that conclusion.**

### 7.2 Why off-the-shelf fails for the Scenario Modeler

| Stitched component | Pricing Engine fit | Verdict |
|---|---|---|
| Airtable | Can store the Active Fee Schedule and run simple formulas. **Cannot model what-if scenarios with side-by-side compare, state machines, or per-holder revenue deltas across a slip×holder cross-product.** Formulas are per-row; cross-row roll-ups + multi-scenario compare exceed Airtable's primitive. | Fails. |
| Google Sheets | Can run the math via array formulas. **Cannot enforce state machines, audit transitions, or wire CSV export to AppFolio's schema.** Brittle on multi-user concurrent edit. No proper role separation. | Fails. |
| Excel + macros | Same as Sheets + much worse for collaboration and audit. | Fails. |
| Dockwa / DockMaster / MARINAGO | Built around payments + reservations, neither of which are in scope. They don't expose a fee-modeling sandbox. | Fails. |
| Custom Airtable + Zapier glue | Possible to fake some of it; will be fragile, not auditable, and will collapse the moment the rate model becomes more complex than flat tiers. | Fails. |

### 7.3 Why custom build now wins

The Scenario Modeler is the differentiated capability — it's what Linda needs for board-level rate decisions, and it's what off-the-shelf can't deliver. The other three pillars piggyback on the same data model and the same auth and the same hosting, so the marginal cost of doing them custom (rather than stitched) is small once the Scenario Modeler is in scope.

Additional pillars also pull the build into custom territory:
- **Versioned marina configuration** with visual map — beyond Airtable's UI.
- **Slip-fit enforcement with admin override + audit** — possible in Airtable but ugly; clean in code.
- **Transient request workflow** with calendar view + 48h-expiring upload links — Airtable cannot do the time-windowed links.
- **State machine on fee schedules** — Airtable lacks first-class state machines.

### 7.4 Verdict `[HIGH]`

**Build custom.** Estimated effort:
- **MVP scope: 150–250 hours of solo work** (5–8 months at 8–12 hrs/week)
- **Cost: ~$30–50/mo hosting**
- **Risk: maintenance burden + bus factor**

This flips the v0.1 recommendation. The build is now justified by capability gap (Scenario Modeler), not just by sponsor preference.

~~**Still requires ECI buy-in (Risk #1).** Without Kathy's commitment to use this tool as her admin interface, the build is wasted regardless of capability fit.~~

**UPDATE 2026-05-19: ECI buy-in confirmed.** Kathy has explicitly requested Nick build this. Risk #1 retired. Build is unblocked.

---

## 8. Dependencies, Assumptions & Open Questions

### 8.1 Dependencies

- **ECI buy-in.** Kathy must agree to be the admin user. Confirm before any build.
- **Board approval.** Hosting budget, domain, branding, retention policy, fee-schedule workflow.
- **Marina restoration completion.** Final slip layout for the post-restoration config version.
- **Initial holder + slip data.** One-time import from AppFolio (CSV) or manual entry.
- **NOAA station ID** for the tide/weather embed nearest Wharfside.
- **AppFolio CSV import schema.** Need a sample for the export format (3.8).
- **Attorney review (Hubert Cutolo)** for any fee-schedule change touching Sec 24(B) loan structure.

### 8.2 Confirmed Assumptions (from session)

- Three pillars + Pricing Engine = total scope.
- AppFolio owns billing; MVP exports CSV, no live integration.
- Resident slip rate is discounted; non-resident is full; transient is per-foot per-night.
- Amenity fee waived for residents (included in HOA dues if introduced).
- No buy-in at Wharfside today; data model supports it for future.
- Slip-fit constraints enforced with admin override + justification.
- Transients are not self-service; ECI approves all requests.
- Marina map is medium-fidelity (PNG/SVG + clickable polygons).
- Marina configuration is versioned (pre-/post-restoration coexist).

### 8.3 Open Questions

Numbered with prior `Q-` IDs preserved where applicable.

**Critical path (block architecture decisions):**

1. ~~**Q-G4 — ECI adoption.**~~ ✅ **RESOLVED 2026-05-19** — Kathy confirmed she wants Nick to build this.
2. **Q-OWN1 — Resident definition.** Resident slip rate: does this include Wharfside unit *renters*, or only owners? (Affects holder-type assignment logic.)
3. **Q-TR1 — Transient capacity.** How many transient slips exist post-restoration? Typical stay length? Pricing per-foot per-night?
4. **Q-PRICE1 — Resident multiplier.** What is the current resident discount? (Assumed 0.75× — verify before MVP.)
5. **Q-AF1 — AppFolio CSV schema.** Need a sample of AppFolio's charge-import CSV columns. Without this, FR-3.8.1 can't be finalized.

**High-priority (affects MVP UX/scope):**

6. **Q-MAP1 — Existing marina diagram.** Does ECI or the restoration team have a current PNG/SVG/CAD diagram of the marina that can be used as the map background? Or do we render synthetically?
7. **Q-DOC1 — Indemnification cadence.** Annual re-sign, or one-time at slip onboarding? Drives reminder logic.
8. **Q-DOC2 — COI minimums.** Liability limit ($500K? $1M?), pollution coverage, additional-insured language (Wharfside Manor Condo Assoc + ECI both? Just the Association?).
9. **Q-DOC3 — Captain credential.** When is this required? (USCG-documented vessels above a certain size? Charter use? Never required for purely-recreational?)
10. **Q-OVERRIDE1 — Override audit visibility.** Should slip-fit overrides be visible to the board on a standing report, or only on request? (Default: standing report — FR-3.7.4.)

**Medium-priority (affects v2 / scope edges):**

11. **Q-DM1 — Dockmaster identity.** Is the dockmaster Kathy herself, an ECI staffer, a contractor, or a volunteer board member? Drives role design.
12. **Q-BRAND1 — Branding.** Wharfside navy/gold only? Or ECI co-brand? Or marina sub-brand?
13. **Q-DOMAIN1 — Domain.** Subdomain of wharfsidemb.com, or new (wharfsidemarina.com)?
14. **Q-WAIT1 — Waitlist policy.** Does the waitlist exist? Who maintains? How is it communicated? (Phase 1.5 module.)
15. **Q-COMP1 — Compliance enforcement.** What happens if a holder's COI expires? Boat removed? Slip suspended? Warning only? Drives whether the system enforces or only notifies.
16. **Q-G1 — Anchor launch.** Spring 2027 confirmed? Or earlier soft-launch (e.g., dockmaster-only pilot during 2026 season)?
17. **Q-FEE1 — Fee schedule export PDF format.** Branded PDF template — Wharfside header / logo / footer / signature block?

---

## 9. Risks `[HIGH]`

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **ECI doesn't adopt** | Medium-High | Critical (kills project — DOA without Kathy) | Get explicit ECI commitment before building. Q-G4 is the make-or-break. Pilot Scenario Modeler with Linda first if ECI is lukewarm — Linda is the secondary value path. |
| **Bus factor — Nick rolls off the board** | Medium | High (maintenance orphan) | Keep MVP small. Document everything. Prefer hosted services over self-hosted. Plan for handoff to ECI or successor by end of 2027. |
| **Marina restoration timing** changes slip count + layout | Medium | Medium | Build slip inventory as configurable + versioned data, not hardcoded. New config version after restoration finalizes. |
| **Scope creep** (back into billing, payments, reservations) | Medium-High | High | Section 1 "What this is NOT" is explicit. Refer feature requests back. AppFolio is the answer for billing. |
| **Maintenance burden** post-launch on a solo dev | Medium-High | Medium | Phase 1.5 + Phase 2 must be opt-in, not commitments. Build kill criteria into MVP (Q-G3). |
| **Board governance friction** on Sec 24(B) / fee-schedule changes | Medium | Medium | Hubert Cutolo review gate before any approved fee schedule materially changes the loan-cost-allocation model. State machine forces explicit approval steps. |
| **AppFolio integration complexity** if pursued | High (if pursued) | Medium | Defer to Phase 2. CSV export is sufficient for MVP. |
| **Slip-owner adoption** (low digital literacy among retirement-age residents) | Medium | Medium | Magic-link auth. Large buttons. Email-fallback workflow. Phone support during launch. |
| **Privacy/legal exposure** on stored insurance + indemnification docs | Low-Medium | Medium | Signed-URL private object storage. Retention policy board-approved. Hubert review on indemnification language. |
| **Scenario Modeler complexity** outgrows the data model | Low | Medium | Pure-function resolver design. Model variants (per-slip-tier vs. per-foot) flagged up front in Section 3.6.1. |

---

## 10. Success Criteria `[MEDIUM — VERIFY Q-G2]`

Six months post-launch, "this worked" =

1. ≥80% of slip-holders have a current (non-expired) COI + registration approved in the system.
2. ECI logs in at least weekly; reports this is the primary place they go for slip info.
3. Patron website is the first Google result for "Wharfside Marina rules" / "Wharfside Manor marina."
4. Linda has run at least one scenario through the state machine end-to-end, exported the board PDF, and Active'd the result.
5. CSV export to AppFolio has been used to drive at least one billing cycle without manual reconciliation errors.

"This failed" =

1. ECI continues to use email/spreadsheets instead of the system, OR
2. <30% of slip-holders ever log in to the portal, OR
3. The Scenario Modeler is used zero times by Linda or the board in the first season, OR
4. Nick spends >4 hours/month on maintenance after the first 90 days.

---

## 11. Appendix — Key Wharfside Facts (preserved from v0.1)

- **Slip count:** ~86 boat slips along the Shrewsbury River (Master Deed). Verify post-restoration.
- **Property:** ~150-unit condominium in Monmouth Beach, NJ; marina adjacent via perpetual easement.
- **Property mgmt:** East Coast – Ideal Management (ECI), Kathy Vanecek, 732-751-1991, kathy.vanecek@idealmgt.com. After-hours: 732-970-6886.
- **Platform:** AppFolio Property Manager.
- **Restoration:** DEP-approved. Meeco Sullivan + Falcon Engineering. Active April 2026.
- **Insurance broker:** Baldwin Insurance, (732) 837-1029.
- **Board (2026):** Giuseppe Gencarelli (Pres), Mike Serhat (VP), Nick DeMarco (Sec), Linda Masessa (Treas, CPA/CAMS), Thomas Bopp, Roberta Attanasi, Anthony D'Anna, Timmy Mucaj, Gary Passenti.
- **Attorney:** Hubert Cutolo (Cutolo Barros).
- **Brand:** navy `#1a3a5c`, gold `#c9a227`. Logo at github.com/nickdnj/wharfside-assets.
- **Master Deed Sec 24(B), 1995:** marina loan structure. Load-bearing for any pricing change touching cost allocation.

---

*End of draft v0.2. Next step: Nick reviews; PRD updates to v0.3 after answers to top-5 critical-path open questions.*
