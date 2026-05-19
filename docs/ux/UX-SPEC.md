# Wharfside Marina — UX Specification (v0.1)

**Project:** `wharfside-marina`
**Status:** Draft v0.1 — initial UX pass, anchored on Scenario Modeler as the "fall in love" screen
**Author:** UX Design specialist (Software Project team)
**Date:** 2026-05-19
**Inputs:** `docs/requirements/draft-prd-v0.2.md` · `docs/strategy/OFFICE-HOURS.md`
**Next step:** Validate Section 4.1 with Linda before any prototype work.

---

## 1. Executive Summary

### Design Vision

Wharfside Marina is an **internal operations tool with a quiet public face**. It should feel like a high-trust spreadsheet that became self-aware — precise, fast, auditable, and never showy. The Scenario Modeler is the centerpiece: a CPA-grade pricing workbench that gives Linda the speed of Excel with the structure and audit trail of a real system. Everything else — slip ops, document collection, the patron site — is sturdy, scannable, and built around minimum clicks for an operator (Kathy) who already runs three other properties from her inbox.

### Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Modeler layout | Three-pane: rate matrix (left, 60%) + projection (right, 40%) + sticky header/footer | Mirrors Excel's pivot-then-summary mental model Linda already owns. |
| Modeler recalc | **Live, debounced ~250ms** with a "Calculating…" pip in the projection header | Excel users expect immediate feedback on edits. A "recalc" button would feel slower than the tool it's replacing. |
| Slip map | SVG marina diagram with clickable slip polygons + collapsible right-side detail panel | Kathy needs to *see* the marina, not navigate a grid. Detail panel keeps map context. |
| Holder portal auth | Magic-link only, no passwords | Retirement-skew user base; eliminates the #1 support call. |
| Patron site tone | Yacht-club-on-the-Shrewsbury: warm navy, brushed gold, generous whitespace, one photograph | Professional, slightly nautical, not Captain-Stubing kitsch. |
| Save model on Modeler | Autosave drafts every 5s; explicit "Submit for Approval" gate | Linda can iterate freely without fear of losing work; state transitions are explicit. |
| Mobile strategy | Admin desktop-first; portal mobile-first; map view tablet-first for Kathy at the dock | Tools should match where they'll be used. |
| Destructive actions | Confirm modal with typed-name confirmation for state changes; soft-undo for everything else | Audit trail is the boss; nothing irreversible without intent. |

### Design Principles

1. **Spreadsheet-fluent.** Linda and Kathy think in rows and columns. The product should never make them learn a third mental model.
2. **Audit is the feature.** Every change is signed, dated, and reversible-by-record. Auditability is a first-class UI surface, not buried in a log.
3. **Three clicks max.** Any common Kathy task — assign a slip, approve a doc, look up a holder — should be reachable in three clicks from her home screen.
4. **Export is everywhere.** A CSV button on every grid, a PDF button on every report. Anti-lock-in is a UX promise.
5. **Plain English.** No jargon, no system codes in user-facing copy. "Approved" not "STATUS_2". Failure messages name the failing thing and the fix.
6. **Calm.** No drop-shadows. No animations that don't carry information. The marina is 30 years old; the tool should feel like it belongs.

---

## 2. Information Architecture

### 2.1 Admin App (ECI + Board)

```
Admin (signed in)
├── Dashboard (home)             ← Kathy's landing: queues, alerts, today's view
│   ├── Pending document reviews
│   ├── Transient requests waiting
│   ├── Expiring docs (next 30d)
│   └── This-season occupancy widget
├── Slip Board                   ← Map view (Kathy's primary)
│   ├── Map (default)
│   ├── Roster grid (toggle)
│   └── Per-slip history
├── Holders
│   ├── All holders (search/filter)
│   ├── Holder detail (vessels, assignments, docs, fees)
│   └── New holder
├── Transient Queue
│   ├── Pending requests
│   ├── Calendar (availability)
│   └── History
├── Documents
│   ├── Review queue
│   ├── Compliance dashboard
│   └── Audit log
├── Pricing                      ← Linda's home
│   ├── Active Fee Schedule      ← current truth
│   ├── Scenario Modeler         ← the room she falls in love in
│   ├── Scenario Library
│   └── Approval audit
├── Reports
│   ├── Occupancy YoY
│   ├── Compliance summary
│   ├── Revenue projection
│   └── Slip-fit overrides
├── Marina Config                ← versioned layout admin
│   ├── Active version
│   ├── Future version (in flight)
│   └── Archived versions
└── Settings
    ├── Users & roles
    ├── Reminder cadence
    └── Export schemas (AppFolio CSV)
```

**Top-level nav pattern:** persistent left sidebar (collapsible to icons on tablet), 56-px top bar with breadcrumbs + global search + user menu. Linda lands in **Pricing**; Kathy lands in **Dashboard**.

### 2.2 Slip-Owner Portal

```
Portal (magic-link signed in)
├── My Dashboard                 ← single page, scrollable
│   ├── My slip (current + upcoming season)
│   ├── My vessel(s)
│   ├── My documents (with status badges)
│   ├── My fees (read-only line items)
│   └── My contact info
├── Upload a document            ← deep-link target from email reminders
├── Forms library
└── Help / Contact ECI
```

Single-page-with-anchors. No deep navigation. Email reminders deep-link to specific actions ("Upload your COI" lands directly on the upload screen with the doc type pre-selected).

### 2.3 Patron (Public) Website

```
Patron site (public)
├── Home                         ← hero + "I need to..." cards
├── Marina rules
├── Contact + emergency
├── Marina map (read-only)
├── Forms library
├── Local services
├── VHF + approach
├── Tide / weather (NOAA embed)
├── FAQ
├── Request a transient slip     ← single-page form
└── Slip-owner login →           ← magic-link entry
```

Flat. No more than two clicks to any destination from home. Public site is also the slip-owner login landing — they enter their email, get a magic link, arrive at the portal.

### 2.4 Navigation Patterns

| Pattern | Where | Behavior |
|---|---|---|
| Persistent left sidebar | Admin | Collapsible to 56px icon rail on <1280px viewports. |
| Top breadcrumbs + global search | Admin | Global search is `/` keyboard shortcut; searches holders, slips, vessels, scenarios. |
| Tab strip | Within entity detail pages (Holder, Slip, Scenario) | Tabs for sub-sections; URL-addressable per tab. |
| Right-side detail panel | Slip Board, Document Review, Transient Queue | Click row/polygon → panel slides in from right; close keeps list state. |
| Anchored single-page | Slip-owner portal | All sections on one scroll; jump links in a sticky sub-nav. |
| Card grid + hero | Patron site | Home is hero + 6 cards; child pages are content + sidebar contact card. |

---

## 3. User Journeys

### Flow A — Linda creates and approves a new fee schedule

**Trigger:** Board has asked for a "what would a 5% across-the-board increase plus a $200 amenity fee for non-residents look like" analysis before the November meeting.

1. Linda signs into admin → lands on **Dashboard** → clicks **Pricing** in left sidebar.
2. **Active Fee Schedule** page loads. She reads the current rates, clicks **"Model a scenario from this"** button (top-right).
3. **Scenario Modeler** opens with a *copy* of the Active schedule. Title bar reads "Scenario · Untitled draft" in italic; state badge shows **Draft** (gray).
4. She clicks the title, types "FY27 — 5% bump + non-resident amenity fee", presses Tab. Title commits; autosave pip flashes "Saved" in the footer.
5. Left pane: rate matrix. She clicks the cell at *Premium row × Full-Season column* and edits the base rate. Cursor moves to the next cell on Enter (Excel-style). She edits Standard and Restricted rows similarly.
6. She clicks the **Amenity Fee** row, toggles "Applies to non-residents", types `200`. Right pane recomputes (250ms debounce); the projection delta header pulses green and shows **+$17,400 vs. Active**.
7. She glances at the right pane: total projected revenue, revenue-by-holder-type donut shifts visibly, revenue-by-lease-type bar updates. A small "vs. Active" strip at the top of the right pane shows the delta in dollars and percent.
8. She clicks **Compare** in the header → modal opens letting her pick a second scenario or the baseline; she picks "Active FY26". A 3-column compare table renders inline below the modeler (or in a slide-over). She scans it, closes the compare.
9. She clicks **Export PDF** in the header → modal: "Export this Draft as PDF? It will be marked 'DRAFT — not yet board-approved.'" She confirms. PDF download starts. Filename: `wharfside-FY27-5pct-bump-DRAFT-2026-11-02.pdf`.
10. She emails the PDF to the board (outside the app — board approval is out-of-band per PRD).
11. Two weeks later, after the board meeting approves, she returns. Scenario is still in **Draft**. She clicks **Submit for Approval** → confirmation modal asks for note ("approved at 11/15 board meeting, see minutes"). She confirms. State changes to **Submitted** (blue badge); editing is locked.
12. She clicks **Mark Approved** → modal: "Reference the approval source — meeting minutes link, email, or note." She pastes a link to the meeting minutes Google Doc. State → **Approved** (green).
13. She clicks **Promote to Active** → confirmation modal: "This will archive the current Active schedule (FY26 — base rates) and make this scenario the new Active. CSV exports to AppFolio will use this schedule starting [effective date]. Type APPROVED to confirm." She types it, confirms. State → **Active**.
14. She is redirected back to the Active Fee Schedule view. Banner across the top: "Active schedule updated. Previous schedule archived." Audit trail shows her three actions with timestamps.

**Total time, end to end (excluding the two-week board pause):** ~12 minutes. She did it without leaving the modeler except to email the PDF.

### Flow B — Kathy assigns a returning slip-owner for the new season

**Trigger:** It's March. The Petracco family had slip 47 last year and Kathy expects them back.

1. Kathy signs in → **Dashboard** → sees "Season setup: 22 of 86 slips assigned for 2027".
2. Clicks **Slip Board** → map renders. Slips not yet assigned for 2027 show in soft yellow.
3. Presses `/` (global search) → types "Petracco" → result shows "Joe Petracco — last slip: 47 (2026), vessel: *Lulu* (Boston Whaler 270)". Hits Enter.
4. **Holder detail** opens. She clicks the **Assignments** tab. Sees the 2026 row. Clicks **"Reassign for 2027"** button.
5. Modal opens pre-filled: slip 47 · *Lulu* · Full Season. It runs the slip-fit check automatically — green checkmark next to LOA, beam, draft. Below the form: "Fee for this assignment based on Active schedule: **$4,250** (line-item breakdown ▾)".
6. She glances; expands breakdown if curious. Clicks **Confirm assignment**.
7. Toast: "Slip 47 assigned to Joe Petracco for FY27. Audit logged. CSV export will include this line." Slip 47 on the map flashes green, then settles to its standard-assigned color.

**Total clicks:** 5 (sidebar → search → reassign → confirm-fit → confirm-assignment). She didn't need a form.

### Flow C — Kathy handles a transient request

**Trigger:** Public form submission email at 9:47am: "New transient request — *Sandpiper*, 32', Sept 14–17."

1. Kathy taps the email notification on her phone → deep link opens **Transient Queue** in mobile-responsive admin.
2. Request detail loads in a slide-up panel: vessel info, requested dates, contact, purpose ("weekend before fall offshore tournament").
3. She taps **"Check availability"** → calendar slides up showing the transient-designated slips with Sept 14–17 highlighted. Two slips are open; one (T-3) is closer to the fuel dock.
4. She taps T-3 → confirmation: "Assign T-3 for Sept 14–17 at $X/night × 4 nights = $Y?" Slip-fit ran automatically (green check). She taps **Approve**.
5. Toast: "Approved. Confirmation email sent to requester with COI upload link (expires Sept 12)."
6. On Sept 12 morning, if the COI hasn't been uploaded, a yellow flag appears in Kathy's Dashboard ("Transient COI overdue — *Sandpiper*"). She can extend the deadline or revoke.

### Flow D — Slip-owner uploads a renewed COI

**Trigger:** Joe Petracco's COI expires June 30. On May 1, the T-60 reminder fires.

1. Joe gets an email subject: "Action needed: Your insurance certificate expires in 60 days." Body: "Hi Joe, your COI on file for *Lulu* expires June 30, 2027. Upload your renewed certificate using the button below — it takes about a minute." Big button: **Upload my COI**.
2. He clicks the button on his iPad. Browser opens. He's asked for his email (magic-link entry); enters it.
3. A second email arrives: "Click here to sign in." He clicks; lands on **Upload a Document** page with COI pre-selected and the renewal context noted.
4. He taps **Choose file**, picks the PDF from his Downloads folder. The page shows a thumbnail. He taps **Expiration date** (default: one year from today, editable). Confirms June 30, 2028.
5. Taps **Upload**. Progress bar; ~3 seconds. Confirmation: "Got it. ECI will review within 1–2 business days. We'll email you when it's approved." Status badge shows **Pending review**.
6. Kathy reviews next morning → approves → Joe gets approval email + green **Current** badge in his portal. T-60/T-30/T-7 reminders for the *old* expiration are automatically suppressed.

### Flow E — Public visitor checks marina rules

**Trigger:** Captain motoring north from Sandy Hook tomorrow wants to know the VHF hailing channel and any guest-dock policies.

1. Googles "Wharfside Marina Monmouth Beach" → top result is the patron site.
2. Lands on **Home**. Hero image of the marina; under it, six cards: **Rules · Map · Forms · FAQ · Contact · Request a Slip**.
3. Taps **Rules**. Page is clean: TOC on the left (or top, mobile), sections from the WMCA Handbook. He scrolls to "Approach and Hailing" — finds VHF channel + dockmaster phone + after-hours emergency.
4. He taps the phone number — phone app opens. Done in ~30 seconds.

---

## 4. Wireframe Specs

### 4.1 Scenario Modeler (Linda's primary — PRIORITY)

This is the screen Linda must fall in love with. The brief from Office Hours is unambiguous: "feel like Excel but smarter." Three structural choices make that real:

**The three things that beat Excel:**
1. **Live recalc with side-by-side delta vs. the Active schedule** — Excel can do this, but only with hand-built lookup tables and a lot of staring. Here it's the default view: every edit instantly updates the projection and the delta against the current truth.
2. **State machine on top of the math** — Excel has no notion of "Draft → Submitted → Approved → Active." Linda's pain isn't the formula, it's the *governance loop* around the formula. The Modeler is a workbook with audit and approval baked in.
3. **Per-holder revenue impact, on demand** — one click expands "show me which specific slip-holders are affected by this change and by how much." Excel needs a separate sheet and VLOOKUP gymnastics; here it's a button.

#### 4.1.1 Layout

Desktop, target 1440×900+ (will work down to 1280×800). Vertical layout regions:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◀ Pricing / Scenarios / FY27 — 5% bump + non-resident amenity fee  [Draft]  │  ← Header bar (56px)
│  [Save] [Submit for Approval] [Mark Approved] [Promote to Active] [Compare ▾] │
│  [Export PDF] [Export CSV] [Duplicate] [Archive]                              │
├────────────────────────────────────────────┬─────────────────────────────────┤
│                                            │  ▎vs. ACTIVE FY26               │  ← Right pane (40%)
│  RATE MATRIX                               │  ┌──────────────────────────┐   │
│  ─────────────                             │  │ Projected revenue:       │   │
│  Season dates: [Apr 15] → [Oct 31]         │  │   $487,250               │   │
│  Half-season split: [Jul 31]               │  │   ▲ +$17,400  (+3.7%)   │   │
│                                            │  └──────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │                                 │
│  │            │ FULL  │ HALF-1 │ HALF-2│   │  Revenue by HOLDER TYPE         │
│  │            │ SEASON│        │       │   │  ╭────────────────────╮         │
│  ├────────────┼───────┼────────┼───────┤   │  │ ▓▓▓▓ Resident      $322k     │
│  │ PREMIUM    │ 5,250 │ 2,750  │ 2,750 │   │  │ ▓▓▓▓ Non-resident  $148k     │
│  │ STANDARD   │ 4,250 │ 2,250  │ 2,250 │   │  │ ▓▓ Transient        $17k     │
│  │ RESTRICTED │ 3,500 │ 1,850  │ 1,850 │   │  ╰────────────────────╯         │
│  └─────────────────────────────────────┘   │                                 │
│  Transient: $/ft/night                     │  Revenue by LEASE TYPE          │
│  ┌──────────────────────────┐              │  ┌────────────────────┐         │
│  │ Premium    $4.50          │              │  │ Full season    78% │         │
│  │ Standard   $3.75          │              │  │ Half season    18% │         │
│  │ Restricted $3.00          │              │  │ Transient       4% │         │
│  └──────────────────────────┘              │  └────────────────────┘         │
│                                            │                                 │
│  HOLDER MULTIPLIERS                        │  OCCUPANCY ASSUMPTIONS          │
│  Resident:      [0.75]×                    │  Full season   [100]%           │
│  Non-resident:  [1.00]×                    │  Half-1        [ 92]%           │
│                                            │  Half-2        [ 88]%           │
│  AMENITY FEE                               │  Transient avg [ 22] nts/yr     │
│  ☑ Applies to non-residents                │                                 │
│  ☐ Applies to residents (waived per HOA)   │  ► Show per-holder impact (86)  │
│  Amount: [$200] /year                      │                                 │
│                                            │                                 │
│  BUY-IN ONE-TIME                           │                                 │
│  Resident:      [$0]                       │                                 │
│  Non-resident:  [$0]                       │                                 │
│                                            │                                 │
├────────────────────────────────────────────┴─────────────────────────────────┤
│  Last edited by Linda Masessa · 2 min ago · Autosaved · v.12 of this draft   │  ← Footer (40px)
└──────────────────────────────────────────────────────────────────────────────┘
```

**Header bar (top, 56px, sticky)**
- Breadcrumb: `◀ Pricing / Scenarios / [Scenario name — inline editable]`
- State badge (right of title): Draft (gray) · Submitted (blue) · Approved (green) · Active (gold) · Archived (slate)
- Primary action button on the right reflects the *next* state transition: in Draft it's **Submit for Approval**; in Submitted it's **Mark Approved**; etc. Subdues less-relevant actions into a kebab menu.
- Persistent secondary actions: **Compare ▾**, **Export PDF**, **Export CSV**

**Left pane — Rate Matrix Editor (60% width)**
- **Season dates** at the top: two date inputs (start, end) plus a half-season-split date.
- **Rate matrix grid** — the centerpiece. Slip tiers as rows (Premium, Standard, Restricted), lease types as columns (Full Season, Half-1, Half-2). Each cell is inline-editable. **Excel-style keyboard navigation:** Enter moves down, Tab moves right, arrows navigate, Esc cancels edit. Sticky row and column headers when the grid would scroll (it doesn't at this small size, but the pattern stays for consistency).
- **Transient rates table** below the main grid — same 3 tiers, single column ($/ft/night).
- **Holder multipliers** — discount factors as decimal inputs with explanatory subtext ("Resident discount applied to base rate before fees").
- **Amenity fee** — two toggles (residents, non-residents) plus an amount input. Disabled inputs ghost out.
- **Buy-in one-time** — two inputs, currently zero; included to telegraph the data model supports it.

**Right pane — Projection (40% width, sticky to header on scroll)**
- **Topline card:** Projected revenue (large), delta vs. Active in green-or-red with arrow. Hovering the delta shows a tooltip: "Compared to Active FY26 schedule". A small "vs." dropdown lets Linda change the comparison baseline (Active, another scenario, or "no comparison").
- **Revenue by holder type:** horizontal stacked bar (preferred over donut — easier to read deltas). Each segment labeled with dollar amount.
- **Revenue by lease type:** horizontal stacked bar.
- **Occupancy assumptions:** tunable percentages. Defaults: 100% full-season residents (per PRD assumption), 92/88 half-season, 22 nights/yr average transient. These are *editable* — changing the assumption recomputes the projection. Subtle label: "Assumptions affect projection only, not Active billing."
- **Per-holder impact** (collapsed by default): expandable section showing all 86 slip-holders in a sortable table — Name · Current fee · Scenario fee · Delta. Sortable, exportable as CSV. This is the Excel-killer feature.

**Footer (40px, sticky)**
- Audit line: "Last edited by [Linda Masessa] · 2 min ago · Autosaved · v.12 of this draft"
- Clicking the version number opens a version history slide-over.

#### 4.1.2 "Fall in love" moments

| Moment | What Linda sees | Why it beats Excel |
|---|---|---|
| First edit on the matrix | Right pane delta pulses green; both stacked bars re-animate to new proportions in ~300ms | Excel would require pressing F9 or watching dependent cells recalculate. Here it's immediate and *visible*. |
| Comparing to Active | Inline 3-column compare ("Active" / "This scenario" / "Δ") with row-level highlight of changes | Excel needs side-by-side workbooks. Here it's one click. |
| Per-holder impact | One-click expand → 86 rows of named impact, sortable, exportable. Click any name to see that holder's full line-item breakdown. | Excel pivot tables can do this with VLOOKUPs; this just does it. |
| State machine | "Submit for Approval" button on top with clear next-step. Modal makes Linda type the approval source. | Excel has no notion of governance. Here the workbook *knows* what comes next. |
| PDF export | One-click branded PDF with Wharfside header, scenario name, projected revenue summary, full breakdown, "DRAFT — not yet board-approved" watermark | Replaces the manual "save as PDF then add header in Word" dance. |
| Audit trail | Every state transition, every cell edit, every export — visible, filterable, with actor and timestamp | Excel has change tracking that no one uses. This is built in and clean. |

#### 4.1.3 Edge cases and micro-states

- **Empty new scenario:** Cloned from Active by default. If user clones from another scenario, banner reads "Cloned from [scenario name] — edits will not affect the source."
- **Validation:** If a multiplier is left blank or zero, cell turns soft red with tooltip "Multiplier required". Save still works; projection shows `—` until valid.
- **Locked states:** When in Submitted / Approved / Active / Archived, all matrix cells are read-only with a lock icon top-right. Cursor on hover: not-allowed. Banner at top: "This scenario is [state] and cannot be edited. To make changes, duplicate it as a new draft."
- **Comparison overlay:** Choosing "Compare" while editing dims the matrix slightly and renders a comparison strip above it. Doesn't block editing.
- **Autosave conflict:** If Linda has the same scenario open in two browser tabs, the second tab shows a yellow banner: "Another session is editing this scenario. Refresh to load the latest version." (Optimistic concurrency.)

---

### 4.2 Slip Map / Assignment Board (Kathy's primary)

Layout: full-bleed map with collapsible right-side detail panel.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◀ Slip Board                                  Season: [2027 ▾]  Map | Grid  │  ← Header
│  Filter: [All status ▾] [All tiers ▾]   86 slips · 22 assigned · 64 open    │
├──────────────────────────────────────────────────────┬───────────────────────┤
│                                                      │  SLIP 47 — Standard   │  ← Detail panel
│                                                      │                       │     (380px,
│   ┌──────────┐                                       │  Status: ASSIGNED     │     collapsible)
│   │ MARINA   │   ▓ ▓ ▒ ▒ ░ ░ ░ ░ ░                  │  Season: 2027         │
│   │ DIAGRAM  │   ▓ ▓ ▒ ▒ ░ ░ ░ ░ ░                  │                       │
│   │ (SVG)    │   ▓ ▓ ▒ ▒ ░ ░ ░ ░ ░                  │  HOLDER               │
│   │          │     (clickable slip polygons)         │  Joe Petracco         │
│   │          │     ░ ░ ░ ░ ░ ░ ░ ░ ░                │  (resident · unit 23A)│
│   │          │     ░ ░ ▓ ▓ ▓ ░ ░ ░ ░                │  📞 732-555-0188      │
│   │          │                                       │                       │
│   └──────────┘                                       │  VESSEL               │
│                                                      │  Lulu (Boston Whaler) │
│   Legend:                                            │  27' × 8'6" × 2'8"    │
│   ░ Available    ▓ Full-season    ▒ Half-season      │  ✓ Fits slip          │
│   ▓ Transient    ✕ Out of service                    │                       │
│                                                      │  ASSIGNMENT HISTORY   │
│                                                      │  2026 · Petracco/Lulu │
│                                                      │  2025 · Petracco/Lulu │
│                                                      │  2024 · Petracco/Lulu │
│                                                      │  ► Show all (8)       │
│                                                      │                       │
│                                                      │  ATTRIBUTES           │
│                                                      │  LOA limit: 32'       │
│                                                      │  Beam limit: 11'      │
│                                                      │  Min depth: 5.5'      │
│                                                      │  Power: 30A           │
│                                                      │  Tier: Standard       │
│                                                      │  Fee modifier: 1.0×   │
│                                                      │                       │
│                                                      │  [Reassign] [History] │
│                                                      │  [Edit slip]          │
└──────────────────────────────────────────────────────┴───────────────────────┘
```

**Interactions:**
- Click any slip polygon → detail panel slides in from right. Click another slip → panel updates (panel stays open).
- Click the map background → panel collapses.
- **Drag a holder card from the roster grid onto a slip** — Phase 1.5 enhancement; MVP uses click-to-assign.
- Hover a slip → tooltip with status, holder name, vessel name.
- Filters at top: by season, by status (Available / Full / Half / Transient / OOS), by tier.
- Toggle **Map | Grid** at top right. Grid view is a sortable table of all slips for the season.
- Search at top via global `/` shortcut works here — type "Petracco" or "47" or "Lulu" to highlight the matching slip.

**Color palette for slip statuses:**
- Available: soft sand (`#e8dcc4`)
- Full-season: deep navy (`#1a3a5c`)
- Half-season: lighter navy with diagonal hatch (`#3a5c7f`)
- Transient: gold (`#c9a227`)
- Out of service: muted slate (`#6b7280`) with diagonal hatch

**Tablet view (Kathy at the marina on her iPad):**
- Map takes full width.
- Detail panel becomes a bottom sheet on tap.
- Filter chips horizontal-scroll at the top.

---

### 4.3 Booking Calendar / Availability View

Used primarily for transient request triage; secondary for visualizing the season at a glance.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◀ Calendar                       View: [Per-slip timeline ▾]   Season: 2027 │
│                                                                              │
│         Apr   May   Jun   Jul   Aug   Sep   Oct                              │
│  ────────────────────────────────────────────────────────────────────        │
│  Slip 1 │░░░░░│███████████████████████████████│░░░░░│      ← Petracco/Lulu  │
│  Slip 2 │░░░░░│████████████│  H2 — Bianchi   │░░░░░│                        │
│  Slip 3 │░░░░░│███████████████████████████████│░░░░░│                        │
│  Slip 4 │░░░░░│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│░░░░░│   ← Available all yr  │
│  ...                                                                         │
│  T-1    │░░░░░│  Sep 14-17 ⌬  ░░░░░░░░░░░░░░░│░░░░░│   ← Transient pending  │
│  T-2    │░░░░░│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│░░░░░│                        │
│  T-3    │░░░░░│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│░░░░░│                        │
│                                                                              │
│  Legend: ██ Full season  ▓▓ Half-1  ▒▒ Half-2  ⌬ Transient pending  ░░ Open │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Slips as rows; calendar months as columns.
- Color-coded blocks per assignment.
- Pending transient requests overlay as semi-transparent blocks with a clock icon.
- Click any block → slide-over with assignment detail + edit option.
- Conflict detection: if a proposed assignment overlaps an existing one, the cell flashes red and the form blocks save (overridable with reason per PRD FR-3.3.3).
- Toggle to **per-day grid** view: rows = slips, columns = days; useful for transient triage in a busy week.

---

### 4.4 Document Center (slip-owner view)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Hi Joe.   My slip · My vessels · My documents · My fees · Contact info     │  ← Sticky anchor nav
│                                                                              │
│  MY DOCUMENTS                                                                │
│  ────────────────                                                            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ ●  Insurance (COI) — Lulu                                          │    │
│  │    [CURRENT]  Expires June 30, 2027                                │    │
│  │    Uploaded May 2, 2026 · Approved by Kathy May 3                  │    │
│  │    [View PDF]  [Replace]                                           │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ ●  Vessel Registration — Lulu                                      │    │
│  │    [EXPIRING] Expires August 15, 2027 — 47 days                    │    │
│  │    Renew your NJ registration online, then upload it here.         │    │
│  │    [Upload renewed registration ▸]                                 │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ ●  Indemnification waiver                                          │    │
│  │    [CURRENT]  On file since 2019                                   │    │
│  │    [View PDF]                                                      │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │ ●  Vessel survey                                                   │    │
│  │    [MISSING] Required for vessels over 25 years old                │    │
│  │    [Upload survey ▸]                                               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Need help? Email Kathy at kathy.vanecek@idealmgt.com or call 732-751-1991.  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Status badges (high contrast, large, color + icon for accessibility):**
- ● **Current** (green) — no action needed
- ● **Expiring** (amber) — within 60 days
- ● **Expired** (red) — past expiration
- ● **Missing** (slate) — required and never uploaded

**Card design:**
- Tall, generously padded, one card per document type.
- Big primary action button (Upload / Replace / View PDF).
- Plain-English explanatory text under each status ("Renew your NJ registration online, then upload it here.").

**Mobile (iPad-first):**
- Cards stack full-width.
- 48px+ tap targets.
- Sticky bottom action bar with a single big **Upload a document** button.

**Upload flow:**
- Drag-and-drop on desktop; file picker on mobile/tablet.
- PDF/JPG/PNG up to 25MB.
- Required: document type (pre-selected if deep-linked), expiration date (date picker with sensible default).
- Confirmation: "Got it. ECI will review within 1–2 business days."

---

### 4.5 Document Review Queue (Kathy's view)

Inbox-style list with side-panel preview.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ◀ Documents / Review queue                  4 pending · oldest first        │
├─────────────────────────────────────────┬────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │  COI — Joe Petracco · Lulu         │
│  │ ● COI · Petracco/Lulu  · 2d ago  │  │  Uploaded May 2, 2026 9:14am       │
│  │   Replaces: COI expiring 6/30/26 │  │                                    │
│  ├───────────────────────────────────┤  │  ┌─────────────────────────────┐  │
│  │ ● REG · Bianchi/Sea Glass · 1d   │  │  │   [PDF preview embedded]    │  │
│  ├───────────────────────────────────┤  │  │                             │  │
│  │ ● COI · Petracco/Lulu  · 3h ago  │  │  │   Geico Marine               │  │
│  ├───────────────────────────────────┤  │  │   Policy #M-447821-A         │  │
│  │ ● SURVEY · Schmidt/Aurora · 1h   │  │  │   Liability: $500,000        │  │
│  └───────────────────────────────────┘  │  │   Expires: June 30, 2027     │  │
│                                         │  │   Add'l insured: Wharfside   │  │
│  [▾ Bulk actions ▾]                     │  │     Manor Condo Assoc; ECI   │  │
│  ☐ Select all                           │  └─────────────────────────────┘  │
│                                         │                                    │
│                                         │  Verify:                           │
│                                         │  Carrier:        [Geico Marine]    │
│                                         │  Expiration:     [Jun 30, 2027]    │
│                                         │  Liability ≥$500K: ☑              │
│                                         │  Add'l insured:  ☑                │
│                                         │                                    │
│                                         │  [✓ APPROVE]   [✗ REJECT…]         │
└─────────────────────────────────────────┴────────────────────────────────────┘
```

**Behavior:**
- Left list, right preview. Click a row → preview loads in right pane.
- Keyboard shortcuts: `↑/↓` navigate list; `a` approve; `r` reject (opens reject reason modal); `j/k` for vim users.
- **Reject** opens a modal requiring a comment ≥20 chars; comment emails to holder.
- **Approve** is single-click; shows a 3-second "Undo" toast.
- Bulk: select multiple → bulk-approve (uncommon; useful at season start).
- Phase 1.5: OCR pre-fills the "Verify" fields from the PDF.

---

### 4.6 Transient Request Form (public)

Single page, no login. Mobile-first.

```
┌────────────────────────────────────────────────────────┐
│  Wharfside Marina                                       │
│  Request a transient slip                               │
│                                                         │
│  Wharfside Marina has a small number of transient       │
│  slips available by approval. Submit the form below     │
│  and our dockmaster will get back to you within 24 hr.  │
│                                                         │
│  Your name *                                            │
│  [_______________________________]                      │
│                                                         │
│  Email *                                                │
│  [_______________________________]                      │
│                                                         │
│  Phone *                                                │
│  [_______________________________]                      │
│                                                         │
│  Vessel name *                                          │
│  [_______________________________]                      │
│                                                         │
│  Vessel dimensions *                                    │
│  Length  [____] ft                                      │
│  Beam    [____] ft                                      │
│  Draft   [____] ft                                      │
│                                                         │
│  Arrival date *      Departure date *                   │
│  [__________]        [__________]                       │
│                                                         │
│  Purpose / notes                                        │
│  [_______________________________]                      │
│  [_______________________________]                      │
│                                                         │
│  ☐ I have read and agree to the marina rules (link)     │
│                                                         │
│             [ Submit request ]                          │
└────────────────────────────────────────────────────────┘
```

**Confirmation page:**
- Big check mark, "Request received."
- "We'll respond within 24 hours. Approved requests will receive an email with a link to upload your COI and registration (you'll have 48 hours)."
- Contact info if questions.

---

### 4.7 Patron Website Homepage

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Wharfside Marina                          Rules · Map · Forms · Contact ◀    │  ← thin nav (52px)
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│        ┌──────────────────────────────────────────────────────────┐         │
│        │                                                          │         │
│        │     [Marina photo — Shrewsbury River at golden hour]    │         │
│        │                                                          │         │
│        │     Wharfside Marina                                    │         │
│        │     A private slip community on the Shrewsbury River    │         │
│        │     Monmouth Beach, NJ                                  │         │
│        │                                                          │         │
│        └──────────────────────────────────────────────────────────┘         │
│                                                                              │
│  I'm here to...                                                              │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Read the    │  │  See the     │  │  Submit a    │  │  Reach the   │    │
│  │  rules       │  │  marina map  │  │  transient   │  │  dockmaster  │    │
│  │              │  │              │  │  request     │  │              │    │
│  │  →           │  │  →           │  │  →           │  │  →           │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐                                         │
│  │  Find a      │  │  Slip-owner  │                                         │
│  │  form        │  │  sign in     │                                         │
│  │              │  │              │                                         │
│  │  →           │  │  →           │                                         │
│  └──────────────┘  └──────────────┘                                         │
│                                                                              │
│  Quick info                                                                  │
│  ─────────                                                                   │
│  Hailing on VHF channel 9 · Office (ECI): 732-751-1991                       │
│  After-hours emergency: 732-970-6886                                         │
│                                                                              │
│  [NOAA tide chart embed — Shrewsbury River]                                  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Footer: rules · forms · contact · privacy · © Wharfside Manor Condo Assoc   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Tone:** professional, warm, a touch nautical (the photograph carries that without anchors-everywhere). Generous typography (18-20px body), navy + gold accent, lots of white space.

---

## 5. Component Library (high-level)

### 5.1 Color palette

| Role | Hex | Use |
|---|---|---|
| Primary navy | `#1a3a5c` | Headers, primary buttons, full-season slip color, brand |
| Accent gold | `#c9a227` | Active state badge, transient slip color, key highlights |
| Sand neutral | `#e8dcc4` | Available slip color, soft backgrounds |
| Slate gray | `#475569` | Body text on light backgrounds |
| Background paper | `#fafaf7` | App background (slight warmth, not white) |
| Success green | `#15803d` | Approved state, current docs, positive deltas |
| Warning amber | `#d97706` | Expiring docs, pending review |
| Danger red | `#b91c1c` | Expired docs, destructive confirm, negative deltas |
| Info blue | `#2563eb` | Submitted state, info banners |

**Contrast:** every text/background pairing tested for WCAG AA (4.5:1 minimum for body, 3:1 for large text).

### 5.2 Typography

- **Headings:** *Source Serif Pro* (or system serif fallback). Brings gravitas without preciousness.
- **Body + UI:** *Inter* (or system sans). Excellent at small sizes; numerals are tabular by default for the rate matrix.
- **Monospace (data cells):** *JetBrains Mono*. For the rate matrix and currency columns where alignment matters.
- **Base size:** 16px body; 18px on portal (older users); 14px in admin dense tables.

### 5.3 Buttons

- **Primary:** filled navy, white text, 8px radius, 40px height. State machine "next step" buttons are always primary.
- **Secondary:** outlined navy, navy text. Use for non-primary actions.
- **Tertiary (text):** underlined navy on hover. Use for inline links and low-emphasis actions.
- **Destructive:** filled red, white text. Always requires confirmation modal.
- **Icon-only:** 32px square; tooltip on hover.

### 5.4 Inputs

- **Text/number:** 40px height, 8px radius, 1px slate border, soft focus ring in navy.
- **Date pickers:** native HTML where possible; custom only for ranges.
- **Currency:** right-aligned, $ prefix, tabular numerals.
- **Inline cells (rate matrix):** click-to-edit, Excel-style; selected cell has 2px navy border.
- **Toggles:** iOS-style; on = navy, off = slate.

### 5.5 Cards

- 16px padding, 12px radius, 1px slate-100 border, no shadow (calm).
- Hover: subtle background tint, never a shadow lift.
- Status badge in top-right corner.

### 5.6 Tables (especially Rate Matrix)

- Sticky header row + first column when scrolled.
- Inline edit on cell click.
- Zebra striping (very subtle: `#fafaf7` / white alternating).
- Row hover: navy-tinted background.
- Sortable headers click to sort, with ▲/▼ indicator.

### 5.7 Status badges

- Pill shape, 11px text, 4px padding, semibold.
- Color-coded per state with both color *and* icon (for color-blind users).
- States: Draft (●○ gray), Submitted (◔ blue), Approved (◑ green), Active (● gold), Archived (○ slate). Document states use the same shape language.

### 5.8 File upload component

- Drag-and-drop zone with dashed 2px slate border.
- File picker fallback.
- Selected file: thumbnail (for images) or PDF icon, filename, size, remove button.
- Progress bar on upload.
- Clear success/error states.

---

## 6. Accessibility (WCAG 2.1 AA)

### 6.1 Targets

- **Color contrast:** all body text ≥4.5:1, large text ≥3:1, UI components ≥3:1. Tested against the palette above; navy-on-paper and slate-on-paper both pass.
- **Focus indicators:** 2px navy focus ring on every interactive element. Visible without color (also has a slight offset).
- **Keyboard navigation:** every interactive element reachable via Tab. Logical order. Modals trap focus until dismissed. Esc closes modals.
- **Screen reader:** semantic HTML (`<button>`, `<table>`, `<nav>`, etc.). ARIA labels on icon-only buttons. Status badges have screen-reader text describing state.
- **Skip links:** "Skip to main content" on every page.
- **Form errors:** associated with their input via `aria-describedby`; not relying on color alone.

### 6.2 Older users (retirement-age portal)

- **Minimum body size:** 18px on the portal (vs. 16px on admin).
- **Tap targets:** ≥44×44px on portal and patron site; 32×32px acceptable on admin dense screens.
- **High contrast option:** toggle in portal settings to enable extra-high contrast mode.
- **Plain language:** no system codes, no jargon. "Insurance certificate" not "COI" on slip-owner-facing copy (admin-facing still uses "COI" since Kathy is fluent).
- **Forgiving errors:** "We couldn't read that PDF. Try uploading it again, or email it to Kathy at kathy.vanecek@idealmgt.com." Always offer a human fallback.

### 6.3 Keyboard power users (Kathy)

- Global search: `/`
- Approve: `a` (in review queue)
- Reject: `r`
- Save: `cmd/ctrl+s`
- Cell navigation in rate matrix: Excel-style (Enter, Tab, arrows)
- Modal dismiss: Esc
- Help overlay: `?` shows all shortcuts

---

## 7. Responsive Behavior

| Screen | Desktop (≥1280) | Tablet (768–1279) | Mobile (<768) |
|---|---|---|---|
| **Admin dashboard** | Primary; sidebar + main | Sidebar collapses to icons | Hamburger; cards stack |
| **Scenario Modeler** | Primary; full split-pane | Side-by-side compressed | **Read-only summary** (edit on desktop only) |
| **Slip Map** | Primary; map + detail panel | Map full-width; detail = bottom sheet | Map zoomable; detail full-screen on tap |
| **Document Review Queue** | Primary; list + preview | Stack: list on top, preview below | List only; tap row → full-screen preview |
| **Holder portal** | Single-column scroll | Same | Primary; mobile-first |
| **Document upload** | Single-column | Same | Primary; mobile-first |
| **Transient request form** | Single column, centered | Same | Primary; mobile-first |
| **Patron site** | Hero + grid | Hero + 2-col grid | Hero + stacked cards |

**Critical:** Scenario Modeler is **explicitly desktop-only for editing**. On mobile/tablet it shows a read-only summary plus a "Edit on desktop" note. Linda will not model rates on her phone; pretending otherwise compromises the core UX.

---

## 8. Interactions & Micro-states

### 8.1 Optimistic UI

- **Slip assignment:** click-confirm → slip changes color immediately; if server fails, revert with toast "Couldn't save. Try again." Failures are rare and recovery is cheap.
- **Document approve/reject:** action takes effect immediately in UI; "Undo" toast for 5 seconds.
- **Scenario Modeler cell edit:** value commits to local state; right pane recalcs immediately; autosave to server is fire-and-forget with a "Saving…" → "Saved" pip.

### 8.2 Confirm-before-destructive

| Action | Confirmation pattern |
|---|---|
| Promote scenario to Active | Modal: explain consequence; require typing "APPROVED" |
| Override slip-fit | Inline expansion of override block; require justification ≥20 chars |
| Reject a document | Modal: require rejection reason ≥20 chars |
| Archive a holder | Modal: explain that history is preserved; require checkbox |
| Delete a vessel | Soft delete; show in trash for 30 days |
| Cancel a confirmed assignment | Modal: explain that holder will be notified; require reason |

### 8.3 Save-state indicators (Modeler)

- **Autosaving:** small pulsing dot in footer + "Saving…" text
- **Saved:** static checkmark + "Saved [time ago]"
- **Save failed:** red icon + "Couldn't save. [Retry]" — keep edits in browser local storage as fallback

### 8.4 Loading states

- **Use skeletons, not spinners** for content placeholders (lists, cards, tables).
- **Spinners** only for *actions* taking >500ms (button shows a spinner inline).
- **Empty states:** every empty list has an explanation + a primary action ("No documents yet. Upload your first one.").

### 8.5 Error messages

Template: **What happened · Why (if useful) · What to do**.

- ❌ "Could not assign Lulu to slip 47 — vessel beam (8'6") exceeds slip beam limit (8'0"). [Override with justification ▸] [Choose a different slip ▸]"
- ❌ "Upload failed — file is 38MB, max is 25MB. Try compressing the PDF, or email it to kathy.vanecek@idealmgt.com."
- ❌ "Couldn't sign you in — the magic link expired. [Send a new link ▸]"

### 8.6 Notifications

- **Inline (toasts):** success/info/warning/error, dismissible, auto-hide success after 5s, errors stay until dismissed.
- **Banner alerts:** persistent at top of page for important context ("This scenario is in Submitted state and cannot be edited.").
- **Email:** for actions that cross user boundaries (assignment confirmations, doc approvals, reminders).

---

## Open design questions (for Nick to validate)

1. **Linda meeting — Section 4.1 walk-through.** Show her the wireframe. The most load-bearing call is **live recalc vs. recalc-button**. I've recommended live (250ms debounce). If Linda strongly prefers an explicit "Recalculate" button (some Excel power users do — they like predictable, deterministic moments of recalculation), we flip that. **This is the single design call that, if wrong, undermines the "feel like Excel but smarter" promise.**
2. **Per-holder impact placement.** Inside the right pane (collapsed, expand on demand — current spec) vs. a separate "Impact" tab. Tabs are cleaner; inline is more discoverable.
3. **Compare mode UX.** Modal-then-inline-3-column (current spec) vs. dedicated side-by-side compare page. Modal is faster; dedicated page is more readable.
4. **State machine button labels.** "Submit for Approval" / "Mark Approved" / "Promote to Active" — verify against Linda's mental model. She may call these something else.
5. **Patron site hero.** One large photograph (current spec) vs. a slideshow vs. illustration. Photograph is warmer but harder to source; verify Wharfside has rights to a good marina photo.
6. **Document portal terminology for older users.** "COI" vs. "Insurance certificate". Current spec uses "Insurance certificate" on portal, "COI" on admin. Confirm with a slip-owner that this reads naturally.
7. **Slip Board default view.** Map (current spec) vs. roster grid. Kathy may actually default to the grid because she searches by name more than slip number — needs verification.

---

## Appendix — Sketch-to-build priority order

If/when this moves into prototype/build:

1. **Prototype the Scenario Modeler first** (Figma + clickable demo). Test with Linda in a 60-minute session. Iterate. This is the linchpin.
2. **Prototype the Slip Board** (Figma + clickable demo). Test with Kathy. The map vs. grid question is the call.
3. **Prototype the Document Center** (slip-owner portal). Test with 2-3 actual slip-owners, ideally on iPad. This is the adoption gate per Office Hours.
4. **Build the Patron site first** — lowest risk, highest immediate public value, no auth surface, can ship in days. Validates branding direction.
5. **Build the Scenario Modeler second** — guaranteed users (Nick + Linda), highest custom-build justification.
6. **Build Slip Board + Document Review third** — conditional on Kathy commitment per Office Hours Phase 0.
7. **Build slip-owner portal last** — conditional on slip-owner survey result per Office Hours Phase 0.

---

*End of UX Spec v0.1. Next deliverable: clickable Figma prototype of Section 4.1 (Scenario Modeler) for a Linda validation session.*
