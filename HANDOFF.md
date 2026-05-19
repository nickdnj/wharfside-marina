# HANDOFF — Wharfside Marina Sprint 1 Replay

**Created:** 2026-05-19 (in cloud sandbox session)
**For:** Nick, when you sit down at your Mac
**Goal:** Get this scaffold onto GitHub and into your local dev environment, then continue Sprint 1.

---

## Context

This sandbox container created a complete Sprint 1 foundation but **cannot push to GitHub** because my GitHub MCP tools were locked to `nickdnj/agentarchitect`. You chose the handoff-doc path: replay everything at your Mac.

**What's already done** (committed in this local sandbox git, commit `f3f1db0`):

- ✅ STORY-01 — Next.js 14 + TypeScript + Tailwind scaffold
- ✅ STORY-02 — Drizzle config + DB client
- ✅ STORY-03 — Full 12-table schema in `src/db/schema.ts`
- ✅ STORY-04 — EXCLUDE constraint migration in `drizzle/0001_exclude_constraint.sql`
- ✅ STORY-08 — GitHub Actions CI workflow
- ✅ Issue-seeding script: `scripts/seed-github-issues.mjs` (verified parses all 60 stories correctly)
- ✅ All design docs (`docs/`): PRD v0.3, Architecture, UX, Dev Plan, Backlog, QA Strategy, Office Hours

**What's NOT done yet** (Sprint 1 remaining work for you at your Mac):

- ⏳ SPIKE-A — verify `btree_gist` extension works on your Neon plan
- ⏳ SPIKE-B — Auth.js v5 TOTP + magic-link config (known fiddly)
- ⏳ STORY-05 — Auth.js implementation
- ⏳ STORY-06 — Cloudflare R2 bucket + signed-URL helpers
- ⏳ STORY-07 — Resend email setup
- ⏳ STORY-09 — Vercel deploy

---

## Replay steps at your Mac

### Step 1 — Recreate the workspace locally

**Option A:** If you have access to this sandbox session before it's reclaimed, copy the `wharfside-marina/` folder out via whatever sync mechanism Claude Code on the web exposes (download, sync, etc.).

**Option B:** Recreate by following the file manifest at the bottom of this doc. Every file's purpose is listed; you can either re-derive them from the docs or, if you reopen this session, copy them directly.

### Step 2 — Create the GitHub repo

You can do this from your iPhone right now if you want:

```
Open GitHub app → "+" → New repository
Owner: nickdnj
Name: wharfside-marina
Visibility: Private
Initialize: NO (no README, no .gitignore, no license — we already have those)
```

Or from your Mac:

```bash
gh repo create nickdnj/wharfside-marina --private --description "Wharfside Manor marina management app"
```

### Step 3 — Push the scaffold

```bash
cd ~/Workspaces/wharfside-marina   # or wherever you put it

# If you didn't already have git:
git init
git add -A
git commit -m "Initial scaffold: design docs + Sprint 1 foundation"

# Wire up remote and push
git branch -M main
git remote add origin git@github.com:nickdnj/wharfside-marina.git
git push -u origin main
```

### Step 4 — Install dependencies

```bash
# pnpm is in the package.json — install if needed
corepack enable
corepack prepare pnpm@9.5.0 --activate

pnpm install
```

### Step 5 — Set up Neon (STORY-02 finish line)

1. Go to https://console.neon.tech
2. Create new project: `wharfside-marina`
3. Note the production connection string
4. Create a `dev` branch from the Neon dashboard
5. Note the dev connection string
6. **Verify `btree_gist` is available on your Neon plan** (this is SPIKE-A — see Step 7 below)

```bash
cp .env.example .env.local
# Edit .env.local — paste your Neon dev DATABASE_URL
```

### Step 6 — Run the first migration

```bash
# Generate the migration from schema.ts
pnpm db:generate

# Apply Drizzle's generated migration
pnpm db:migrate

# Apply the manual EXCLUDE constraint migration
psql "$DATABASE_URL" -f drizzle/0001_exclude_constraint.sql
```

### Step 7 — Run SPIKE-A (verify btree_gist on Neon)

This is the single highest-priority spike. Test that the EXCLUDE constraint actually works:

```bash
psql "$DATABASE_URL" <<'SQL'
-- Try to insert two overlapping assignments on the same slip
INSERT INTO marina_config (name, effective_date, is_active) VALUES ('Test', '2026-01-01', true);
INSERT INTO slip (config_id, slip_number, position_polygon, loa_limit_ft, beam_limit_ft, min_depth_at_mlw_ft, slip_type, tier)
  VALUES (1, 'T1', '[]'::jsonb, 40, 14, 6, 'open', 'Standard');
INSERT INTO assignment (slip_id, lease_type, start_date, end_date, season_year, status)
  VALUES (1, 'FULL_SEASON', '2027-04-15', '2027-10-31', 2027, 'confirmed');
-- This second insert MUST fail with constraint violation:
INSERT INTO assignment (slip_id, lease_type, start_date, end_date, season_year, status)
  VALUES (1, 'TRANSIENT', '2027-06-01', '2027-06-03', 2027, 'confirmed');
SQL
```

Expected result: second INSERT errors with `conflicting key value violates exclusion constraint "no_slip_overlap"`. If that doesn't happen, the spike failed and you need to investigate Neon's `btree_gist` extension support.

Clean up the test data after:

```bash
psql "$DATABASE_URL" -c "TRUNCATE assignment, slip, marina_config RESTART IDENTITY CASCADE;"
```

### Step 8 — Seed 60 GitHub issues from BACKLOG.md

```bash
# Auth gh CLI if you haven't
gh auth login

# Preview first
node scripts/seed-github-issues.mjs --dry-run

# Live run (creates 60 issues + 8 labels — do this once only)
node scripts/seed-github-issues.mjs
```

### Step 9 — Verify dev server runs

```bash
pnpm dev
# open http://localhost:3000 — should see the navy "Wharfside Marina" landing page
```

### Step 10 — Push the linked commit

You're done with Sprint 1 foundation (Phase 0 first 5 stories). The next stories in Sprint 1 / Phase 0:

1. **SPIKE-B** — Auth.js v5 TOTP + magic-link combined config (3 hrs)
2. **STORY-05** — Auth.js implementation (8 hrs)
3. **STORY-06** — Cloudflare R2 bucket + signed-URL helpers (3 hrs)
4. **STORY-07** — Resend email (2 hrs)
5. **STORY-09** — Vercel deploy + env wiring (2 hrs)

After those, Phase 0 is done. Then start EPIC-1A (patron site) per the Option B phasing decision.

---

## Open decisions before EPIC-1B (Pricing Modeler) starts

Per the dev plan, these need answers before you can start the Modeler (around July 2026 at 7.5 hr/wk pace):

1. **Phasing A vs. B** — 15-min call with Linda: "If I deliver a working Modeler in October 2026 with mock holder data (real names from April 2027), would you use it for FY27 rate-card discussions?" → Yes = Option B, No = Option A.
2. **TOTP for ECI admin logins** — Kathy's reaction to required TOTP. Default: yes.
3. **Half-season amenity fee proration rule** — PRD §3.6.1 `[VERIFY]`. Affects pricing engine fixtures.

---

## File manifest

Everything in this scaffold:

```
wharfside-marina/
├── .env.example                  — env var template
├── .eslintrc.json                — ESLint extending next/core-web-vitals
├── .gitignore                    — Next.js + Drizzle standard
├── .prettierrc.json              — Prettier config with tailwind plugin
├── HANDOFF.md                    — this file
├── README.md                     — project readme
├── package.json                  — pnpm 9.5.0, Next.js 14.2.5, React 18.3.1, Drizzle 0.32, Auth.js v5 beta
├── tsconfig.json                 — strict TS, @/* alias to src/*
├── next.config.mjs               — strict mode, typed routes
├── postcss.config.mjs            — tailwind + autoprefixer
├── tailwind.config.ts            — navy #1a3a5c + gold #c9a227 palette
├── drizzle.config.ts             — drizzle-kit config
├── drizzle/
│   └── 0001_exclude_constraint.sql   — EXCLUDE USING gist constraint (STORY-04)
├── src/
│   ├── app/
│   │   ├── layout.tsx                — root layout with brand bg
│   │   ├── page.tsx                  — placeholder landing page
│   │   └── globals.css               — tailwind directives
│   └── db/
│       ├── index.ts                  — postgres-js client + drizzle wrapper
│       └── schema.ts                 — 12 tables: app_user, auth_session, marina_config, slip, holder, vessel, transient_request, assignment, document, fee_schedule, scenario, audit_log
├── scripts/
│   ├── README.md                     — how to run the seed script
│   └── seed-github-issues.mjs        — parses BACKLOG.md → creates 60 issues + 8 labels
├── .github/
│   └── workflows/
│       └── ci.yml                    — pnpm install / lint / typecheck / format / test / build
└── docs/
    ├── architecture/ARCHITECTURE.md
    ├── planning/BACKLOG.md           — 60 issue-ready stories
    ├── planning/DEV-PLAN.md          — 466-line dev plan with calendar
    ├── qa/QA-STRATEGY.md
    ├── requirements/draft-prd-v0.3.md
    ├── strategy/OFFICE-HOURS.md
    └── ux/UX-SPEC.md
```

---

## Notes on what I did and didn't decide

**Decisions I made (sensible defaults — reverse if wrong):**

- pnpm as package manager (architecture didn't specify; pnpm is fast and disk-efficient for solo work)
- Auth.js **v5 beta** (v4 is older but stable; v5 is where active development is — but it's beta, so SPIKE-B will pay back)
- postgres-js as the Postgres driver (works well with Neon + Drizzle; alternative is `@neondatabase/serverless`)
- `bigint` mode for BIGSERIAL columns (matches schema; means you handle bigints as JS bigints, not strings)
- App Router (per architecture §3.1) — not Pages Router
- Strict TypeScript (per QA strategy)

**Things you'll want to decide:**

- TOTP library (e.g., `otplib`) for SPIKE-B
- PDF generation library for fee-schedule export (architecture mentioned `react-pdf` vs `pdfkit` vs `puppeteer`)
- SVG slip map polygon editor library (architecture flagged this as a research item for EPIC-2A)
- Whether to migrate Auth.js v5 beta → stable when it releases

**What I didn't touch:**

- No actual page content beyond a placeholder landing
- No auth implementation
- No tests yet (QA strategy guides this — start with pricing engine unit tests when EPIC-1B begins)
- No Vercel project linked
- No Neon project provisioned

---

End of handoff.
