# Infra provisioning — one-time setup

**Audience:** Nick, at your Mac.
**Goal:** Stand up every external service the app talks to (Neon, Resend, Cloudflare R2, Upstash, Vercel, Sentry, GitHub Actions), capture credentials into `.env.local`, mirror them into Vercel, and prove every connection works via `pnpm verify:infra`.

**Time budget:** ~90 minutes if you have accounts already; ~2 hours from scratch.

Most services are free at HOA scale. Estimated monthly cost summary in [§9](#9-cost-summary).

> Throughout this doc, every `[CAPTURE: VAR_NAME]` annotation means: copy this value into `.env.local` (and later into Vercel's env panel).

---

## 0. Prereqs

```bash
# At your Mac, in the repo root.
git checkout claude/plan-next-tasks-vN0dW
git pull
pnpm install

cp .env.example .env.local
```

You will fill in `.env.local` as you go through this doc.

---

## 1. Neon Postgres (5 min)

1. https://console.neon.tech → sign up / sign in.
2. **Create Project**:
   - Name: `wharfside-marina`
   - Region: `AWS us-east-1` (closest to Vercel default + your physical location)
   - Postgres version: 16 (default)
3. Once the project is created, you land on the dashboard. Top-right → **Connection string** → copy the `DATABASE_URL`.
   - **[CAPTURE: DATABASE_URL]** — pooled connection (port 6432), `?sslmode=require`. Vercel needs the pooled URL.
4. Create a development branch: left nav → **Branches** → **Create branch** → name `dev`, parent `main`. Copy its connection string.
   - **[CAPTURE: DATABASE_URL for `.env.local`]** ← use the `dev` branch URL locally.
   - Use the `main` branch URL in Vercel's production env.
5. Verify `btree_gist` is available (SPIKE-A):
   ```bash
   psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
   psql "$DATABASE_URL" -c "\dx" | grep btree_gist
   ```
   If this errors, your Neon plan doesn't include the extension — escalate before proceeding (it's required for the EXCLUDE constraint).

6. Run the initial migrations:
   ```bash
   pnpm db:generate                    # generates SQL from Drizzle schema
   pnpm db:migrate                     # applies the generated migration
   psql "$DATABASE_URL" -f drizzle/0001_exclude_constraint.sql
   ```

7. Optionally seed dev data:
   ```bash
   SEED_FORCE=true pnpm db:seed
   ```

---

## 2. Auth.js secret (1 min)

```bash
openssl rand -hex 32
```

- **[CAPTURE: AUTH_SECRET]** — paste into `.env.local`.
- Generate a **separate** secret for Vercel production. Never reuse local secrets in prod.

Local `AUTH_URL`: leave as `http://localhost:3000`. In Vercel set it to your production URL (e.g., `https://wharfsidemb.com`).

---

## 3. Resend (10 min)

1. https://resend.com → sign up.
2. **Domains** → **Add Domain** → `wharfsidemb.com` (or whichever domain will send mail).
3. Add the three DNS records Resend shows (SPF, DKIM, optional DMARC) at your DNS host. Wait for the dashboard to show "Verified" — usually 5–15 min.
4. **API Keys** → **Create API Key** → name `wharfside-marina-prod`, permission "Sending access" → bucket: domain you just verified.
   - **[CAPTURE: RESEND_API_KEY]**
5. Set:
   - `EMAIL_FROM="Wharfside Marina <no-reply@wharfsidemb.com>"`
   - `ECI_NOTIFICATION_EMAIL="kathy.vanecek@idealmgt.com"` (or leave unset — it defaults to that address)

> Until DNS is verified the API will accept sends but they'll bounce. The verification script in §8 sends a real email to *yourself* — do it after verification clears.

---

## 4. Cloudflare R2 (10 min)

1. https://dash.cloudflare.com → R2 → enable R2 (one-time, requires payment method on file — R2 free tier is generous, no card charge unless you exceed it).
2. **Create bucket**:
   - Name: `wharfside-marina-docs`
   - Location hint: `Eastern North America (ENAM)`
   - Default storage class: Standard
3. **[CAPTURE: R2_BUCKET_NAME]** = `wharfside-marina-docs`.
4. Bucket → **Settings** → copy **Account ID**.
   - **[CAPTURE: R2_ACCOUNT_ID]**
5. R2 → **Manage R2 API Tokens** → **Create token**:
   - Token name: `wharfside-marina`
   - Permissions: **Object Read & Write**
   - Bucket: `wharfside-marina-docs` only (don't grant on all buckets)
   - TTL: leave default (no expiry) for now; rotate annually per RUNBOOK §5.4.
6. After creation, R2 shows the Access Key ID and Secret **once**. Save both.
   - **[CAPTURE: R2_ACCESS_KEY_ID]**
   - **[CAPTURE: R2_SECRET_ACCESS_KEY]**
7. Leave `R2_PUBLIC_URL` empty — documents will use signed URLs only.

---

## 5. Upstash Redis (5 min)

Used today only by `/transient` form rate-limit (5/hour/IP). Will also back Auth.js verification-token caching in STORY-05.

1. https://console.upstash.com → Sign in (GitHub login works).
2. **Create Database**:
   - Name: `wharfside-marina`
   - Type: **Regional** (Global is overkill for HOA scale)
   - Region: `us-east-1`
   - TLS: enabled (default)
   - Eviction: enabled (default)
3. On the new DB's overview page, scroll to **REST API** section. Copy both values:
   - **[CAPTURE: UPSTASH_REDIS_REST_URL]**
   - **[CAPTURE: UPSTASH_REDIS_REST_TOKEN]**

Free tier is 10K commands/day — easily enough for marina-scale traffic.

---

## 6. Sentry (optional, 5 min)

Skip for MVP if you want. Free tier is fine for HOA volume.

1. https://sentry.io → create org / project → platform **Next.js** → project name `wharfside-marina`.
2. Sentry shows a DSN.
   - **[CAPTURE: SENTRY_DSN]**

> The scaffold has `@sentry/nextjs` in deps but does not yet have a `sentry.client.config.ts` / `sentry.server.config.ts` — those wire-up files come in a future story.

---

## 7. Vercel (10 min, plus first deploy)

1. https://vercel.com → sign in with GitHub → **Add New** → **Project** → import `nickdnj/wharfside-marina`.
2. **Framework Preset:** Next.js (auto-detected). **Build command** and **Output directory** stay default.
3. **Environment Variables** — paste every `[CAPTURE:]` value from above into the **Production** tab. Mirror the same set into **Preview**, swapping:
   - `DATABASE_URL` → use the Neon `dev` branch (or `staging` if you create one).
   - `NEXT_PUBLIC_SITE_URL` → leave unset for previews (Vercel preview URLs change per PR).
   - `AUTH_URL` → unset for previews; Auth.js will use the request host.
4. **Deploy**.
5. After the first deploy, **Domains** → add `wharfsidemb.com` (and `www.wharfsidemb.com`). Vercel walks you through DNS at your registrar.
6. Re-deploy after DNS is live so `NEXT_PUBLIC_SITE_URL` works on production.

**Linking the CLI locally** (optional, but useful for pulling envs):

```bash
pnpm add -g vercel
vercel link              # follow prompts; picks your team + project
vercel env pull .env.local   # pulls current Vercel env vars into your local file
```

---

## 8. GitHub Actions secrets (5 min)

The `.github/workflows/ci.yml` runs lint/typecheck/test/build on every PR. It currently doesn't need DB access, but as tests grow it will.

If/when CI needs creds, add them at https://github.com/nickdnj/wharfside-marina/settings/secrets/actions:

- `DATABASE_URL` — point at a Neon `ci` branch (free), reset before every run
- `RESEND_API_KEY` — production key is fine; the CI tests should not send mail (use a fake `EMAIL_FROM` to fail-loud if they do)

Not required to do today.

---

## 9. Cost summary

| Service | Tier | Cost at HOA scale |
|---|---|---|
| Neon | Launch ($19/mo) or Free ($0) | $0–19/mo |
| Resend | Free (3K emails/mo) | $0/mo (HOA volume) |
| Cloudflare R2 | Pay-as-you-go (10 GB free) | $0–5/mo |
| Upstash Redis | Free (10K cmd/day) | $0/mo |
| Vercel | Hobby ($0) or Pro ($20/mo) | $0–20/mo |
| Sentry | Developer (free, 5K events/mo) | $0/mo |
| **Total** | | **$0–44/mo** |

Free tiers cover well below the marina's traffic ceiling. Paid tiers buy SLAs + log retention + previews-on-team — upgrade only as needed.

---

## 10. Verify everything end-to-end

Once `.env.local` is fully populated:

```bash
pnpm verify:infra
```

This runs `scripts/verify-infra.mjs`, which:
- Pings the database (`SELECT 1`) and checks `btree_gist` is available.
- Pings Upstash (`PING`).
- Probes R2 (`HEAD bucket`).
- Validates the Resend API key (does **not** send mail unless you pass `--send-test-mail user@example.com`).
- Verifies all NEXT_PUBLIC_* + AUTH_* variables are non-empty.

Exit code 0 = all green; non-zero = output tells you which service failed and why.

---

## 11. Open decisions captured here

Things you'll likely answer while provisioning — note them in your decisions log:

- **Neon plan**: stay Free until traffic warrants Launch? — Recommend: **Free** through MVP.
- **Resend sending domain**: `wharfsidemb.com` vs `wharfside-marina.com`? — Whichever you'll actually own DNS for.
- **R2 public access**: documents are slip-holder private → keep all-private + signed URLs. (Default.)
- **Vercel team**: personal vs. WMCA-shared org? — Personal is fine for solo dev; create a WMCA org later if you want billing under the association.
- **Sentry**: skip for MVP, add post-launch? — Recommend: **add now**, even if just to catch the first 5xx in anger.

---

End.
