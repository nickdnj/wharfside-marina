import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Build-safe DB client.
 *
 * postgres-js is lazy — the connection is opened on first query, not when
 * the client is constructed. So we can hand drizzle a postgres client built
 * from a placeholder URL during `next build` / static-analysis phases where
 * DATABASE_URL is not in the environment.
 *
 * Why eager (not lazy via Proxy)?
 *   @auth/drizzle-adapter does `is(db, PgDatabase)` at *adapter*
 *   construction time. A Proxy that intercepts every property read
 *   doesn't pass that instanceof check and also triggers a throw on
 *   harmless symbol probes (Symbol.toStringTag, etc.) — which is what
 *   was breaking `pnpm build` when env vars are absent.
 *
 * Runtime contract:
 *   • DATABASE_URL set    → real connection on first query.
 *   • DATABASE_URL unset  → placeholder URL. First query fails with a
 *                           connection error (or a "DATABASE_URL is not
 *                           set" warning logged once). Build and SSG
 *                           routes that never touch the DB still work.
 */

const PLACEHOLDER_URL = "postgres://build:build@127.0.0.1:5432/build";

const url = process.env.DATABASE_URL;
if (!url && process.env.NODE_ENV !== "test") {
  // Surface this once at startup so a misconfigured deploy is visible
  // in logs without crashing the process at import time.
  // eslint-disable-next-line no-console
  console.warn(
    "[db] DATABASE_URL is not set; using a placeholder URL. Queries will fail until DATABASE_URL is configured.",
  );
}

const queryClient = postgres(url ?? PLACEHOLDER_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export { schema };
