# Wharfside Marina — Product Requirements Document (v0.3)

**Project:** `wharfside-marina`
**Status:** Draft v0.3 — folds in 2026-05-19 session decisions. **Q-G4 RESOLVED**: Kathy Vanecek (ECI / Ideal Management) has explicitly told Nick she wants him to build this — critical adoption gate cleared and retired from risk register. **Major scope reframing:** transient is no longer a separate pillar — it is one of three lease types (full-season / half-season / transient) sharing a single slip inventory on a booking calendar. Holder model expanded to four states (resident-owner, resident-renter, non-resident owner, non-resident). Season dates + half-season split + resident discount are now configurable Marina Configuration entities (modelable in the Scenario Modeler). AppFolio CSV strawman schema locked.
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
| 0.2 (consolidated) | 2026-05-19 | Product Requirements | Consolidated all session decisions. Added 4th pillar: Pricing Engine + Scenario Modeler. Three holder types defined. Versioned marina configuration. Slip-fit constraints with admin override. Transient request workflow. Fee schedule state machine. Build-vs-stitch verdict re-flipped: custom build is now justified. |
| **0.3 (this doc)** | **2026-05-19** | **Product Requirements (this pass)** | **Q-G4 retired: Kathy/ECI committed. Reframed transient as a lease type (not a pillar) — three lease types (full / half / transient) share one slip inventory + booking calendar. Holder model expanded to 4 states (resident-owner, resident-renter, non-resident owner, non-resident) with season-start residency lock. Marina Configuration extended: season_start_date, season_end_date, half_season_split_date (modelable). Half-season pricing rules defined (default 0.60× full each, hard split, resident discount applies). Resident discount: flexible (multiplier / flat / independent), seed default 0.75×. AppFolio strawman CSV schema locked (Section 3.8). Open Questions revised (Q-G4, Q-OWN1, Q-PRICE1, Q-AF1 struck; new questions added around booking priority, slot locking, transient activation). Risk register: ECI-adoption risk retired; remaining risks renumbered. Build vs. Buy: capability gap + Kathy commitment now jointly justify custom build.** |

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

1. **Slip Assignment + Marina Operations** — internal ops tool for ECI and the dockmaster: who is in which slip, with vessel and owner details, with season-over-season history. **Three lease types — full-season, half-season, transient — share the same slip inventory on a booking calendar.**
2. **Document Collection** — owner and vessel portal with expiration tracking and automated reminders.
3. **Patron-facing Website** — public + gated pages with rules, contact, map, emergency procedures, FAQ, and forms.
4. **Pricing Engine + Scenario Modeler** — active fee schedule (resolves what each slip-holder owes per season), what-if scenario modeling (project revenue under hypothetical rate cards including season-date variations), and an audit-tracked approval workflow with CSV export to AppFolio.

### What this is NOT `[HIGH]`

| Out of Scope | Why |
|---|---|
| Billing / invoicing / payments | AppFolio owns this. The pricing engine exports line items; it does not collect money. |
| Financial accounting / GL | AppFolio + ECI accounting workflow. ECI maps charge_type codes to their GL accounts on their side. |
| Reservation marketplace (Dockwa-style) | Slips are owned/leased annually (full or half-season) with transient gap-fill managed by ECI. No public discovery / marketplace. |
| Boater app / public booking | Not a marketplace. Transient requests go through ECI approval queue. |
| POS, ship store, fuel, charter | None of these exist at Wharfside. |
| Dry stack or launch scheduling | Wet slips only; fixed/seasonal. |
| Wharfside HOA-wide functions (work orders, owner ledgers, vendor mgmt) | AppFolio. |

---

## 2. Scope

### 2.1 Stakeholders `[HIGH]`

| Stakeholder | Role | Engagement |
|---|---|---|
| **ECI (Kathy Vanecek + team)** | Operator. Day-to-day marina admin. | **Primary admin user. Adoption confirmed 2026-05-19 — Kathy explicitly wants Nick to build this.** |
| **Dockmaster** | Day-to-day boots on the ground; may be Kathy/ECI staff, a paid contractor, or volunteer. `[LOW — VERIFY]` | Mobile read/write on assignments, transient queue, doc review. |
| **Wharfside Board** | Oversight + approval. Pres Giuseppe, VP Mike Serhat, Sec Nick, Treas Linda (CPA/CAMS) + 5 trustees. | Read-only on most; **Treasurer Linda is primary user of Scenario Modeler**. |
| **Slip-holder — Resident-owner** | Wharfside condo unit owner who lives in the unit and holds a slip. Resident pricing; verified via AppFolio ownership data. Amenity fee waived if introduced. | Boater portal: own lease(s), vessel, documents, contact info. |
| **Slip-holder — Resident-renter** | Renter currently residing in a Wharfside unit, with a lease document on file, holding a slip. Resident pricing; verified via current lease doc. | Boater portal: same as resident-owner. |
| **Slip-holder — Non-resident owner** | Owns a Wharfside unit but does not reside there (e.g., investor / second home). Full slip rate. Pays amenity fee if introduced. No buy-in. No secondary market. | Boater portal: same. |
| **Slip-holder — Non-resident** | Slip lessee with no Wharfside unit relationship. Full slip rate. Pays amenity fee if introduced. | Boater portal: same. |
| **Transient guest** | Short-stay visitor (nights to weeks). Not self-service. Submits public request form; ECI/dockmaster approves into a calendar gap on an available slip. | Public form only; no ongoing account. |
| **Public visitor** | Anyone reading rules, contact, emergency, map. | Read-only public pages. |
| **Wharfside attorney (Hubert Cutolo, Cutolo Barros)** | Reviews indemnification, fee schedule changes touching Sec 24(B). | Policy gates. |
| **Insurance broker (Baldwin Insurance)** | COI minimums + additional-insured language. | Consulted for COI policy. |

### 2.2 The Three Lease Types — One Slip Inventory `[HIGH]`

A key v0.3 scope reframing: **transient is NOT a dedicated slip inventory. The slip is the asset; occupancy is a calendar.** Three lease types share the same slip inventory and are offered in priority order:

| Lease Type | Duration | Priority | Goal | Notes |
|---|---|---|---|---|
| **Full season** | season_start → season_end (default Apr 1 → Nov 30, ~8 months) | 1st — offered first to existing holders | 100% occupancy at full-season rate | Standard annual lease; renews season over season. |
| **Half season** | Half-1: season_start → half_season_split_date. Half-2: split_date → season_end. (3–4 months each) | 2nd — offered on slips not taken full-season | Recover revenue on otherwise-empty slips | **Hard split** (date-based, not flexible windows). Default split = season midpoint, manual override allowed. |
| **Transient** | Nights to weeks | 3rd — fills calendar gaps on slips not taken full OR half | Opportunistic gap revenue | ECI-approved per request. Per-foot per-night rate. |

This collapses the former v0.2 "Transient Request Workflow" pillar into a booking type inside the Slip Assignment module. See Section 3.3 (assignment) and Section 3.4 (booking calendar + transient activation).

### 2.3 MVP vs. Phase 2+ `[HIGH]`

**MVP (target Spring 2027 launch — April 2027 go-live):**

- 3.1 Marina Configuration (versioned; visual map; slip metadata incl. tier + fee_modifier; **configurable season_start_date, season_end_date, half_season_split_date**)
- 3.2 Holder Management (**4 holder states**; identity + contact + role; **season-start residency lock**)
- 3.3 Slip Assignment (**3 lease types — full / half / transient — on shared inventory**; slip-fit enforcement with admin override; history)
- 3.4 Booking Calendar & Transient Activation (replaces former Transient Request Workflow — calendar-driven availability; public transient request form → ECI queue → approve/deny/hold)
- 3.5 Document Collection (COI + registration + indemnification + **renter lease doc** + others; expiration tracking; reminders at 60/30/7/0; approval workflow)
- 3.6 Pricing Engine + Scenario Modeler (Active Fee Schedule + Modeler + Library; state machine; CSV export to AppFolio; **half-season rates + season-date modeling**)
- 3.7 Board Reporting (compliance dashboard; assignment + occupancy reports; revenue projection by lease type)
- 3.9 Patron Website (rules, contact, emergency, map, forms, FAQ, services directory, NOAA embed, transient request form, slip-holder login)

**Phase 1.5 enhancements (post-launch hardening, late 2027):**

- COI parsing (OCR/LLM extract of carrier, policy #, limits, expiration)
- Lease-doc parsing for resident-renters (auto-extract term + parties)
- Waitlist management (per lease type)
- Multi-stage doc approval workflow
- Bulk season-end export ZIP for ECI
- Photo gallery + news/notices content editor for non-developer
- Auto-trigger rules for transient activation (e.g., "open Slip X to transient if no half-season taker by April 15")

**Phase 2+ (2028+):**

- 3.8 AppFolio Stack API integration (live push of approved fee schedule)
- Mobile native app (web-responsive sufficient for MVP)
- Public-facing slip availability widget (only after restoration layout final)
- Per-foot pricing engine variant (if rate model evolves)

---

## 3. Functional Requirements

### 3.1 Marina Configuration `[HIGH]`

**Concept:** the marina layout itself is a first-class versioned entity. Pre- and post-restoration layouts must coexist; a season's assignment ties to the layout version active on that season's effective_date. **v0.3 extends Marina Configuration to include season-level parameters (start, end, half-season split) which are modelable in the Scenario Modeler.**

#### 3.1.A Marina-level Configuration Parameters (v0.3 — NEW)

A single Marina Configuration record per season exists, capturing:

- `season_year` (e.g., 2027)
- `season_start_date` (default **April 1**) `[ASSUMPTION — VERIFY]`
- `season_end_date` (default **November 30**) `[ASSUMPTION — VERIFY]`
- `half_season_split_date` (default = midpoint of [season_start_date, season_end_date]; **manual override allowed**)
- `residency_lock_date` (default = season_start_date; date on which holder residency states are frozen for the season — see Section 3.2)
- `default_resident_discount_mode` (multiplier / flat / independent_rate)
- `default_resident_discount_value` (seed default: **0.75×**)
- `default_half_season_pricing_mode` (multiplier / flat / independent_rate)
- `default_half_season_pricing_value` (seed default: **0.60×** of full-season per half — so two half-season holders together pay 1.2× full-season, intentional premium for partial commitment)
- `notes` (free text)

**Modelability:** The Scenario Modeler can override any of these parameters per scenario (e.g., "What if we open two weeks earlier?" — set scenario.season_start_date = March 18 and recompute revenue across all assignments). See Section 3.6.

#### 3.1.B Slip entity attributes (unchanged from v0.2)

- `slip_number` (e.g., "47", "A-12")
- `position` (map coordinates / polygon coords for visual map)
- `loa_limit_ft` (max vessel length-overall)
- `beam_limit_ft` (max vessel beam)
- `min_depth_at_mlw_ft` (minimum water depth at mean low water — drives draft constraint)
- `type` (covered / open / end-tie / side-tie)
- `amenities` (30A power, 50A power, water, pump-out adjacency)
- `status` (active / out-of-service / restoration-pending)
- `tier` (Premium / Standard / Restricted) — feeds pricing
- `fee_modifier` (multiplier on base rate for premium surcharge; seed default for Premium: **+10%**)
- `tide_exposure_notes` (free text — wind exposure, current notes)
- `slip_config_version_id` (FK to config version)

#### 3.1.C Config version entity (unchanged from v0.2)

- `version_id`, `effective_date`, `name` (e.g., "Pre-Restoration 2026", "Post-Restoration 2027"), `notes`, `is_active` (only one active)

**FR-3.1.1 (admin):** As ECI staff, I can create a new marina configuration version with a name, effective date, and notes; clone slips from the prior version as a starting point.
- *Acceptance:* New version created with cloned slips in <5s. Editable independently of prior versions. Cannot delete a version that has assignments.

**FR-3.1.2 (admin):** As ECI staff, I can edit any slip's attributes on the active or future config version.
- *Acceptance:* Edits saved with audit (who, when, before/after). Cannot edit a version locked by historical assignments unless an admin-with-override role confirms.

**FR-3.1.3 (admin):** As ECI staff, I can view a visual marina map with all slips rendered as clickable polygons over a background diagram, color-coded by status/tier.
- *Acceptance:* Medium-fidelity. Background is a PNG/SVG marina diagram; slip polygons defined in JSON. Click a slip → side panel with full attributes, current assignment, fit history, **booking calendar (3-row strip: Full / Half-1 / Half-2 / Transient)**. Mobile-responsive (pinch-zoom).
- *Out of scope:* Photo-realistic CAD rendering. Live drone overlay.

**FR-3.1.4 (admin):** As ECI staff, I can mark a config version as Active. Only one version is Active at a time.
- *Acceptance:* Activating a version sets prior Active to Archived. Assignment workflows use the Active version's slip set. Audit logged.

**FR-3.1.5 (admin) — v0.3 NEW:** As ECI staff or Treasurer, I can edit the Marina Configuration parameters (season dates, half-split, resident discount defaults, half-season pricing defaults) for a given season_year.
- *Acceptance:* Edits before `residency_lock_date` are free; edits after that date require admin justification ≥20 chars and are audit-logged. Half-season split date defaults to midpoint but is editable. All values flow through to FR-3.6.1.2 pricing resolver.

### 3.2 Holder Management `[HIGH]`

**v0.3 — Holder model expanded to 4 states (replaces v0.2's 3-type model):**

| Holder State | Definition | Pricing | Verification Source |
|---|---|---|---|
| `resident_owner` | Owns AND currently resides in a Wharfside unit | Resident (discounted) | AppFolio ownership data |
| `resident_renter` | Currently resides in a Wharfside unit as a renter, with lease doc on file | Resident (discounted) | Current lease doc (uploaded to system) |
| `non_resident_owner` | Owns a Wharfside unit but does not live in it (investor / second home) | Full rate | AppFolio ownership data |
| `non_resident` | No Wharfside unit relationship | Full rate | None (standard holder record) |

(Note: `transient` is no longer a holder type. Transient guests are tracked as one-off bookings without holder records — see Section 3.4.)

#### 3.2.A Residency Lock Rule (v0.3 NEW) `[HIGH]`

**Residency state is locked at season start (or at new-holder onboarding mid-season).** Mid-season changes — lease expires, unit sold, holder moves out — are **IGNORED for that season**. Re-verification occurs at the next season's renewal.

- The `holder.residency_state_locked_at` timestamp captures when the state was frozen.
- The `holder.residency_state_for_season_year` field captures which season's pricing the state applies to.
- ECI can override mid-season ONLY with admin justification ≥20 chars (e.g., obvious data entry error). Audit-logged.

**Rationale:** Predictability of revenue for the board; avoids mid-season repricing disputes; aligns with annual-lease norm.

#### 3.2.B Holder entity attributes (extended from v0.2)

- `holder_id`, `state` (one of the 4 above), `legal_name`, `phone`, `email`, `mailing_address`, `emergency_contact_name`, `emergency_contact_phone`
- `wharfside_unit_number` (FK to condo unit; required for resident_owner, resident_renter, non_resident_owner; null for non_resident)
- `residency_state_locked_at` (timestamp)
- `residency_state_for_season_year` (int)
- `lease_doc_id` (FK to docs; required for resident_renter; expiration tracked for renewal)
- `status` (active / inactive / suspended)
- `created_at`, `created_by`
- `notes` (free text, ECI use)

**FR-3.2.1 (admin):** As ECI staff, I can create, edit, and deactivate a holder record across all 4 states.
- *Acceptance:* Form validates required fields by state (e.g., resident_renter requires lease_doc upload). Audit on every change. Cannot delete a holder with historical assignments — only deactivate.

**FR-3.2.2 (holder):** As any holder, I can log in and edit my own contact info; vessel and assignment changes require ECI approval.
- *Acceptance:* Magic-link login. Edit button on contact; vessel/slip changes submit a request to ECI. Audit trail.

**FR-3.2.3 (admin):** As ECI staff, I can search holders by name, slip number, vessel name, or unit number, with filter by holder state.
- *Acceptance:* Instant search (<500ms). Filter by state and status.

**FR-3.2.4 (admin) — v0.3 NEW:** As ECI staff, on the configured `residency_lock_date` (or new-holder onboarding), the system snapshots every active holder's state into `residency_state_for_season_year` and stamps `residency_state_locked_at`.
- *Acceptance:* Batch job (or on-demand action) runs at lock date. After this, holder state is read-only for that season unless ECI admin overrides with ≥20-char justification. Audit log captures the snapshot event.

**FR-3.2.5 (admin) — v0.3 NEW:** As ECI staff, I can see a "Residency Watch" view listing resident_renter holders whose lease doc expires before season_end_date.
- *Acceptance:* Filterable list with lease expiration dates. Used at season renewal to verify continued residency. Mid-season expirations are flagged for next-season review only (not enforced this season — per lock rule).

### 3.3 Slip Assignment — Three Lease Types on Shared Inventory `[HIGH]`

**v0.3 — major reframing:** assignments are no longer "full-season per slip per season." A single slip in a single season can host up to two half-season assignments and any number of non-overlapping transient bookings, OR one full-season assignment (which preempts both halves and transient).

#### 3.3.A Vessel entity (1:N per holder; unchanged from v0.2)

- `vessel_id`, `holder_id`, `name`, `loa_ft`, `beam_ft`, `draft_ft`, `hull_color`, `propulsion_type`, `uscg_doc_or_state_reg`

#### 3.3.B Assignment entity (extended in v0.3)

- `assignment_id`
- `slip_id` (FK to specific config_version)
- `holder_id` (nullable for transient bookings without a holder record — see 3.3.E)
- `vessel_id` (nullable for transient until COI received)
- `season_year`
- **`lease_type`** — one of: `full_season`, `half_season_1`, `half_season_2`, `transient` **(v0.3 NEW)**
- `start_date`, `end_date` (computed from lease_type + Marina Configuration for full/half; explicit for transient)
- `status` (proposed / confirmed / closed / canceled)
- `created_by`, `created_at`
- `override_reason` (nullable; populated only when fit constraints were overridden)
- `transient_request_id` (FK to transient request, nullable; populated only when lease_type=transient)

#### 3.3.C Booking conflict rules (v0.3 NEW) `[HIGH]`

For any single (slip_id, season_year), the following exclusivity rules apply:

1. A `full_season` assignment **preempts** `half_season_1`, `half_season_2`, and all `transient` bookings on that slip for that season. Cannot create a full-season assignment if any other lease type is already booked on that slip-season.
2. `half_season_1` and `half_season_2` may **coexist** on a slip (one per half), but each half-slot is unique per slip-season.
3. `transient` bookings may exist on a slip-season **only if** the slip-season has no `full_season` assignment AND only in calendar windows not covered by an active `half_season_X` assignment. Multiple non-overlapping transients are allowed.
4. **Booking priority order** (default): full-season offers go to existing holders first; half-season is offered second; transient activation is third. See Section 3.4 for the activation workflow. **Q-PRIORITY1 (new):** the exact offer-deadline cadence (e.g., "full-season renewals must be confirmed by Feb 15, then half-season opens Feb 16") needs board confirmation.

#### 3.3.D Functional requirements

**FR-3.3.1 (admin):** As ECI staff, I can create a slip assignment by selecting slip + holder + vessel + lease type for a season.
- *Acceptance:* Form blocks duplicate lease-type slots per slip-season per rule 3.3.C. Auto-fills holder if previously on record. Audit trail on save. For half-season, start/end auto-fill from Marina Configuration.

**FR-3.3.2 (admin) — SLIP-FIT ENFORCEMENT (CONFIRMED v0.3):** As ECI staff, the system blocks any assignment (full / half / transient) if `vessel.loa_ft > slip.loa_limit_ft` OR `vessel.beam_ft > slip.beam_limit_ft` OR `vessel.draft_ft + safety_margin > slip.min_depth_at_mlw_ft` (default safety margin: 0.5 ft `[ASSUMPTION — VERIFY]`).
- *Acceptance:* Blocking message names the failing dimension with the specific values. No silent block.

**FR-3.3.3 (admin) — ADMIN OVERRIDE:** As ECI staff with admin role (Kathy/dockmaster), I can override a slip-fit block by entering a required justification text.
- *Acceptance:* Override button surfaces only after a block. Justification ≥20 characters required. Override saved on the assignment record (`override_reason`), exposed in audit log and in a "Slip-fit overrides" report.

**FR-3.3.4 (admin):** As ECI staff, I can view the full history of any slip — every assignment back to inception, by lease type, vessel and holder details, exportable to CSV.
- *Acceptance:* History timeline renders in <2s. Filter by season range AND lease type. CSV export with one click.

**FR-3.3.5 (dockmaster, mobile):** As the dockmaster, I can look up who is in slip 47 right now on my phone, with vessel name, holder name, holder phone (tap-to-call), and lease type (full / half-N / transient).
- *Acceptance:* Mobile-responsive. Search "47" → result in <1s. Tap-to-call works on iPhone Safari + Android Chrome. Today's assignment is computed by matching today's date against the slip's booking calendar.

**FR-3.3.6 (admin) — v0.3 NEW:** As ECI staff, I can view a per-slip seasonal occupancy ribbon showing which lease type holds the slip in which window (Full / H1 / H2 / Transient with date ranges).
- *Acceptance:* Visual strip; click into any segment to see assignment detail. Empty segments are clearly marked "Available" with a one-click "Open to transient" action.

#### 3.3.E Transient assignment specifics

Transient bookings differ from full/half because the guest typically has no prior holder record. The Assignment record links to a `transient_request_id` (the public-form submission); the guest's contact info lives on the request, not on a Holder. A lightweight "guest holder" record may be created if ECI elects to retain the guest for future visits, but this is optional.

### 3.4 Booking Calendar & Transient Activation `[HIGH]`

**v0.3 — replaces v0.2 Section 3.4 "Transient Request Workflow."** The transient workflow still exists but is now embedded in a broader booking calendar / availability model.

#### 3.4.A Booking Calendar

Per slip, per season, the system maintains a **booking calendar**: a timeline showing which windows are taken by which lease type and which are available. This view is the primary source of truth for availability and drives transient activation.

- Calendar dimensions: per slip, year-bounded by Marina Configuration season dates.
- Cells: each day is colored by the active lease type for that slip (Full / H1 / H2 / Transient) or "Available."
- Cross-slip view: ECI can pivot to a marina-wide grid (rows = slips, columns = days) for capacity planning.

#### 3.4.B Transient Activation Trigger `[NEW — Q-TRANSIENT1]`

A slip-season window becomes **eligible for transient booking** when:

- No `full_season` assignment exists for the slip-season, AND
- The window is not covered by an active `half_season_X` assignment, AND
- The slip's `status` is `active`.

**Question to resolve before MVP build (Q-TRANSIENT1):** what triggers a slip to *actually* be opened to public transient requests?

- **Option A — Manual flag:** ECI clicks "Open to transient" on each slip-season window. (Conservative; safe.)
- **Option B — Automatic:** the system opens any eligible slip-window to transient as of a configurable date (e.g., May 1) if no full or half-season taker. (Aggressive; revenue-maximizing.)
- **Option C — Hybrid:** automatic flagging with ECI review queue before public visibility. (Default proposal — best balance.)

**Default proposal (Option C — `[ASSUMPTION — VERIFY]`):** automatic eligibility computed nightly; ECI sees a "Transient candidates" list and confirms before public-facing transient form can request these slips.

#### 3.4.C Public Transient Request Form (preserved from v0.2)

Public request form (no login):
- Requester contact (name, phone, email)
- Vessel details (name, LOA, beam, draft)
- Requested arrival + departure dates
- Purpose / notes
- Acknowledgment of marina rules (checkbox)

#### 3.4.D ECI queue features (extended in v0.3)

- Calendar view of transient-eligible slips for the requested date window (auto-filtered by slip-fit against requested vessel)
- Each request: approve / deny / hold
- Approve: assign specific slip + dates; auto-send confirmation email with COI + registration upload link (deadline 48h post-approval)
- Deny: auto-send email with reason
- Hold: send "request more info" email; track as pending

**FR-3.4.1 (public):** As a boater, I can submit a transient slip request via a public form without an account.
- *Acceptance:* Form accessible from patron site `/transient`. Required fields validated. Confirmation page + email to requester ("we've received your request"). Submission written to queue.

**FR-3.4.2 (admin):** As ECI staff or dockmaster, I can view a transient request queue and a calendar of transient-eligible slips for the requested dates, filtered by slip-fit against the requester's vessel.
- *Acceptance:* Queue shows pending oldest-first. Calendar overlays requested dates on every slip eligible per 3.4.B with conflicts highlighted.

**FR-3.4.3 (admin):** As ECI, I can approve a transient request, assigning a specific slip and dates. The system creates a `lease_type=transient` Assignment and emails the requester with an upload link valid for 48 hours.
- *Acceptance:* Approval creates the Assignment with slip-fit checked (overridable). Confirmation email sent within 60s. Upload link expires 48h after approval; expired links return a friendly error.

**FR-3.4.4 (admin):** As ECI, I can deny a transient request with a reason; requester receives an email with that reason.
- *Acceptance:* Denial requires reason text ≥20 chars. Email sent within 60s.

**FR-3.4.5 (admin):** As ECI, I can put a request on Hold and send a request-for-more-info email.
- *Acceptance:* Hold state visible in queue; requester can resubmit info; admin can then approve or deny.

**FR-3.4.6 (admin) — v0.3 NEW:** As ECI staff, I can flip a slip-season window to "Open to transient" (manual flag), or accept the system's auto-eligibility candidate.
- *Acceptance:* Per-window toggle. Action audit-logged. Only "open" windows are matchable to public transient requests.

**Open booking-priority questions for this module:** see Section 8 (Q-PRIORITY1, Q-DEPOSIT1, Q-TRANSIENT1).

### 3.5 Document Collection `[HIGH]`

**Document types (per holder + per vessel):**
- COI (insurance) — annual
- Vessel registration (state or USCG documentation) — 1–3 yr depending on state
- Indemnification / hold-harmless waiver — annual or one-time `[VERIFY]`
- Captain credential — if applicable to the vessel
- Vessel survey — if required (typically for older vessels or higher-value insurance)
- **Resident lease doc** (v0.3 NEW) — required for resident_renter; tracked for season-renewal residency re-verification

**Doc entity:**
- `doc_id`, `holder_id` OR `vessel_id` (one of), `doc_type`, `file_url` (signed-URL object storage), `uploaded_at`, `uploaded_by`, `expiration_date`, `status` (current / expiring / expired / missing), `review_status` (pending / approved / rejected), `reviewer_id`, `review_notes`, `version` (revisions on the same doc type stack)

**Reminder cadence:** automated emails at **T-60, T-30, T-7, and T-0** days before expiration. Suppressed once a renewal upload is approved.

**Status badges** (computed):
- **Current** — approved, not expiring within 60 days
- **Expiring** — approved, within 60 days of expiration
- **Expired** — past expiration_date
- **Missing** — required for this holder/vessel and never uploaded

**FR-3.5.1 (holder):** As a slip-holder, I can upload my COI, registration, indemnification, captain credential, survey, and (if resident_renter) lease doc through the portal.
- *Acceptance:* Drag-and-drop on desktop; file picker on mobile. PDF/JPG/PNG up to 25MB. Upload tags doc type + expiration date (manual entry at MVP).

**FR-3.5.2 (holder):** As a slip-holder, I receive automated reminders at 60, 30, 7, and 0 days before any document expires.
- *Acceptance:* Email sent at the cadence above. One-click link back to portal. Suppressed if renewal already approved.

**FR-3.5.3 (admin):** As ECI staff, I can see a queue of uploads awaiting review, approve or reject with a comment.
- *Acceptance:* Queue oldest-first. PDF preview in-browser. Approve / reject buttons. Reject requires comment ≥20 chars; comment emailed to holder.

**FR-3.5.4 (admin):** As ECI staff, I can view a compliance dashboard showing % of holders current on all required docs, with drill-down to non-compliant holders.
- *Acceptance:* Total holders, % fully compliant, % with any expired/missing doc, drill-down list. Refresh on page load. **v0.3:** resident_renter holders with expiring lease doc surface in the dashboard as a residency-renewal flag (not blocking this season per lock rule).

**FR-3.5.5 (board):** As a board officer, I have a read-only view of the compliance dashboard.
- *Acceptance:* Same as 3.5.4 minus action buttons.

**FR-3.5.6 (audit):** As any admin, I can see the full audit log of who uploaded what, when, who approved/rejected.
- *Acceptance:* Filterable by holder, doc type, date range. CSV export.

**Phase 1.5:** COI parsing — OCR + LLM extract carrier, policy #, liability limits, expiration; auto-populate fields with human review. Also lease-doc parsing for resident-renter terms.

### 3.6 Pricing Engine + Scenario Modeler `[HIGH]`

This is the most differentiated capability and the reason custom build beats Airtable+stitched. Three logical layers, **substantially extended in v0.3 to handle half-season pricing and season-date modeling.**

#### 3.6.1 Active Fee Schedule

The currently-board-approved rate card. Resolves for any season + slip + holder + lease type what is owed.

**Charge components (stackable, modeled independently):**

| Component | Description | Seed Default (FY27) |
|---|---|---|
| `base_slip_rate` | Per slip tier × holder-state multiplier, OR per-foot × LOA (model variant configurable). Anchored to the **full-season** rate; half and transient derived from this. | TBD by board (per-slip-tier rate card) |
| `resident_discount` | Applied to base_slip_rate for resident_owner + resident_renter. **Flexible mode**: multiplier / flat $ off / independently-set rate. Applies to BOTH halves and to transient when applicable. | **0.75× multiplier** `[ASSUMPTION — STARTER DEFAULT — VERIFY]` |
| `half_season_pricing` | Applied per half-season assignment. **Flexible mode**: multiplier / flat $ / independent rate. | **0.60× full-season per half** (so 2 halves = 1.2× full, premium for partial commitment) |
| `premium_surcharge` | Tied to `slip.tier` / `slip.fee_modifier`. | **+10% flat** (placeholder for Premium tier) |
| `amenity_fee` | Flat $/year; waived for residents (always included in HOA dues if introduced). | **$0** (none today; modeler supports adding) |
| `buy_in` | One-time onboarding fee. | **$0** (none today; data model supports for future / benchmarking) |
| `transient_nightly_rate` | Per-foot per-night. | TBD `[VERIFY]` |

**Holder-state multipliers (v0.3 — 4 states):**

| Holder State | Multiplier on base_slip_rate |
|---|---|
| `resident_owner` | resident_discount (default 0.75×) |
| `resident_renter` | resident_discount (default 0.75×) |
| `non_resident_owner` | 1.0× (full) |
| `non_resident` | 1.0× (full) |
| (transient guest, no holder) | per-foot per-night rate (separate row, not a multiplier) |

**Charge-component matrix (v0.3 — what stacks for which lease type):**

| Lease Type | Components Applied |
|---|---|
| `full_season` | base_slip_rate × holder-state-multiplier + premium_surcharge (if slip Premium) + amenity_fee (if non-resident) |
| `half_season_1` / `half_season_2` | base_slip_rate × holder-state-multiplier × half_season_pricing + premium_surcharge (if Premium, prorated to half) + amenity_fee (if non-resident, prorated to half) `[VERIFY: amenity proration logic with board]` |
| `transient` | transient_nightly_rate × vessel.loa_ft × nights (resident discount applies if applicable per Q-RESDISCT1 below) |

**FR-3.6.1.1 (admin):** As ECI or Linda, I can view the Active Fee Schedule with all components, multipliers, mode (multiplier/flat/independent), and effective dates.
- *Acceptance:* Single page summarizing every component + multiplier. Linked to the source approval record (audit reference to email/minutes).

**FR-3.6.1.2 (admin):** Given an Active Fee Schedule + Marina Configuration, the system resolves "Holder X on Slip Y for Season Z (Lease Type L)" with a line-item breakdown.
- *Acceptance:* Resolver function is deterministic; same inputs → same total. Breakdown shows each component and its contribution. Unit-tested. Handles all 4 holder states × all 4 lease types × premium/standard slip tier.

**FR-3.6.1.3 (admin):** As ECI, I can export the full season's billable line items as a CSV formatted for AppFolio import (see Section 3.8 for schema).
- *Acceptance:* CSV columns match the locked strawman schema. One row per charge (a holder with a full-season + an amenity fee yields 2 rows). Downloadable.

#### 3.6.2 Scenario Modeler (what-if)

A separate workspace where an admin edits a *hypothetical* fee schedule + Marina Configuration and the system recomputes projected revenue across all current assignments.

**v0.3 — Scenario Modeler now supports overriding Marina Configuration parameters per scenario:**
- `season_start_date` / `season_end_date` (model an earlier/later open)
- `half_season_split_date` (model a different split point)
- `resident_discount_mode` + `resident_discount_value`
- `half_season_pricing_mode` + `half_season_pricing_value`
- Any base_slip_rate / premium_surcharge / amenity_fee / transient_nightly_rate

**FR-3.6.2.1 (admin):** As Linda (Treasurer), I can create a new scenario from the Active Fee Schedule + active Marina Configuration, edit any component / multiplier / season-date, and see projected revenue update live.
- *Acceptance:* Side-by-side: Active vs. Scenario. Totals + per-slip-type + per-holder-state + **per-lease-type** splits. Per-holder delta visible on demand. Recomputation <1s for ~86 slips.

**FR-3.6.2.2 (admin):** As Linda, I can save the scenario with a name + notes for later comparison.
- *Acceptance:* Scenarios persist with state (draft / under-review / submitted / approved-superseded). Owner-locked: only the creator + ECI can edit; everyone with admin role can read.

**FR-3.6.2.3 (admin):** As Linda, I can compare two scenarios side-by-side with a third "Active" baseline column.
- *Acceptance:* 3-column compare view. Per-component delta. Per-holder delta export to CSV.

**FR-3.6.2.4 (admin) — v0.3 NEW:** As Linda, I can model a scenario that varies the season window ("What if we open 2 weeks earlier?") and see revenue impact across all lease types.
- *Acceptance:* Scenario.season_start_date / season_end_date override the Marina Configuration defaults; resolver recomputes full + half + transient assumptions accordingly. Per-day revenue derivable for transient modeling.

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

**FR-3.7.1:** Year-over-year occupancy and assignment-change report. Occupied/open by slip class **and lease type (full / half-1 / half-2 / transient)**, new assignments, vacated, waitlist length (Phase 1.5). Exportable to PDF + CSV.

**FR-3.7.2:** Compliance summary (per-doc-type % current, per-holder-state % current, drill-down to non-compliant). Refresh on page load.

**FR-3.7.3:** Active Fee Schedule revenue projection. Total marina revenue forecast for current and next season, broken down by lease type, with per-component contribution. Exportable.

**FR-3.7.4:** Slip-fit override report. Lists every assignment with `override_reason` populated, the dimension(s) that failed, who overrode, when, justification text. For board oversight.

**FR-3.7.5 — v0.3 NEW:** Transient activity report. Per-season transient bookings: count, total revenue, average stay length, per-slip utilization. Useful for evaluating transient-activation policy.

### 3.8 AppFolio Integration `[HIGH for MVP]`

**MVP:** **No live integration.** ECI exports the Active Fee Schedule's billable line items as a CSV from this system, then manually imports into AppFolio. **Nick will work out the actual import format with ECI separately. The system designs to a strawman schema (locked below).** ECI maps `charge_type` codes to their internal GL accounts on their side; this system does not concern itself with GL mapping.

#### 3.8.A Strawman CSV Schema (v0.3 LOCKED) `[HIGH]`

```
holder_id, unit_code, slip_number, season_year, charge_type, charge_date, amount, description
```

**Columns:**

| Column | Type | Notes |
|---|---|---|
| `holder_id` | string | Wharfside holder ID (FK to Holder table) |
| `unit_code` | string | Wharfside unit number (nullable for non_resident holders) |
| `slip_number` | string | Slip identifier (e.g., "47", "A-12") |
| `season_year` | int | E.g., 2027 |
| `charge_type` | enum | See enum below |
| `charge_date` | date | Date the charge is dated for AppFolio's books (e.g., season start, or per-half start) |
| `amount` | decimal(10,2) | Dollar amount |
| `description` | string | Human-readable line description (e.g., "2027 Full-Season Slip Lease — Slip 47, Resident") |

**`charge_type` enum:**
- `SLIP_FULL_SEASON` — full-season slip lease line item
- `SLIP_HALF_SEASON_1` — first-half slip lease
- `SLIP_HALF_SEASON_2` — second-half slip lease
- `TRANSIENT_NIGHT` — transient per-night charge (one row per transient assignment, amount = per-foot × LOA × nights)
- `AMENITY_FEE` — amenity / resort fee (non-resident only, if applicable)
- `PREMIUM_SURCHARGE` — premium slip tier surcharge (broken out for transparency; may also be folded into base, board's call — see Q-PREMIUM1)

**FR-3.8.1 (MVP):** One-click CSV export of the Active Fee Schedule's billable line items in the strawman format above.
- *Acceptance:* CSV columns match the strawman schema. One row per `charge_type` per holder per slip per season. Includes a header row and a footer row with totals for reconciliation. Verified against an AppFolio import dry-run with ECI before launch — Nick to coordinate with Kathy.

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
- Slip-holder dashboard (own assignment(s), vessel, documents, contact info)
- Forms library (slip application, transient request form, indemnification, gate-key request, **renter lease doc upload** for resident_renter onboarding)
- Transient request form

**FR-3.9.1 (public):** As a member of the public, I can read marina rules, contact info, and emergency procedures without logging in.
- *Acceptance:* Public site renders <2s on 4G mobile. WCAG 2.1 AA. Mobile-responsive. NOAA embed loads asynchronously without blocking page render.

**FR-3.9.2 (public):** As a visiting boater, I can submit a transient slip request from the patron site.
- *Acceptance:* See FR-3.4.1.

**FR-3.9.3 (holder):** As a slip-holder, I can log in via magic-link and access my dashboard.
- *Acceptance:* Magic-link arrives in <60s. Session 30 days. No password.

**FR-3.9.4 (admin):** As ECI staff, I can edit news/notices and seasonal info via a simple content editor without writing code.
- *Acceptance:* Phase 1.5 for full CMS. MVP: markdown-by-commit acceptable if Nick is sole editor.

**Branding:** TBD — Wharfside navy `#1a3a5c` + gold `#c9a227` OR ECI co-brand. See Section 8.

---

## 4. Non-Functional Requirements `[MEDIUM]`

| Category | Requirement | Rationale |
|---|---|---|
| **Performance** | Public pages <2s on 4G mobile. Admin queries <1s for typical loads. Scenario recompute <1s for 86 slips × 4 lease types. | Low-traffic HOA scale; modeler needs to feel interactive. |
| **Availability** | 99% uptime. No 24/7 SLA. | HOA-scale, not boater-marketplace. |
| **Backup** | Daily automated; 30-day retention; RPO ≤24h, RTO ≤24h. | Low-criticality data. |
| **Security** | HTTPS everywhere. PII encrypted at rest. Documents (including resident_renter lease docs) in private object storage with signed-URL access. Magic-link auth for holders; password+optional 2FA for admins. | Owner PII + insurance docs + lease docs require care. |
| **Data export** | One-click CSV export of all structured data. One-click ZIP of all uploaded docs per holder (and bulk for ECI in Phase 1.5). | Anti-lock-in. |
| **Accessibility** | WCAG 2.1 AA on patron site. Admin can be looser. | Patron pages reach public. |
| **Mobile** | Patron site + holder dashboard + dockmaster slip-lookup fully mobile-responsive. Admin can be desktop-first. | Holders + dockmaster live on phones at the dock. |
| **Audit logging** | Every write logged with user, timestamp, before/after. State transitions on scenarios + assignments require explicit actor reference. Residency-lock snapshot is audit-logged. | Governance + disputes. |
| **Compliance** | No PCI (no payments). No HIPAA. Standard PII handling. | Payments explicitly out of scope. |

---

## 5. Technical Requirements `[RECOMMENDATION — VERIFY]`

### 5.1 Recommended Stack

| Layer | Recommendation | Rationale |
|---|---|---|
| **Frontend** | Next.js 14+ (React + TypeScript) | Nick has React experience (Batter Up, Cage Match). SSR for patron-site SEO. |
| **Backend** | Next.js API routes; optional FastAPI for heavy compute (Scenario Modeler) | Single deploy preferred; modeler may justify a separate service if Python is preferred for matrix math. |
| **Database** | PostgreSQL (Cloud SQL or Supabase) | Relational fit. Strong constraints for slip-fit + assignment uniqueness + lease-type exclusivity. |
| **Object storage** | Google Cloud Storage with signed URLs | ~$0.02/GB/mo. Standard. |
| **Auth** | Magic-link for holders (NextAuth, Clerk, or Supabase Auth); password+2FA for admins | Retirement-skewed users → reduce password burden. |
| **Email** | Postmark, SendGrid, or Resend | Low volume; transactional. |
| **Hosting** | GCP Cloud Run + Cloud SQL (consistent w/ Cage Match, Batter Up) OR Vercel + Supabase | Cloud Run scales to zero. |
| **CMS (Phase 1.5)** | Decap CMS, Sanity, or simple admin form | Lightest weight; non-tech ECI staff. |
| **OCR (Phase 1.5)** | Google Cloud Vision + Anthropic Claude for COI + lease-doc extraction | Optional; not MVP. |
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
- Marina Configuration is per-season, captures season dates + defaults; **modelable in scenarios.**
- Assignment is FK to slip + holder (nullable for transient) + vessel + season + **lease_type**; combined-uniqueness constraints enforce the 3.3.C booking rules.
- Holder has `state` (one of 4) + residency-lock fields.
- Doc is FK to holder OR vessel (XOR constraint), with version stacking on same type; new doc_type `RESIDENT_LEASE` for resident_renter.
- Scenario is FK to base config_version + Marina Configuration overrides + holder set; computation is pure-function over assignments × fee_schedule × marina_config.
- Audit log is append-only.

---

## 6. UX `[MEDIUM]`

### 6.1 Personas

- **Kathy at ECI** — busy, multi-property, lives in AppFolio. Wants minimum clicks, exportable everything, no surprises. **Confirmed primary admin user as of 2026-05-19.**
- **Dockmaster** — likely retiree or part-time. Wants mobile UI, tap-to-call holders, search by slip number.
- **Linda (Treasurer, CPA)** — quarterly engagement for scenario modeling; precise about numbers; wants exportable PDFs to share with board.
- **Resident-owner slip-holder** — 50s–80s, low digital literacy. Wants magic-link login, big buttons, "upload my insurance" as obvious flow.
- **Resident-renter slip-holder** — variable demographics; must also upload lease doc at onboarding + at lease renewal.
- **Non-resident slip-holder** — typically more digitally fluent (younger boater profile); same UX works.
- **Transient guest** — submits one form, never logs in. Wants confirmation that the request was received.
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
├── My Slip(s) (current assignment(s) by lease type)
├── My Vessel(s)
├── My Documents (upload + status; includes lease doc for resident_renter)
├── My Contact Info
├── My Fees (read-only line items from Active Fee Schedule)
└── Help

Admin (ECI, dockmaster, board)
├── Marina Configuration
│   ├── Slip Inventory (versions, slips, visual map editor)
│   └── Season Parameters (dates, half-split, defaults)
├── Holders Directory (filter by state)
├── Slip Assignments (grid + map view + booking calendar)
├── Booking Calendar (per slip + marina-wide)
├── Transient Request Queue
├── Document Review Queue
├── Compliance Dashboard
├── Residency Watch (lease-doc expirations)
├── Pricing
│   ├── Active Fee Schedule
│   ├── Scenario Modeler
│   ├── Scenario Library
│   └── State Machine + Audit
├── Reports
│   ├── Occupancy / Year-over-Year (by lease type)
│   ├── Compliance Summary
│   ├── Revenue Projection (by lease type)
│   ├── Transient Activity
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
- **Booking-priority order is visible:** the assignment UI shows "Full-season offers open until [date], then half-season opens, then transient" as a top-of-page banner.

---

## 7. Build vs. Buy/Stitch Analysis — Refreshed for v0.3 `[HIGH]`

### 7.1 What changed since v0.2

v0.2 already concluded that custom build was justified by the Pricing Engine + Scenario Modeler capability gap, but flagged ECI adoption (Q-G4) as the make-or-break risk. **v0.3 retires that risk** — Kathy has explicitly told Nick she wants him to build this — so the build decision now rests on capability gap + sponsor commitment, both of which are strong.

The reframing of transient as a lease type (not a pillar) does NOT weaken the build case; if anything, the booking-calendar + three-lease-type model is even further beyond off-the-shelf tooling.

### 7.2 Why off-the-shelf still fails

| Stitched component | Why it fails (v0.3) | Verdict |
|---|---|---|
| Airtable | Cannot model three-lease-types-per-slip-season with calendar-driven conflict rules; cannot run side-by-side scenario compare with season-date overrides; cannot enforce a fee-schedule state machine. | Fails. |
| Google Sheets | Can do the math; cannot enforce booking conflict rules across rows; cannot do state machines; cannot do role separation. | Fails. |
| Excel + macros | Worse than Sheets on collaboration and audit. | Fails. |
| Dockwa / DockMaster / MARINAGO | Built around payments + reservations; don't expose a fee-modeling sandbox; don't speak to AppFolio. | Fails. |
| Custom Airtable + Zapier glue | Fragile, not auditable; collapses when rate or booking model gains nuance. | Fails. |

### 7.3 Why custom build now decisively wins

Two reinforcing factors:

1. **Capability gap** — the Scenario Modeler + three-lease-type booking calendar are the differentiated capabilities. Off-the-shelf cannot do them.
2. **Sponsor commitment** — Kathy/ECI has explicitly committed (2026-05-19). The build will have a real user.

The other three pillars (assignment, docs, patron site) piggyback on the same data model, auth, and hosting, so marginal cost is small.

### 7.4 Verdict `[HIGH]`

**Build custom.** Estimated effort:
- **MVP scope: 200–300 hours of solo work** (6–9 months at 8–12 hrs/week — slight upward revision from v0.2 due to booking-calendar complexity)
- **Cost: ~$30–50/mo hosting**
- **Risk: maintenance burden + bus factor (now the top remaining risk — see Section 9)**

The v0.2 caveat "still requires ECI buy-in" is **retired.** Kathy's commitment + the capability gap jointly justify the build.

---

## 8. Dependencies, Assumptions & Open Questions

### 8.1 Dependencies

- ~~**ECI buy-in.**~~ ✅ **Confirmed 2026-05-19.**
- **Board approval.** Hosting budget, domain, branding, retention policy, fee-schedule workflow, **booking-priority rules + offer-deadline cadence**.
- **Marina restoration completion.** Final slip layout for the post-restoration config version.
- **Initial holder + slip data.** One-time import from AppFolio (CSV) or manual entry. **Resident-renter lease docs collected at onboarding.**
- **NOAA station ID** for the tide/weather embed nearest Wharfside.
- **AppFolio CSV import format alignment.** Nick + Kathy to confirm the strawman schema (Section 3.8) matches AppFolio's actual import expectations.
- **Attorney review (Hubert Cutolo)** for any fee-schedule change touching Sec 24(B) loan structure.

### 8.2 Confirmed Assumptions (from session)

- Four pillars = total scope.
- AppFolio owns billing; MVP exports CSV per the locked strawman schema; ECI maps charge_type to GL accounts.
- **Three lease types share one slip inventory:** full-season (offered first, goal 100% occupancy), half-season (offered second on slips not taken full), transient (gap-fill, ECI-approved).
- **Four holder states** with **season-start residency lock** (mid-season changes ignored; re-verify at next renewal).
- Resident discount is flexible (multiplier / flat / independent); seed default **0.75× multiplier**.
- Half-season pricing is flexible (multiplier / flat / independent); seed default **0.60× full per half**; hard date-based split (default midpoint, override allowed).
- Resident discount applies to BOTH halves and (per default) to transient.
- Premium slip surcharge: **+10% flat** (placeholder).
- Amenity fee waived for residents (none today; modeler supports adding).
- No buy-in at Wharfside today; data model supports it for future.
- No secondary market.
- Slip-fit constraints enforced with admin override + ≥20-char justification.
- Transients are not self-service; ECI approves all requests.
- Marina map is medium-fidelity (PNG/SVG + clickable polygons).
- Marina configuration is versioned (pre-/post-restoration coexist) AND season-parameter-configurable (modelable in scenarios).

### 8.3 Open Questions

Numbered with prior `Q-` IDs preserved where applicable. **Struck items resolved in v0.3.**

**Critical path (block architecture decisions):**

1. ~~**Q-G4 — ECI adoption.**~~ ✅ **RESOLVED 2026-05-19** — Kathy confirmed.
2. ~~**Q-OWN1 — Resident definition.**~~ ✅ **RESOLVED 2026-05-19** — 4 holder states (resident-owner, resident-renter, non-resident owner, non-resident); season-start residency lock.
3. ~~**Q-PRICE1 — Resident multiplier.**~~ ✅ **RESOLVED 2026-05-19** — flexible mode (multiplier / flat / independent); seed default 0.75× for FY27; tunable by board in modeler.
4. ~~**Q-AF1 — AppFolio CSV schema.**~~ ✅ **RESOLVED 2026-05-19** — strawman schema locked in Section 3.8. Nick to confirm with Kathy during build.
5. **Q-TR1 — Transient capacity & pricing.** What is the typical transient stay length, and what is the per-foot per-night rate? (Transient capacity is now a function of full+half occupancy, not a fixed slip count — so this is mostly a pricing question now.)

**v0.3 NEW — Critical path (block architecture or seed-scenario build):**

6. **Q-PRIORITY1 — Booking priority order + offer cadence.** What dates govern the cascade? E.g., "Full-season renewals due Feb 15 → unrenewed slips open to half-season Feb 16–Mar 15 → unrenewed half-slots become transient-eligible Mar 16." Board needs to set the cadence so the system can drive it.
7. **Q-DEPOSIT1 — Slot locking / deposit policy.** Does a holder "lock" a slip-season slot at offer-acceptance, or only at first-payment / signed-agreement? What state moves an Assignment from `proposed` → `confirmed`? Drives whether a half-season slot can be revoked / re-offered if not promptly accepted.
8. **Q-TRANSIENT1 — Transient activation trigger.** Manual flag (Option A), automatic by date (Option B), or hybrid review queue (Option C — proposed default)? See Section 3.4.B.

**v0.3 NEW — High-priority (affects seed-scenario + modeler defaults):**

9. **Q-RESDISCT1 — Resident discount on transient.** Does the resident discount apply to transient bookings? Default proposal: yes (consistent treatment), but board should confirm — could be argued either way.
10. **Q-PREMIUM1 — Premium surcharge line-item visibility.** Should `PREMIUM_SURCHARGE` be a separate line in the AppFolio CSV (current strawman), or folded into the base `SLIP_*` row? Affects ECI's reconciliation workflow.
11. ~~**Q-AMENPRO1 — Amenity fee proration on half-season.**~~ ✅ **RESOLVED 2026-05-19** — Half-season holders pay **0.50× the annual amenity fee** (prorated to half).
12. **Q-RENTERLEASE1 — Lease doc requirements.** Minimum lease term to qualify as resident_renter (month-to-month OK? 6-month minimum? 12-month?). What document language must be present (parties, term, premises)?

**High-priority (preserved from v0.2):**

13. **Q-MAP1 — Existing marina diagram.** Does ECI or the restoration team have a current PNG/SVG/CAD diagram of the marina that can be used as the map background? Or do we render synthetically?
14. **Q-DOC1 — Indemnification cadence.** Annual re-sign, or one-time at slip onboarding? Drives reminder logic.
15. **Q-DOC2 — COI minimums.** Liability limit ($500K? $1M?), pollution coverage, additional-insured language (Wharfside Manor Condo Assoc + ECI both? Just the Association?).
16. **Q-DOC3 — Captain credential.** When is this required? (USCG-documented vessels above a certain size? Charter use? Never required for purely-recreational?)
17. **Q-OVERRIDE1 — Override audit visibility.** Should slip-fit overrides be visible to the board on a standing report, or only on request? (Default: standing report — FR-3.7.4.)

**Medium-priority (preserved from v0.2):**

18. **Q-DM1 — Dockmaster identity.** Is the dockmaster Kathy herself, an ECI staffer, a contractor, or a volunteer board member? Drives role design.
19. **Q-BRAND1 — Branding.** Wharfside navy/gold only? Or ECI co-brand? Or marina sub-brand?
20. **Q-DOMAIN1 — Domain.** Subdomain of wharfsidemb.com, or new (wharfsidemarina.com)?
21. **Q-WAIT1 — Waitlist policy.** Does the waitlist exist, per lease type? Who maintains? How is it communicated? (Phase 1.5 module.)
22. **Q-COMP1 — Compliance enforcement.** What happens if a holder's COI expires? Boat removed? Slip suspended? Warning only? Drives whether the system enforces or only notifies.
23. **Q-G1 — Anchor launch.** Spring 2027 confirmed? Or earlier soft-launch (e.g., dockmaster-only pilot during 2026 season)?
24. **Q-FEE1 — Fee schedule export PDF format.** Branded PDF template — Wharfside header / logo / footer / signature block?

---

## 9. Risks `[HIGH]`

**v0.3 — ECI adoption risk retired. Remaining risks renumbered.**

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Bus factor — Nick rolls off the board or burns out mid-build** | Medium | High (maintenance orphan; build does not complete) | Keep MVP small (no payments, no live AppFolio API). Document everything. Prefer hosted services over self-hosted. Plan for handoff to ECI or successor by end of 2027. Build kill criteria into MVP (Q-G3 / Section 10). |
| 2 | **Marina restoration timing** changes slip count + layout late | Medium | Medium | Build slip inventory as configurable + versioned data, not hardcoded. New config version after restoration finalizes. Booking calendar is decoupled from physical layout. |
| 3 | **Scope creep** (back into billing, payments, reservations) | Medium-High | High | Section 1 "What this is NOT" is explicit. Refer feature requests back. AppFolio is the answer for billing. |
| 4 | **Maintenance burden** post-launch on a solo dev | Medium-High | Medium | Phase 1.5 + Phase 2 must be opt-in, not commitments. Build kill criteria into MVP. |
| 5 | **Board governance friction** on Sec 24(B) / fee-schedule changes | Medium | Medium | Hubert Cutolo review gate before any approved fee schedule materially changes the loan-cost-allocation model. State machine forces explicit approval steps. |
| 6 | **AppFolio CSV schema drift** — actual AppFolio import format differs from strawman | Medium | Medium | Nick + Kathy validate the strawman against an AppFolio dry-run before MVP launch. Schema is centralized in code; easy to amend. |
| 7 | **Booking-priority policy churn** — board reverses booking-cadence rules mid-season | Medium | Medium | Booking cadence configurable in Marina Configuration; no hardcoded dates. State machine + audit log capture changes. |
| 8 | **Slip-holder adoption** (low digital literacy among retirement-age residents) | Medium | Medium | Magic-link auth. Large buttons. Email-fallback workflow. Phone support during launch. |
| 9 | **Privacy/legal exposure** on stored insurance + indemnification + lease docs | Low-Medium | Medium | Signed-URL private object storage. Retention policy board-approved. Hubert review on indemnification language. Lease docs handled with same controls. |
| 10 | **Scenario Modeler complexity** outgrows the data model (season-date variations, multi-lease-type) | Low-Medium | Medium | Pure-function resolver design. Model variants flagged up front in Section 3.6.1. Marina Configuration is first-class and modelable per scenario. |
| 11 | **Transient activation policy ambiguity** — manual vs. automatic flagging causes ECI workflow friction or revenue loss | Medium | Low-Medium | Resolve Q-TRANSIENT1 before MVP. Default to hybrid (Option C) review queue. |

*Retired in v0.3:* ~~ECI doesn't adopt~~ (Kathy committed 2026-05-19).

---

## 10. Success Criteria `[MEDIUM — VERIFY Q-G2]`

Six months post-launch, "this worked" =

1. ≥80% of slip-holders have a current (non-expired) COI + registration approved in the system.
2. ECI logs in at least weekly; reports this is the primary place they go for slip info.
3. Patron website is the first Google result for "Wharfside Marina rules" / "Wharfside Manor marina."
4. Linda has run at least one scenario through the state machine end-to-end, exported the board PDF, and Active'd the result.
5. CSV export to AppFolio has been used to drive at least one billing cycle without manual reconciliation errors.
6. **v0.3 NEW:** at least one half-season AND at least one transient booking have been recorded in the system in the first season — confirms the lease-type model is exercised end-to-end.

"This failed" =

1. ECI continues to use email/spreadsheets instead of the system, OR
2. <30% of slip-holders ever log in to the portal, OR
3. The Scenario Modeler is used zero times by Linda or the board in the first season, OR
4. Nick spends >4 hours/month on maintenance after the first 90 days.

---

## 11. Appendix — Key Wharfside Facts (preserved from v0.1/v0.2)

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

*End of draft v0.3. Next step: Architecture pass on the booking-calendar + lease-type data model, with the seed scenario (FY27 defaults from Section 3.6.1) as the worked example. Nick to resolve Q-PRIORITY1, Q-DEPOSIT1, Q-TRANSIENT1 before architecture finalizes booking-state machine.*
