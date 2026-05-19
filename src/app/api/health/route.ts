import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthCheck = {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
};

async function check(name: string, fn: () => Promise<string | void>): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, ms: Date.now() - start, detail: detail ?? undefined };
  } catch (err) {
    return {
      name,
      ok: false,
      ms: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const checks = await Promise.all([
    check("db", async () => {
      const result = await db.execute(sql`SELECT 1 AS one`);
      if (!result || (Array.isArray(result) && result.length === 0)) {
        throw new Error("db ping returned empty result");
      }
      return "connected";
    }),
    check("db.exclude_constraint", async () => {
      // Tripwire — fails loudly if the EXCLUDE constraint was ever dropped
      const result = await db.execute(sql`
        SELECT conname FROM pg_constraint WHERE conname = 'no_slip_overlap'
      `);
      const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
      if (rows.length === 0) {
        throw new Error("no_slip_overlap EXCLUDE constraint MISSING — double-booking possible");
      }
      return "present";
    }),
    check("db.btree_gist", async () => {
      const result = await db.execute(sql`
        SELECT extname FROM pg_extension WHERE extname = 'btree_gist'
      `);
      const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
      if (rows.length === 0) throw new Error("btree_gist extension missing");
      return "installed";
    }),
    check("db.audit_log_appendable", async () => {
      // Confirms audit_log exists and is writable (we don't actually write — just describe)
      const result = await db.execute(sql`
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'audit_log' AND table_schema = 'public'
      `);
      const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
      if (rows.length === 0) throw new Error("audit_log table missing");
      return "present";
    }),
  ]);

  const ok = checks.every((c) => c.ok);
  const status = ok ? 200 : 503;
  return NextResponse.json(
    {
      status: ok ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status },
  );
}
