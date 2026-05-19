/**
 * Next.js middleware — enforces auth + role on protected paths.
 *
 * Path policy:
 *   • `/admin/*`   → must be signed in AND role ∈ {super_admin, eci_admin, board}
 *   • `/holder/*`  → must be signed in AND role === holder (admins may also
 *                    enter to impersonate / debug — they see a banner)
 *   • `/api/admin/*` → 403 JSON if not admin/board
 *   • `/api/holder/me/*` → 401/403 JSON if not the holder
 *   • Everything else → public
 *
 * On a missing/invalid session, redirect to `/sign-in?callbackUrl=...`.
 * On a role mismatch, redirect signed-in user to `/auth/forbidden`
 * (the page renders a 403 explainer). Privacy note: we return 403, not
 * 404, on role mismatch — per the architecture decision.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";

const ADMIN_PREFIXES = ["/admin", "/api/admin"];
const HOLDER_PREFIXES = ["/holder", "/api/holder"];
const AUTHED_ROLES_ADMIN = new Set(["super_admin", "eci_admin", "board"]);

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static, _next/image
     *  - favicon, fonts, public assets
     *  - Auth.js routes (they handle their own auth)
     *  - Patron site public routes (let through; route handlers do their own checks)
     */
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

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const needsAdmin = isPrefixed(pathname, ADMIN_PREFIXES);
  const needsHolder = isPrefixed(pathname, HOLDER_PREFIXES);

  if (!needsAdmin && !needsHolder) {
    return NextResponse.next();
  }

  const session = await auth();
  const role = session?.user?.role;

  /* ---------- not signed in ---------- */
  if (!role) {
    if (isJsonRoute(pathname)) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 },
      );
    }
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  /* ---------- signed in but wrong role ---------- */
  if (needsAdmin && !AUTHED_ROLES_ADMIN.has(role)) {
    if (isJsonRoute(pathname)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/auth/forbidden", req.url));
  }

  if (needsHolder && role !== "holder" && !AUTHED_ROLES_ADMIN.has(role)) {
    /* `holder` and admins both allowed into `/holder/*` (admins for support);
       board users are not. */
    if (isJsonRoute(pathname)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/auth/forbidden", req.url));
  }

  /* ---------- ok ---------- */
  return NextResponse.next();
}
