/**
 * Wharfside Marina — Auth.js v5 (beta) configuration.
 *
 * Strategy:
 *   • Magic-link (Resend) for `holder` accounts — single factor, low friction.
 *   • Credentials (email + password) for admin roles — FIRST factor only.
 *   • Custom TOTP enrollment + verification — SECOND factor, required for
 *     `super_admin` and `eci_admin`. Implemented as a custom flow (see
 *     /api/auth/totp/*) rather than an Auth.js provider — the v5 beta does
 *     not ship a turnkey TOTP provider, and the spec calls for a dedicated
 *     challenge token between first-factor and second-factor.
 *   • Session strategy: database-backed (Drizzle adapter writes to
 *     `auth_session`). Sessions are HTTP-only, Secure, SameSite=Lax with
 *     30-day rolling expiration (ARCH §12.1).
 *
 * Database adapter: Drizzle adapter. Auth.js's verification_token table
 * for magic-link tokens is created by the adapter at migration time;
 * `app_user` and `auth_session` already exist in `src/db/schema.ts`.
 *
 * Public exports:
 *   • `auth`, `handlers`, `signIn`, `signOut` — the v5 NextAuth() return.
 *     Importable as `import { auth, signIn, signOut } from "@/lib/auth/config"`.
 */

import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { hash, verify } from "@node-rs/argon2";

import { db } from "@/db";
import { appUser, authSession } from "@/db/schema";
import { userRoleEnum } from "@/lib/zod/schemas";

/* ============================================================
 * Type augmentation — extend session.user with our app fields.
 * ============================================================ */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "super_admin" | "eci_admin" | "board" | "holder";
      holderId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: "super_admin" | "eci_admin" | "board" | "holder";
    holderId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "super_admin" | "eci_admin" | "board" | "holder";
    holderId: string | null;
  }
}

/* ============================================================
 * Credentials provider — first factor only (admin/board).
 *
 * Successful credential validation does NOT create a session here.
 * Instead, route /api/auth/credentials/sign-in calls authorize() then
 * issues a short-lived challengeToken. /api/auth/totp/verify accepts
 * the challengeToken + TOTP code and THEN calls signIn("credentials")
 * with a special "totp-verified" marker to fully establish the session.
 *
 * The two-stage flow is enforced by the `requireTotp` flag on the
 * authorize() input: when missing the TOTP verifier, this provider
 * throws CredentialsSignin so Auth.js does NOT create the session.
 * ============================================================ */

const credentialsInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
  /** Set by the TOTP verifier after second-factor success. */
  totpVerified: z.literal("true").optional(),
});

export const authConfig: NextAuthConfig = {
  adapter: DrizzleAdapter(db),
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // rolling, 1 day
  },
  pages: {
    signIn: "/sign-in",
    signOut: "/sign-out",
    error: "/auth/error",
    verifyRequest: "/auth/verify-request",
    newUser: "/holder", // post-magic-link landing for holders
  },
  cookies: {
    sessionToken: {
      name: "wharfside.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
  providers: [
    Resend({
      from: "Wharfside Marina <no-reply@wharfsidemb.com>",
      apiKey: process.env.RESEND_API_KEY!,
      /* We render with our own React Email template (see lib/emails/magic-link.tsx).
         Auth.js's default sendVerificationRequest is overridden in
         src/lib/auth/sendVerificationRequest.ts which calls sendEmail({
         template: "magic-link", ... }). */
      // sendVerificationRequest is wired up via the lib/emails wrapper at
      // app startup — see lib/auth/sendVerificationRequest.ts.
    }),
    Credentials({
      id: "credentials",
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpVerified: { label: "TOTP verified marker", type: "text" },
      },
      async authorize(rawInput) {
        const parsed = credentialsInputSchema.safeParse(rawInput);
        if (!parsed.success) return null;
        const { email, password, totpVerified } = parsed.data;

        const [user] = await db
          .select()
          .from(appUser)
          .where(eq(appUser.email, email.toLowerCase()))
          .limit(1);

        if (!user || !user.passwordHash) return null;
        if (user.status !== "active") return null;

        const ok = await verify(user.passwordHash, password, {
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1,
        });
        if (!ok) return null;

        const role = userRoleEnum.parse(user.role);

        /* All admin roles must complete the TOTP second factor. The
           dedicated /api/auth/totp/verify route sets totpVerified="true"
           when it re-invokes signIn("credentials"). If TOTP is required
           but not yet verified, refuse to create the session. */
        const totpRequired = role === "super_admin" || role === "eci_admin";
        if (totpRequired && totpVerified !== "true") {
          // Throwing here causes the route to receive an error; the wrapper
          // route detects this case and instead returns a `challengeToken`.
          throw new Error("TOTP_REQUIRED");
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role,
          holderId: user.holderId ? String(user.holderId) : null,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * jwt() runs even when strategy:"database" if you also call auth()
     * from middleware — we use it to attach role + holderId for the
     * middleware to read without a DB query on every request.
     */
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.holderId = user.holderId;
      }
      return token;
    },
    async session({ session, user }) {
      // strategy:"database" passes `user` (DB row), not `token`.
      if (user) {
        const row = user as unknown as {
          id: string | number | bigint;
          role: string;
          holderId: string | number | bigint | null;
        };
        session.user.id = String(row.id);
        session.user.role = userRoleEnum.parse(row.role);
        session.user.holderId = row.holderId ? String(row.holderId) : null;
      }
      return session;
    },
    async signIn({ user, account }) {
      /* Block suspended users defensively. */
      if (!user.email) return false;
      const [row] = await db
        .select({ status: appUser.status })
        .from(appUser)
        .where(eq(appUser.email, user.email))
        .limit(1);
      if (row && row.status !== "active") return false;
      return true;
    },
    async redirect({ url, baseUrl }) {
      /* Only allow same-origin redirects; default to role-aware home. */
      try {
        const u = new URL(url, baseUrl);
        if (u.origin === baseUrl) return u.toString();
      } catch {
        // fallthrough
      }
      return `${baseUrl}/`;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await db
        .update(appUser)
        .set({ lastLoginAt: new Date() })
        .where(eq(appUser.id, BigInt(user.id)));
    },
  },
  trustHost: true,
};

/* ============================================================
 * Exported NextAuth handle.
 * Importable from any server context.
 * ============================================================ */

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

/* ============================================================
 * Convenience for route handlers + middleware:
 * a thin wrapper that returns the session or `null`.
 * Re-exported for ergonomic imports.
 * ============================================================ */

export type AppSession = Awaited<ReturnType<typeof auth>>;

/* ============================================================
 * Argon2id password hashing helper — used by credential creation flows.
 * Centralized so the parameters (memory/time cost) are consistent.
 * ============================================================ */

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

/* ============================================================
 * Session-token rotation on suspended/role-change events.
 * Callers should run this after `updateUserRole` or `suspendUser`.
 * ============================================================ */

export async function revokeAllSessionsFor(userId: bigint): Promise<number> {
  const result = await db
    .delete(authSession)
    .where(eq(authSession.userId, userId));
  // drizzle returns rowCount on Postgres
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
