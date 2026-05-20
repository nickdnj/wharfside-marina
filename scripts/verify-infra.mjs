#!/usr/bin/env node
/**
 * verify-infra — smoke-tests every external service the app talks to.
 *
 * Reads `.env.local` (via dotenv) and probes each service in turn.
 * Exits 0 only if every required service is reachable. Optional services
 * print WARN and don't fail the overall run.
 *
 * Usage:
 *   pnpm verify:infra
 *   pnpm verify:infra --send-test-mail you@example.com
 */

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(process.cwd(), ".env.local");
if (existsSync(ENV_FILE)) {
  loadEnv({ path: ENV_FILE });
} else {
  loadEnv(); // fallback to default `.env`
}

const args = process.argv.slice(2);
const sendTestMail = (() => {
  const i = args.indexOf("--send-test-mail");
  return i >= 0 ? args[i + 1] : null;
})();

let failed = 0;
let warned = 0;

const FG = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function ok(name, detail) {
  console.log(`  ${FG.green("✓")} ${name}${detail ? FG.dim(`  — ${detail}`) : ""}`);
}
function warn(name, detail) {
  warned += 1;
  console.log(`  ${FG.yellow("!")} ${name}${detail ? FG.dim(`  — ${detail}`) : ""}`);
}
function fail(name, detail) {
  failed += 1;
  console.log(`  ${FG.red("✗")} ${name}${detail ? FG.dim(`  — ${detail}`) : ""}`);
}
function header(s) {
  console.log("\n" + FG.bold(s));
}

async function checkEnvShape() {
  header("Env vars");
  const required = ["DATABASE_URL", "AUTH_SECRET"];
  const optional = [
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "ECI_NOTIFICATION_EMAIL",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "SENTRY_DSN",
    "NEXT_PUBLIC_SITE_URL",
    "AUTH_URL",
  ];
  for (const k of required) {
    if (process.env[k] && process.env[k].length > 0) ok(k);
    else fail(k, "required but missing");
  }
  for (const k of optional) {
    if (process.env[k] && process.env[k].length > 0) ok(k);
    else warn(k, "optional, skipping the dependent check");
  }
}

async function checkDatabase() {
  header("Neon Postgres");
  const url = process.env.DATABASE_URL;
  if (!url) {
    fail("DATABASE_URL", "not set; skipping");
    return;
  }
  let postgres;
  try {
    postgres = (await import("postgres")).default;
  } catch (e) {
    fail("postgres driver", `failed to import: ${e.message}`);
    return;
  }
  const sql = postgres(url, { max: 1, connect_timeout: 8 });
  try {
    const [{ now }] = await sql`SELECT now()`;
    ok("SELECT now()", `server time: ${new Date(now).toISOString()}`);
    const ext = await sql`SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'`;
    if (ext.length) ok("btree_gist extension", "installed");
    else fail("btree_gist extension", "missing — required for assignment EXCLUDE constraint");
  } catch (e) {
    fail("database connection", e.message);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

async function checkUpstash() {
  header("Upstash Redis");
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    warn("Upstash", "no creds; rate-limit will no-op");
    return;
  }
  let Redis;
  try {
    Redis = (await import("@upstash/redis")).Redis;
  } catch (e) {
    fail("@upstash/redis", `failed to import: ${e.message}`);
    return;
  }
  try {
    const redis = new Redis({ url, token });
    const pong = await redis.ping();
    if (pong === "PONG") ok("PING", pong);
    else fail("PING", `unexpected response: ${pong}`);
  } catch (e) {
    fail("upstash", e.message);
  }
}

async function checkR2() {
  header("Cloudflare R2");
  const acct = process.env.R2_ACCOUNT_ID;
  const ak = process.env.R2_ACCESS_KEY_ID;
  const sk = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!acct || !ak || !sk || !bucket) {
    warn("R2", "creds incomplete; document storage will fail at runtime");
    return;
  }
  let S3Client, HeadBucketCommand;
  try {
    const m = await import("@aws-sdk/client-s3");
    S3Client = m.S3Client;
    HeadBucketCommand = m.HeadBucketCommand;
  } catch (e) {
    fail("@aws-sdk/client-s3", `failed to import: ${e.message}`);
    return;
  }
  try {
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${acct}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ak, secretAccessKey: sk },
      forcePathStyle: false,
    });
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    ok("HEAD bucket", `${bucket} reachable`);
  } catch (e) {
    fail("R2", `${e.name ?? "error"}: ${e.message}`);
  }
}

async function checkResend() {
  header("Resend");
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    warn("Resend", "no API key; outbound email will silently no-op");
    return;
  }
  let Resend;
  try {
    Resend = (await import("resend")).Resend;
  } catch (e) {
    fail("resend", `failed to import: ${e.message}`);
    return;
  }
  const resend = new Resend(key);
  try {
    // List domains is the cheapest way to validate the key without sending.
    const { data, error } = await resend.domains.list();
    if (error) {
      fail("Resend API key", error.message ?? "rejected");
      return;
    }
    const count = Array.isArray(data?.data) ? data.data.length : 0;
    ok("API key", `valid; ${count} domain(s) attached`);
  } catch (e) {
    fail("resend", e.message);
    return;
  }

  if (sendTestMail) {
    const from = process.env.EMAIL_FROM ?? "Wharfside Marina <no-reply@wharfsidemb.com>";
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: sendTestMail,
        subject: "Wharfside Marina infra verification",
        text: "This is the verify-infra smoke-test email. If you received it, Resend is wired up correctly.",
      });
      if (error) fail("test email", error.message ?? "send failed");
      else ok("test email", `delivered id: ${data?.id ?? "?"}`);
    } catch (e) {
      fail("test email", e.message);
    }
  } else {
    console.log(
      `    ${FG.dim("(skip --send-test-mail you@example.com to send a real probe email)")}`,
    );
  }
}

async function main() {
  console.log(FG.bold("\nWharfside Marina — infra verification\n"));
  await checkEnvShape();
  await checkDatabase();
  await checkUpstash();
  await checkR2();
  await checkResend();

  console.log("");
  if (failed > 0) {
    console.log(
      FG.red(`✗ ${failed} check(s) failed`) +
        (warned ? FG.yellow(`, ${warned} warning(s)`) : ""),
    );
    process.exit(1);
  }
  console.log(
    FG.green("✓ all required checks passed") +
      (warned ? FG.yellow(`, ${warned} optional warning(s)`) : ""),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(FG.red(`\nverify-infra crashed: ${e.message}`));
  process.exit(2);
});
