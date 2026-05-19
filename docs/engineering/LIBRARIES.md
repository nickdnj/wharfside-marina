# Wharfside Marina — Library Decisions (v1.0)

**Author:** Independent engineering review
**Date:** 2026-05-19
**Purpose:** Resolve every remaining library question with a concrete pick, alternatives considered, and a minimal usage example. Solo-dev / Wharfside-scale optimized — picks favor "boring, well-documented, will be maintained in 2030" over "shiny."

---

## 1. PDF Generation — `@react-pdf/renderer`

**Pick:** `@react-pdf/renderer`

**Alternatives considered:**
- `puppeteer` / `playwright`: HTML-to-PDF. Heavyweight, slow cold-start on Vercel, 300MB+ deployment artifact. Overkill.
- `pdfkit`: programmatic drawing API. Powerful, but writing branded layouts in imperative drawing calls is tedious. Loses React mental model.
- Hosted (Browserless, DocRaptor): adds external dependency + $20+/mo. Unnecessary for this volume.

**Why right for solo-dev + Wharfside:**
- React components → PDF means the same component patterns used in the modeler UI can produce the export. No layout mismatch between screen and PDF.
- Pure JS, runs on Vercel Functions in <1s for the fee-schedule export.
- Wharfside-branded fee schedules + board reports are the only PDFs needed; both are tabular and well-suited to react-pdf's `<View>` / `<Text>` model.
- Active maintenance, ~6K GitHub stars, used by Notion, GitLab.

**Install:**
```bash
pnpm add @react-pdf/renderer
```

**Minimal usage:**
```tsx
// src/lib/pdf/fee-schedule.tsx
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11 },
  title: { fontSize: 18, marginBottom: 16, fontWeight: 'bold' },
  row: { flexDirection: 'row', borderBottom: '1pt solid #ccc', padding: 6 },
});

export function FeeSchedulePdf({ schedule }: { schedule: FeeSchedule }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Wharfside Marina — {schedule.name}</Text>
        {schedule.lineItems.map((li) => (
          <View key={li.id} style={styles.row}>
            <Text>{li.tier} — {li.holderType}: ${li.amount}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

// In a route handler:
// const buffer = await renderToBuffer(<FeeSchedulePdf schedule={s} />);
// return new Response(buffer, { headers: { 'Content-Type': 'application/pdf' }});
```

---

## 2. SVG Slip-Map Polygon Editor — `react-konva` + hand-built editor UI

**Pick:** `react-konva` for the canvas (editor) + plain SVG for the read-only public render.

**Alternatives considered:**
- `fabric.js`: mature, but imperative API and a heavier learning curve. Editor for ~86 polygons is overkill.
- `svg-edit`: full-app fork, not a library — wrong shape.
- `polygons` (npm): geometry math only, no rendering or interaction.
- Pure SVG + custom drag handlers: doable but you'll reinvent snap-to-grid, multi-point editing, undo. ~15–20 hrs vs. ~6–8 hrs with Konva.
- Leaflet w/ image overlay: rejected by architecture (correctly) — geographic projection is unnecessary.

**Why right for solo-dev + Wharfside:**
- Konva is React-native, good performance for 86 polygons + dragging, and you stay in React mental model.
- The **read-only public render** uses plain SVG (no Konva needed) — keeps the patron-site bundle tiny.
- One library does double duty: the editor (admin) and the click-to-detail map (admin map). Public uses plain SVG.
- Snap-to-grid + drag points are ~20 LOC each on top of Konva primitives.

**Install:**
```bash
pnpm add react-konva konva
```

**Minimal usage (editor):**
```tsx
// src/components/admin/SlipMapEditor.tsx
'use client';
import { Stage, Layer, Image as KImage, Line, Circle } from 'react-konva';
import useImage from 'use-image';

export function SlipMapEditor({ bgUrl, slips, onSlipChange }: Props) {
  const [bg] = useImage(bgUrl);
  const snap = (v: number) => Math.round(v / 10) * 10; // 10px grid snap

  return (
    <Stage width={1200} height={800}>
      <Layer>
        <KImage image={bg} />
        {slips.map((s) => (
          <Line
            key={s.id}
            points={s.polygon.flatMap((p) => [p.x, p.y])}
            closed
            fill="rgba(26,58,92,0.3)"
            stroke="#1a3a5c"
            strokeWidth={2}
            draggable
          />
        ))}
        {/* drag handles per point */}
        {slips.flatMap((s) =>
          s.polygon.map((p, i) => (
            <Circle
              key={`${s.id}-${i}`}
              x={p.x} y={p.y} radius={6} fill="#c9a227"
              draggable
              onDragEnd={(e) =>
                onSlipChange(s.id, i, { x: snap(e.target.x()), y: snap(e.target.y()) })
              }
            />
          )),
        )}
      </Layer>
    </Stage>
  );
}
```

**Public read-only render** (no Konva, server-rendered):
```tsx
// src/components/public/SlipMap.tsx
export function SlipMap({ bgUrl, slips }: Props) {
  return (
    <svg viewBox="0 0 1200 800" className="w-full h-auto">
      <image href={bgUrl} width={1200} height={800} />
      {slips.map((s) => (
        <polygon
          key={s.id}
          points={s.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="rgba(26,58,92,0.3)"
          stroke="#1a3a5c"
          className="hover:fill-amber-200 cursor-pointer"
        />
      ))}
    </svg>
  );
}
```

---

## 3. TOTP — `otplib` + `qrcode`

**Pick:** `otplib` (for TOTP) + `qrcode` (for QR generation).

**Alternatives considered:**
- `speakeasy`: was the default; **unmaintained since 2017**. Disqualifying.
- Auth.js built-in: v5 does not ship a first-class TOTP provider. There's a community Credentials adapter pattern but it's DIY.
- `@simplewebauthn/server`: WebAuthn (hardware keys / passkeys). Stronger than TOTP but UX for retirement-age admins is rough; defer to a possible v2.

**Why right for solo-dev + Wharfside:**
- `otplib` is actively maintained, ~2K stars, used everywhere, supports backup codes via straightforward secret generation.
- `qrcode` is the boring default for generating the auth-app QR.
- Total TOTP enrollment flow = ~80 LOC.

**Install:**
```bash
pnpm add otplib qrcode
pnpm add -D @types/qrcode
```

**Minimal usage:**
```ts
// src/lib/auth/totp.ts
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { encrypt, decrypt } from './crypto'; // your AES-GCM wrapper

authenticator.options = { window: 1 }; // accept previous/next 30s

export async function enroll(userEmail: string) {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(userEmail, 'Wharfside Marina', secret);
  const qrDataUrl = await qrcode.toDataURL(otpauth);
  return { secretCiphertext: encrypt(secret), qrDataUrl };
}

export function verify(token: string, secretCiphertext: string) {
  const secret = decrypt(secretCiphertext);
  return authenticator.verify({ token, secret });
}

// Backup codes:
import crypto from 'node:crypto';
export function generateBackupCodes(n = 8): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: n }, () => crypto.randomBytes(4).toString('hex'));
  const hashed = plain.map((c) => crypto.createHash('sha256').update(c).digest('hex'));
  return { plain, hashed };
}
```

Store `secretCiphertext` in `app_user.totp_secret` (the schema column). Show `plain` backup codes to the user **once** on enrollment; store only `hashed` in a `totp_backup_codes` table.

---

## 4. Email Templates — `react-email` + Resend

**Pick:** `react-email` (the Resend-affiliated React framework for email).

**Alternatives considered:**
- Raw HTML strings: works, but cross-client rendering is hell. You will fight Outlook for an afternoon and lose.
- MJML: solid, but it's a separate templating language and a separate compile step.
- Resend's built-in helpers: Resend's `react` integration *is* react-email under the hood; no benefit to going lower-level.

**Why right for solo-dev + Wharfside:**
- React components for email = same mental model as the app.
- `react-email preview` ships a local dev server for previewing templates.
- Tight integration with Resend (`@react-email/render` + `resend.emails.send`).
- The 5–8 transactional emails Wharfside needs (magic link, doc reminder × 4 cadences, transient approval, doc rejection, holder invite) are tabular/short — react-email's primitives cover them.

**Install:**
```bash
pnpm add resend
pnpm add @react-email/components @react-email/render
pnpm add -D react-email
```

**Minimal usage:**
```tsx
// src/emails/DocReminder.tsx
import { Html, Head, Body, Container, Heading, Text, Button, Section } from '@react-email/components';

export function DocReminder({ holderName, docType, daysUntilExpiry, portalUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Arial, sans-serif', background: '#f5f5f5' }}>
        <Container style={{ background: '#fff', padding: 24, maxWidth: 600 }}>
          <Heading>Wharfside Marina — Document Reminder</Heading>
          <Text>Hi {holderName},</Text>
          <Text>Your {docType} expires in {daysUntilExpiry} days.</Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={portalUrl} style={{ background: '#1a3a5c', color: '#fff', padding: '12px 24px' }}>
              Upload renewal
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Sending:
// import { Resend } from 'resend';
// const resend = new Resend(process.env.RESEND_API_KEY);
// await resend.emails.send({
//   from: 'Wharfside Marina <noreply@wharfsidemarina.com>',
//   to: holder.email,
//   subject: `Your ${docType} expires in ${daysUntilExpiry} days`,
//   react: <DocReminder {...props} />,
// });
```

Add a `pnpm email:dev` script that runs `email dev` for local preview.

---

## 5. CSV Generation — `csv-stringify`

**Pick:** `csv-stringify` (from `csv` package family).

**Alternatives considered:**
- `papaparse`: phenomenal for parsing, overkill for generation. Bundle weight.
- Hand-rolled: `rows.map(r => r.join(',')).join('\n')` works until a holder name contains a comma or a quote. Then it doesn't.

**Why right for solo-dev + Wharfside:**
- The AppFolio export is the only CSV. Handles quoting, escaping, embedded newlines, BOM (if AppFolio wants it).
- Streaming API for the eventual 86-row exports keeps memory flat.
- ~12 years old, boring, will keep working.

**Install:**
```bash
pnpm add csv-stringify
```

**Minimal usage:**
```ts
// src/lib/appfolio/export.ts
import { stringify } from 'csv-stringify/sync';

export function buildAppFolioCsv(lineItems: AppFolioLineItem[]): string {
  return stringify(lineItems, {
    header: true,
    columns: ['holder_id', 'unit_code', 'slip_number', 'season_year', 'charge_type', 'charge_date', 'amount', 'description'],
    cast: { date: (v) => v.toISOString().slice(0, 10) },
  });
}

// Route handler:
// return new Response(buildAppFolioCsv(items), {
//   headers: {
//     'Content-Type': 'text/csv; charset=utf-8',
//     'Content-Disposition': `attachment; filename="appfolio-${year}.csv"`,
//   },
// });
```

---

## 6. Date Library — `date-fns`

**Pick:** `date-fns` v3.

**Alternatives considered:**
- `dayjs`: smaller, plugin-based, has timezone via plugin. Slightly worse tree-shaking than date-fns v3.
- `Temporal` (TC39): the right long-term answer, but still stage-3 and polyfill-only in 2026. Not yet.
- Native `Date`: workable for date-only logic (season math is dates, not timestamps), but verbose and bug-prone (off-by-one on `getMonth()` etc.).

**Why right for solo-dev + Wharfside:**
- Season-date math (start, end, half-split, day-by-day for transient) is exactly what date-fns excels at: `addDays`, `differenceInDays`, `isWithinInterval`, `eachDayOfInterval`, `format`.
- v3 is ESM + tree-shakable: only the functions you import end up in the bundle.
- Single-region (NJ / America/New_York), single-language (en-US) — no i18n complexity, no timezone hell. Use UTC for storage (`date` columns in Postgres are already date-only), display in local time at the edge.

**Install:**
```bash
pnpm add date-fns
```

**Minimal usage:**
```ts
// src/lib/season/dates.ts
import { differenceInCalendarDays, eachDayOfInterval, format, parseISO, isWithinInterval } from 'date-fns';

export function transientNights(startIso: string, endIso: string): number {
  return differenceInCalendarDays(parseISO(endIso), parseISO(startIso)) + 1;
}

export function isInSeason(date: string, season: { start: string; end: string }): boolean {
  return isWithinInterval(parseISO(date), {
    start: parseISO(season.start),
    end: parseISO(season.end),
  });
}

export const formatDate = (iso: string) => format(parseISO(iso), 'MMM d, yyyy');
```

For timezone-aware operations (rare here), add `date-fns-tz` as needed.

---

## 7. Form Library — Server Actions + `react-hook-form` for complex forms only

**Pick:** Native Server Actions + `useActionState` for simple forms (most of Wharfside); `react-hook-form` + `@hookform/resolvers/zod` for the **modeler rate-matrix** and the **assignment-create** flow specifically.

**Alternatives considered:**
- All-server-actions: works for everything but loses live validation UX for complex forms.
- `formik`: aging; community has largely moved on to react-hook-form.
- TanStack Form: newer, smaller community, less ecosystem.

**Why right for solo-dev + Wharfside:**
- Most Wharfside forms are 3–8 fields (holder edit, doc upload metadata, scenario name) — Server Actions + `useActionState` is the natively-supported, lowest-dependency path.
- The **rate matrix** (modeler) has live recalc on every keystroke, debounced, with field-level validation — react-hook-form was built for this.
- The **assignment-create form** has dependent fields (slip → loa_limit → vessel filter) and conditional submit logic (override flow) — react-hook-form's `watch()` + conditional UI is cleaner than server actions for this.
- Auth.js v5 expects you to use Server Actions for auth flows — don't fight that.

**Install:**
```bash
pnpm add react-hook-form @hookform/resolvers
# (zod is already installed)
```

**Minimal usage (Server Action path — most forms):**
```tsx
// src/app/admin/holders/[id]/edit/page.tsx
import { useActionState } from 'react';
import { updateHolderContact } from './actions';

export default function HolderEdit({ holder }: Props) {
  const [state, action] = useActionState(updateHolderContact, { ok: undefined });
  return (
    <form action={action}>
      <input name="email" defaultValue={holder.email} />
      <input name="phone" defaultValue={holder.phone} />
      <button type="submit">Save</button>
      {state.ok === false && <p className="text-red-600">{state.error}</p>}
    </form>
  );
}

// actions.ts:
'use server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
const Schema = z.object({ email: z.string().email(), phone: z.string().optional() }).strict();
export async function updateHolderContact(prev: State, formData: FormData) {
  const session = await requireRole(['holder', 'eci_admin', 'super_admin']);
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  // ... db update
  return { ok: true };
}
```

**Minimal usage (react-hook-form path — rate matrix):**
```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FeeScheduleSchema } from '@/lib/pricing/schema';

export function RateMatrixEditor({ initial }: Props) {
  const { register, watch, handleSubmit } = useForm({
    defaultValues: initial,
    resolver: zodResolver(FeeScheduleSchema),
  });
  const live = watch(); // recompute projection from these values
  return (
    <form onSubmit={handleSubmit(async (data) => { /* server action */ })}>
      <input {...register('base_rates_by_tier.Premium.annual', { valueAsNumber: true })} />
      {/* ... */}
    </form>
  );
}
```

---

## 8. Toast — `sonner`

**Pick:** `sonner`.

**Alternatives considered:**
- `react-hot-toast`: equivalent, slightly older, maintenance has slowed.
- `radix-ui/Toast`: lower-level primitives. More LOC for the same outcome.

**Why right for solo-dev + Wharfside:**
- Sonner is the default in shadcn/ui (and what most modern Next apps use in 2026).
- One-line install, one-line setup, sensible defaults.
- Built-in promise-based variant: `toast.promise(saveScenario(), { loading: 'Saving…', success: 'Saved', error: 'Failed' })` — exactly what the modeler autosave UX wants.

**Install:**
```bash
pnpm add sonner
```

**Minimal usage:**
```tsx
// src/app/layout.tsx
import { Toaster } from 'sonner';
export default function RootLayout({ children }: Props) {
  return (
    <html><body>
      {children}
      <Toaster position="top-right" richColors />
    </body></html>
  );
}

// In a component:
import { toast } from 'sonner';
toast.success('Scenario saved');
toast.error('Slip-fit failed: vessel LOA exceeds slip limit');
toast.promise(saveScenario(payload), {
  loading: 'Saving…', success: 'Scenario saved', error: 'Save failed — please retry',
});
```

---

## 9. Headless UI Primitives — `shadcn/ui` (which wraps Radix)

**Pick:** `shadcn/ui` (copy-paste components built on Radix primitives + Tailwind).

**Alternatives considered:**
- Radix UI directly: same primitives, but you write the styling layer yourself. Slower.
- Headless UI (Tailwind Labs): smaller scope, missing several primitives (combobox is workable but no command-menu, no tabs of equivalent quality).
- Build from scratch: a year of work.

**Why right for solo-dev + Wharfside:**
- `shadcn/ui` is not a dependency — it's a code generator that drops Tailwind+Radix components into `components/ui/`. You own the code, no version-bump anxiety.
- Components match Tailwind 3.4 (Wharfside's pin) exactly.
- Accessible by default (Radix passes WCAG 2.1 AA — the patron site's accessibility requirement).
- Composable: data tables, dialogs, command menus, toasts, dropdowns, tabs all available without architectural debate.

**Install:**
```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button dialog table dropdown-menu form input label select tabs toast
```

**Minimal usage:**
```tsx
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function OverrideButton({ failures, onSubmit }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Override slip-fit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Override justification</DialogTitle>
        {/* ... textarea + submit */}
      </DialogContent>
    </Dialog>
  );
}
```

---

## 10. Drizzle Query Helpers — explicit joins via `db.select()`; relations API for read-mostly aggregates

**Pick:** Explicit `db.select().from().leftJoin()` for write-adjacent queries and anything performance-sensitive. Drizzle's relations API (`db.query.X.findMany({ with: { Y: true }})`) for read-only nested fetches like the holder dashboard.

**Why this split, not "always relations":**
- The relations API does N+1-ish things under the hood for certain shapes and obscures the SQL — bad for the booking-availability query, the modeler resolver inputs, and the audit-log reads where you want to *see* the SQL.
- Explicit joins are 2 lines longer and 10× more readable for the next maintainer.
- The relations API is fine for "give me holder + vessels + docs as a tree" — exactly the holder dashboard shape.

**Pattern (write-adjacent, explicit):**
```ts
// src/lib/assignment/availability.ts
import { db } from '@/db';
import { slip, assignment } from '@/db/schema';
import { and, eq, notExists, sql } from 'drizzle-orm';

export async function availableSlips(start: string, end: string) {
  return db
    .select()
    .from(slip)
    .where(and(
      eq(slip.status, 'active'),
      notExists(
        db.select().from(assignment).where(and(
          eq(assignment.slipId, slip.id),
          sql`${assignment.status} IN ('proposed','confirmed')`,
          sql`daterange(${assignment.startDate}, ${assignment.endDate}, '[]') && daterange(${start}::date, ${end}::date, '[]')`,
        )),
      ),
    ));
}
```

**Pattern (read-mostly nested, relations):**
```ts
// src/lib/holder/dashboard.ts
export async function holderDashboard(holderId: bigint) {
  return db.query.holder.findFirst({
    where: (h, { eq }) => eq(h.id, holderId),
    with: {
      vessels: { with: { documents: true }},
      assignments: { with: { slip: true }},
    },
  });
}
```

Define relations in `src/db/relations.ts` separately from the table schema for clarity. The schema file stays focused on columns + constraints.

---

## 11. Observability — Sentry (free) + Axiom (free) for logs; Vercel Analytics

**Pick:** Sentry (errors + performance), **Axiom free tier** (structured logs), Vercel Analytics (free, page views).

**Alternatives considered:**
- Vercel Logs only: 1-day retention on Hobby. Insufficient for "what happened last week."
- Logflare: still free but Vercel acquired it and migration ambiguity. Skip.
- BetterStack / Datadog / Honeycomb: $$. Overkill.
- Sentry alone: missing structured app logs (Sentry is errors + traces, not logs).

**Why right for solo-dev + Wharfside:**
- Sentry free tier = 5K events/mo. Wharfside's error volume should be <50/mo. Massive headroom.
- Axiom free tier = 500GB ingest/mo, 30-day retention. Wharfside will generate ~5MB of structured logs per month. Pure headroom.
- Vercel Analytics free = real-user Web Vitals + page views with no client-side beacon JS. Sufficient.
- Total observability bill: $0.

**Install:**
```bash
pnpm add @sentry/nextjs @axiomhq/js
pnpm dlx @sentry/wizard@latest -i nextjs
```

**Minimal usage (Axiom):**
```ts
// src/lib/log.ts
import { Axiom } from '@axiomhq/js';
const axiom = new Axiom({ token: process.env.AXIOM_TOKEN! });

export async function logEvent(event: {
  level: 'info' | 'warn' | 'error';
  action: string;
  actor_id?: string;
  request_id?: string;
  data?: unknown;
}) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(event);
    return;
  }
  await axiom.ingest('wharfside', [{ ...event, _time: new Date().toISOString() }]);
}
```

Vercel Analytics requires only `<SpeedInsights />` and `<Analytics />` in the root layout — no extra config.

---

## 12. Cron / Scheduled Jobs — Vercel Cron

**Pick:** Vercel Cron (built in, free on Hobby for 2 cron jobs; Pro for more).

**Alternatives considered:**
- `node-cron`: requires a long-running process. Vercel is serverless. Wrong tool.
- Inngest: durable workflow engine, lovely DX, $0 free tier. Overkill for two daily jobs; adds a dependency.
- Trigger.dev: same shape as Inngest. Same verdict.

**Why right for solo-dev + Wharfside:**
- Only 2 jobs needed: (a) daily doc-expiration scan at 06:00 ET, (b) fee-schedule activation check at midnight ET (if any approved schedule's `effective_start` matches today, flip to active). Both fit Vercel Cron Hobby (2 free jobs).
- Native to Vercel = zero new platform.
- If Wharfside ever exceeds 2 jobs (Phase 1.5 audit-log alerter, weekly backup, quarterly compliance report), upgrade to Vercel Pro (already budgeted) which allows unlimited cron jobs.

**Install:** N/A — config-only.

**Minimal usage:**
```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/doc-expirations", "schedule": "0 11 * * *" },
    { "path": "/api/cron/fee-schedule-activate", "schedule": "5 4 * * *" }
  ]
}
```
(Vercel Cron is UTC — `11:00 UTC = 06:00 ET`.)

```ts
// src/app/api/cron/doc-expirations/route.ts
import { NextResponse } from 'next/server';
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... scan, send reminders
  return NextResponse.json({ ok: true });
}
```

---

## 13. Background Jobs / Queue — **Not needed for MVP**

**Pick:** None.

**Why:**
- Email sends via Resend are <500ms — synchronous in the Server Action is fine.
- The largest "batch" job is the daily reminder cron, which processes <100 emails sequentially in <30s. Within Vercel Pro's 60s function limit.
- CSV export is synchronous, <2s.
- No webhook-receiver work, no long-running ML, no media processing.

**Defer trigger:** if Phase 1.5 adds COI OCR (Cloud Vision + LLM extraction), that's 10–30s per doc and warrants a queue. At that point, **Inngest free tier** is the right pick (durable, retries, no infra). Don't pre-build.

---

## 14. Rate Limiting — `@upstash/ratelimit` + Upstash Redis (free)

**Pick:** `@upstash/ratelimit` against Upstash Redis (free tier: 10K commands/day).

**Alternatives considered:**
- Vercel's built-in rate limit middleware: still in beta, limited customization.
- `@vercel/firewall`: enterprise / paid. Overkill.
- In-memory rate limit: useless on serverless (every cold start resets).
- Postgres-based rate limit: works, but adds latency to every public request.

**Why right for solo-dev + Wharfside:**
- Upstash Redis free tier (10K commands/day) covers Wharfside ~50×.
- `@upstash/ratelimit` ships sliding-window + token-bucket; sliding-window is the right default for magic-link requests.
- Same Redis instance also handles the rate limit for the public transient form (anti-spam).

**Install:**
```bash
pnpm add @upstash/ratelimit @upstash/redis
```

**Minimal usage:**
```ts
// src/lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export const magicLinkLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 per hour per email
  prefix: 'rl:magiclink',
});

export const transientFormLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '10 m'), // 3 per IP per 10 min
  prefix: 'rl:transient',
});

// In a server action / route handler:
// const { success } = await magicLinkLimit.limit(email);
// if (!success) return { error: 'Too many requests' };
```

---

## 15. Feature Flags — **Not needed for MVP**

**Pick:** None.

**Why:**
- Solo dev + single deploy + ~100 users = there's no audience to A/B test against and no rollback granularity to gain from flags.
- The "soft launch" pattern (modeler in Oct 2026, full launch April 2027) is handled by **route-level role gating** — `/admin/pricing` is visible to admins; `/admin/slips` 404s until Phase 2 ships. That's a hardcoded boolean in a routing helper, not a flag service.
- The architecture's "preview deploys for Linda" use Vercel Preview URLs, not flags.

**Defer trigger:** if Wharfside ever has external beta testers, a multi-cohort rollout, or kill-switches for risky features, **Vercel Edge Config** is the right answer (free with Vercel, key-value reads at the edge). For MVP, hand-rolled environment variables (`NEXT_PUBLIC_FEATURE_SLIP_OPS=true`) cover any conditional UI need.

**If you want a stub for "show this only to Nick":**
```ts
// src/lib/flags.ts
export function isEnabledFor(flag: string, session: Session): boolean {
  if (flag === 'modeler-v2' && session.user.email === 'nick@demarconet.com') return true;
  return false;
}
```
~15 LOC, zero dependencies, fine until proven otherwise.

---

## Summary — Install once

```bash
# Production dependencies
pnpm add \
  @react-pdf/renderer \
  react-konva konva use-image \
  otplib qrcode \
  resend @react-email/components @react-email/render \
  csv-stringify \
  date-fns \
  react-hook-form @hookform/resolvers \
  sonner \
  @sentry/nextjs @axiomhq/js \
  @upstash/ratelimit @upstash/redis

# Dev / type deps
pnpm add -D @types/qrcode react-email

# shadcn/ui (code-gen, not a dep)
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button dialog table dropdown-menu form input label select tabs toast textarea
```

That's the entire library footprint for MVP. ~15 production deps, all boring, all maintained, all under 100KB gzipped collectively except react-pdf and Konva (lazy-loaded only in admin routes).
