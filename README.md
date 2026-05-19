# Wharfside Marina

Marina management application for Wharfside Manor Condominium Association.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database:** Neon Postgres + Drizzle ORM
- **Auth:** Auth.js v5 (magic link + TOTP for admins)
- **Email:** Resend
- **Storage:** Cloudflare R2
- **Hosting:** Vercel
- **Testing:** Vitest + Playwright

## Getting started

```bash
pnpm install
cp .env.example .env.local
# fill in env vars
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Documentation

- [PRD](./docs/requirements/draft-prd-v0.3.md)
- [Architecture](./docs/architecture/ARCHITECTURE.md)
- [UX](./docs/ux/UX-SPEC.md)
- [Dev Plan](./docs/planning/DEV-PLAN.md)
- [Backlog](./docs/planning/BACKLOG.md)
- [QA Strategy](./docs/qa/QA-STRATEGY.md)
- [Office Hours strategy](./docs/strategy/OFFICE-HOURS.md)

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Local dev server on http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Unit + integration tests (Vitest) |
| `pnpm test:e2e` | E2E tests (Playwright) |
| `pnpm db:generate` | Generate Drizzle migration from schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Drizzle Studio (web DB browser) |

## Project status

In active development. Target launch: **Spring 2027**. See [DEV-PLAN.md](./docs/planning/DEV-PLAN.md) for the current sprint and roadmap.
