# Wharfside Marina — Discovery Questions for Nick

**Project:** `wharfside-marina` (slip assignment + document collection + patron website)
**Status:** Pre-architecture discovery — **scope corrected 2026-05-19**
**Audience:** Nick DeMarco (developer, Wharfside Board Secretary)
**Format:** Async interview — Nick answers in writing, PRD then gets revised
**Date:** 2026-05-19 (v2 — refocused after scope clarification)

---

## Scope Lock — read FIRST

This system is **three things only**:

1. **Slip Assignment Management** — internal ops tool tracking which boat is in which slip, owner, vessel details, season/year, history.
2. **Document Collection** — portal where slip-owners and transients upload required docs (COI, registration, indemnification) with expiration tracking.
3. **Patron Website** — public/semi-public site with rules, contact, dockmaster, marina map, emergency procedures, FAQs, downloadable forms.

It is **NOT**:
- A billing/payments system — **AppFolio** owns billing, payments, financial accounting (Nick said "Folio" — confirmed in handbook this is AppFolio).
- A Dockwa-style reservation marketplace — slips are owned/leased annually by residents.
- A POS, fuel, or charter system.

Confirm or correct that framing before answering anything else.

---

## A. Slip Assignment

**Q-A1 — Slip count, layout, and classes.** Master Deed references **86 boat slips** on the Shrewsbury River. Is that still accurate post Marina Restoration? What length/beam classes exist (e.g., ≤25ft, 26–35ft, 36–45ft, >45ft)? Any covered slips, T-heads, or special-use (work-boat) slips?
> *Why:* Slip classes are the primary attribute on every assignment record. Wrong here → entire data model is wrong.

**Q-A2 — Assignment cadence.** Are slip assignments fixed annually (same owner = same slip every year) or rotated/reassigned each season? Is there ever mid-season reassignment?
> *Why:* Fixed assignment → near-static data, almost a directory. Rotation → assignment workflow each spring, waitlist logic, conflict resolution.

**Q-A3 — Fields tracked per assignment.** Confirm/expand this list: slip number, season/year, slip-holder name + contact, vessel name, LOA, beam, draft, USCG documentation # or state registration #, hull color/type, insurance carrier + policy # + expiry, mooring lines/cleats notes. Anything else (engine type, pump-out hose required, electrical needs)?
> *Why:* The dockmaster needs to know what's tied up at slip 47 without walking down to look. Locks the schema.

**Q-A4 — Transient slips.** Does Wharfside have transient slips? If yes, how many, and how are transients handled today — owner brings a guest boat? Day-trippers? Overnight visitors? Any precedent at all, or is this a clean "no transients" answer?
> *Why:* Per the handbook, "Boat slips are available for both residents and non-residents through the management office." That implies some transient or non-resident activity. We need to know if it's 2 boats/year or 200.

**Q-A5 — Waitlist.** Is there a slip waitlist? Who maintains it (Kathy/ECI? Board? Dockmaster)? How are slot openings communicated? Roughly how long is it?
> *Why:* If a waitlist exists, it's almost certainly in someone's head or a Word doc — moving it into the system is a clean MVP win.

**Q-A6 — Slip-holder vs. boat-user.** Can a slip-holder lend their slip to a friend for a weekend? Does that other boat need its own record in the system, or does it just ride under the slip-holder's record?
> *Why:* Determines whether the docs/assignment is keyed by slip-holder or by boat. Big schema decision.

**Q-A7 — Assignment history retention.** How many years of history do you want kept? Forever? 7 years for tax/insurance? Just current + previous?
> *Why:* Drives data retention, archive policy, and whether we need a separate "history" view in the admin UI.

---

## B. Document Collection

**Q-B1 — Exact required document list.** I'll guess: (1) Certificate of Insurance naming the Association as additional insured, (2) vessel state registration or USCG documentation, (3) signed indemnification/hold-harmless agreement. What else — captain's license, hurricane/storm plan, pump-out certification, mooring agreement, anything else?
> *Why:* Each doc type is a separate field, separate expiration, separate reminder cadence. Need the full list before designing the upload form.

**Q-B2 — Insurance specifics.** What coverage minimums does Wharfside require (liability limit, hull, pollution)? Does the cert need to name "Wharfside Manor Condominium Association" specifically as additionally insured? Does ECI/Ideal Management also need to be named?
> *Why:* Acceptance criteria. The system can flag docs that don't meet minimums if the values are explicit.

**Q-B3 — Renewal/expiration cadence.** Insurance typically annual. Registration is 1–3 years (state-dependent). Indemnification — one-time or annual re-sign? What's the renewal pattern for each doc type?
> *Why:* Drives the reminder engine. "Email at T-60, T-30, T-7" needs to know each doc's clock.

**Q-B4 — Reviewer and approval workflow.** When a slip-owner uploads a COI, who reviews and approves it — Kathy/ECI? Dockmaster? A board officer? Multi-stage (uploaded → reviewed → approved)?
> *Why:* Determines admin UI complexity. Single reviewer = simple queue. Multi-stage = workflow engine.

**Q-B5 — Document storage today.** Where do these docs live right now — emailed to Kathy, in AppFolio, paper in Kathy's file cabinet, a Google Drive folder, nowhere formal?
> *Why:* Sets migration scope and tells us what "before" looks like for the success story.

**Q-B6 — Docs for transients/guest boats.** If a slip-holder lets a friend use the slip for a weekend, does the friend's boat need its own COI on file, or does the slip-holder's policy cover them?
> *Why:* Compliance question that drives whether transients need their own user accounts or ride under the slip-holder.

**Q-B7 — Compliance enforcement.** What happens if a slip-owner's COI expires and they don't upload a new one? Boat removed? Slip privileges suspended? Warning only? Fine?
> *Why:* The system can enforce or just notify — depends on what the board has actually adopted as policy. References: "Amendment re Suspension of Privileges" exists in governing docs.

---

## C. Patron Website

**Q-C1 — Public vs. gated.** Is the patron site fully public (anyone can read the rules), gated behind a slip-owner login, or hybrid (rules public, owner-specific info gated)?
> *Why:* Hybrid is most common. Pure public is simplest. Pure gated is most secure but reduces transparency.

**Q-C2 — Required sections.** Confirm/expand: (1) Marina rules & regulations (from WMCA Handbook §Marina Area), (2) ECI/dockmaster contact, (3) emergency procedures (911 + after-hours 732-970-6886 per handbook), (4) marina map / slip layout, (5) downloadable forms (COI template, indemnification, registration), (6) FAQ, (7) seasonal info (opening date, winter haul-out). Anything missing — tide tables, weather, fuel, pump-out hours?
> *Why:* IA decision. Each section is a page. Need the list before wireframing.

**Q-C3 — Domain and branding.** Does Wharfside have a marina-specific domain (e.g., wharfsidemarina.com)? Or will it live under wharfsidemb.com? Does the branding follow Wharfside Manor (navy + gold per cowork SKILL) or is there a marina sub-brand?
> *Why:* Determines hosting setup, DNS, branding asset gathering.

**Q-C4 — Content owner.** Once the site is live, who owns content updates — the board, ECI, a dockmaster, Nick? If "Nick," that's the same bus-factor problem as the rest of the system.
> *Why:* If Kathy or a board officer needs to update content, the CMS UX has to match their skill level (probably zero CMS experience).

**Q-C5 — Existing site assets.** Is there a Wharfside website already that this would replace or complement? Any existing logo/photography/marina map drawings?
> *Why:* Avoid greenfield design work if there are existing assets.

---

## D. AppFolio Integration

**Q-D1 — What data does the new system need FROM AppFolio?** Likely candidates: (1) slip-owner contact info (name, phone, email, unit#), (2) paid-up status (is this slip-owner current on dues?), (3) ownership transfers (did slip change hands?). Anything else?
> *Why:* Defines the integration surface. If the answer is "nothing — the new system is read-only display of static slip-owner info," then there's no AppFolio integration at all.

**Q-D2 — AppFolio API access.** AppFolio does have an API (AppFolio Stack — partner program). Has ECI/Ideal Management offered API access? Are they an AppFolio Property Manager Plus customer (where Stack Premium is included)? Or would we need a partner certification process?
> *Why:* If API access is unavailable without going through their partner program, the integration becomes a multi-month bureaucratic project. Fallback options below.

**Q-D3 — Fallback integration.** If no live API: (a) manual CSV export from AppFolio loaded into the new system, (b) read-only — system owns its own slip-owner contact data, AppFolio is the truth for billing only, (c) no integration at all (slip-owner contact entered separately).
> *Why:* The MVP can ship without AppFolio integration. Picking the fallback up-front avoids architecture rework.

**Q-D4 — Ownership of marina dues in AppFolio.** Are marina slip fees billed as a separate line item in AppFolio, or are they folded into HOA dues? Are slip fees uniform or tiered by slip class?
> *Why:* Doesn't change scope (we don't bill) but affects the "is this slip-owner paid up" display logic if we want to show that.

---

## E. Users, Auth, and Roles

**Q-E1 — Role inventory.** Confirm roles: (1) **ECI admin** — Kathy + her team — full read/write on slips, docs, users; (2) **Board officer** — read-only review of compliance + assignment history; (3) **Dockmaster** — read/write on assignments, doc review; (4) **Slip-owner** — view own assignment, upload own docs, edit own contact info; (5) **Transient** (if Q-A4 says yes) — upload docs, view own assignment; (6) **Public visitor** — read patron website only.
> *Why:* Lock down the RBAC before building. Six is the cap — more roles = more bugs.

**Q-E2 — Slip-owner account provisioning.** How do slip-owners get accounts — ECI provisions them, self-signup with verification, or hybrid (ECI invites, owner sets password)?
> *Why:* Self-signup requires email verification + spam prevention. ECI-provisioned is the simplest secure model for a known community.

**Q-E3 — Auth mechanism.** Email/password OK? Magic-link (passwordless)? SSO with Google (since residents trend retirement-age, low password tolerance)? Any 2FA appetite?
> *Why:* Magic-link is friendliest for low-tech users. Password resets are the single biggest support burden for HOA systems.

**Q-E4 — Slip-owner ↔ AppFolio identity.** Should a slip-owner's marina account be the same identity as their AppFolio account (SSO), or completely separate?
> *Why:* SSO across systems is a real engineering project. Separate is the lazy answer and probably fine.

---

## F. Operations & Long-Term

**Q-F1 — Hosting and DevOps.** GCP Cloud Run (you have this stack from Cage Match/Batter Up)? A small VPS? Vercel + Supabase? What's the hosting line item you'd actually pay for this from association funds?
> *Why:* Drives architecture choice. Cloud Run + Cloud SQL + GCS is the cheap, low-touch option for low-traffic systems.

**Q-F2 — Bus factor.** If you step off the board or hand off Wharfside work, who runs this? Is anyone else on the board even capable of clicking around an admin UI, much less editing code? What's the exit / handoff plan?
> *Why:* #1 risk for any solo-built internal tool. If the honest answer is "no one," we need to either (a) keep scope tiny so handoff to ECI is realistic, or (b) reconsider build-vs-buy.

**Q-F3 — Data export / portability.** Slip data, owner contacts, document files — all exportable to CSV/zip with one click. Confirm this is a hard requirement.
> *Why:* Anti-lock-in insurance. Even if you build it, the board needs to be able to walk away from it.

**Q-F4 — Backup and disaster recovery.** What's acceptable RTO/RPO? Daily backup with 24-hour recovery is probably fine for slip data — confirm.
> *Why:* Drives infrastructure spend. Anything tighter than daily/24h roughly doubles cost.

**Q-F5 — Board approval gates.** What needs board sign-off — go-live? hosting budget? branding/domain? document retention policy? owner data handling? What can you authorize as Secretary vs. what needs a full board vote?
> *Why:* Every gate is a delay; knowing them up-front prevents surprises.

---

## G. Timeline & Success Criteria

**Q-G1 — Target launch.** Spring 2027 season opening (April–May 2027)? Earlier soft launch (e.g., 2026 season as a pilot with the dockmaster only)? Anchor date.
> *Why:* Drives the MVP cutline. 11 months from today is achievable for the 3-pillar scope; 5 months is not.

**Q-G2 — Success at 6 months post-launch.** What does "this clearly worked" look like — three observable things? (Examples: "100% of slip-owners have current COI on file in the system," "Kathy stopped emailing me slip-assignment questions," "the marina rules page got 200 unique pageviews.")
> *Why:* Pre-committed success criteria prevent goalpost-shifting.

**Q-G3 — Kill criteria.** What would make you shut this down or hand it to a vendor — ECI never adopts it? Less than 30% of slip-owners use the portal? More than X hours/month of your time?
> *Why:* Pre-committing to a kill condition is how solo builds avoid becoming permanent zombies.

**Q-G4 — ECI adoption — the make-or-break question.** Have you actually talked to Kathy/ECI about whether they'd USE this tool? Because if ECI is the operator (per your clarification) and they don't adopt it, this tool has no users on the admin side. What's their reaction been so far?
> *Why:* This is the question that decides the whole project. If ECI is enthusiastic, build it. If ECI is indifferent or hostile, build something else.

---

## Appendix — Facts already pulled from Wharfside context

These are already in `draft-prd-v0.md` — you don't need to restate, just correct if wrong:

- **86 boat slips** along the Shrewsbury River (Master Deed, page 30 — needs re-verification post-Restoration)
- Marina property **adjacent to** Condo Property, **owned by Grantor**, with **perpetual easement** for slip owners/lessees
- **Marina Restoration Project active** — DEP Land Use Approval secured; construction planning April 2026; Meeco Sullivan involved; engineering meetings with Falcon Engineering
- **Property management:** East Coast – Ideal Management (ECI), Kathy Vanecek (kathy.vanecek@idealmgt.com), 732-751-1991. After-hours: 732-970-6886.
- **Platform:** AppFolio Property Manager (used for owner accounts, payments, vendor insurance docs, work orders)
- **Board roster (2026):** Giuseppe Gencarelli (President), Mike Serhat (VP), Nick DeMarco (Secretary), Linda Masessa (Treasurer, CPA), Thomas Bopp, Roberta Attanasi, Anthony D'Anna, Timmy Mucaj, Gary Passenti
- **Marina rules excerpt** (WMCA Handbook 2025, §Marina Area):
  - "Boat slips are available for both residents and non-residents through the management office."
  - "Slips are for boat owners who rented them and their guests."
  - "Children are not permitted on the bulkhead walkway unless accompanied by an adult."
  - "Resident fishing and crabbing are permitted only from the bulkhead walkway unless posted otherwise."
  - "Bicycles, skateboards, and similar devices are not permitted on the bulkhead walkway or anywhere within the marina area."
- **Vendor COI requirement** (handbook): vendors must "provide a Certificate of Insurance, naming [the Association] as additionally insured."
- **Wharfside size:** ~150 condo units, Monmouth Beach, NJ
- **Insurance broker:** Baldwin Insurance, (732) 837-1029 (per handbook)
- **Marina loan structure** — Master Deed Sec 24(B), 1995 — referenced as load-bearing; verify before architecture decisions touching marina finances.
