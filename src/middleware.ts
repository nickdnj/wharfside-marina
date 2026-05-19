/**
 * Next.js middleware — coarse-grained route gate.
 *
 * Strategy: middleware runs on the Edge runtime, where the Auth.js v5
 * Drizzle adapter and `@node-rs/argon2` cannot load. So this layer only
 * checks for the presence of a session cookie — the actual session
 * validity (role + status) is enforced by the page or route handler
 * via `auth()` from `@/lib/auth/config` (Node runtime).
 *
 * Path policy:
 *   • `/admin/*` and `/holder/*` (and their `/api/*` siblings) require
 *     the session cookie. If absent → redirect to `/sign-in` (or 401 JSON).
 *   • Every other path is public.
 *
 * STORY-05 will replace this with a proper edge-safe Auth.js config that
 * decodes the JWT and enforces role checks at the edge.
 */

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "wharfside.session-token";
const ADMIN_PREFIXES = ["/admin", "/api/admin"];
const HOLDER_PREFIXES = ["/holder", "/api/holder"];

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|images/|api/auth/).*)",
  ],
};

function isJsonRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isPrefixed(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export default function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const needsAuth =
    isPrefixed(pathname, ADMIN_PREFIXES) || isPrefixed(pathname, HOLDER_PREFIXES);
  if (!needsAuth) return NextResponse.next();

  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (isJsonRoute(pathname)) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const signInUrl = new URL("/sign-in", req.url);
  signInUrl.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(signInUrl);
}
