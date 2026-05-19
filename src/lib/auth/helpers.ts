/**
 * Wharfside Marina — auth helpers.
 *
 * These helpers are intended for use in Server Actions and Route Handlers.
 * They throw structured errors that the calling layer can map to HTTP
 * responses (403 / 401) or Next.js error boundaries.
 *
 * Convention:
 *   • `requireRole(...)` and `requireSelf(...)` throw on failure — call
 *     them at the top of every protected Server Action.
 *   • `getCurrentUser()` returns the typed user object, or throws
 *     `UnauthorizedError` if not signed in.
 *   • `getCurrentUserOptional()` returns `null` instead of throwing.
 */

import { auth } from "@/lib/auth/config";
import type { UserRole } from "@/lib/zod/schemas";

/* ============================================================
 * Error types
 * ============================================================ */

export class UnauthorizedError extends Error {
  readonly statusCode = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/* ============================================================
 * Session shape
 * ============================================================ */

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  holderId: string | null;
}

/* ============================================================
 * getCurrentUser()
 * ============================================================ */

export async function getCurrentUserOptional(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    role: session.user.role,
    holderId: session.user.holderId,
  };
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUserOptional();
  if (!user) throw new UnauthorizedError();
  return user;
}

/* ============================================================
 * requireRole(...allowedRoles)
 *
 * Throws ForbiddenError (403) if the user's role isn't in the allow-list.
 * Privacy note: we deliberately return 403, not 404, on role mismatch
 * (architecture decision — role surface is internal).
 *
 *   const user = await requireRole("eci_admin", "super_admin");
 * ============================================================ */

export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Role '${user.role}' not allowed; required: ${allowedRoles.join(" | ")}`,
    );
  }
  return user;
}

/* ============================================================
 * Convenience role shortcuts
 * ============================================================ */

export const requireAdmin = () => requireRole("super_admin", "eci_admin");
export const requireAdminOrBoard = () =>
  requireRole("super_admin", "eci_admin", "board");
export const requireSuperAdmin = () => requireRole("super_admin");
export const requireHolder = () => requireRole("holder");

/* ============================================================
 * requireSelf(holderId)
 *
 * For holder-self-only access (e.g., reading their own data). Pass the
 * holderId from the URL/params/Server Action input — throws if the
 * session's holderId doesn't match.
 *
 * Admins bypass this check (return the admin user) so they can act on
 * behalf of holders.
 *
 *   const user = await requireSelf(holderId);
 * ============================================================ */

export async function requireSelf(holderId: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user.role === "super_admin" || user.role === "eci_admin") return user;
  if (user.role !== "holder") {
    throw new ForbiddenError("Only the matching holder may access this resource");
  }
  if (user.holderId !== holderId) {
    throw new ForbiddenError("Access denied: not the resource owner");
  }
  return user;
}

/* ============================================================
 * requireSelfOrAdminOrBoard(holderId)
 *
 * Useful for resources that should be visible to admins AND board AND
 * the matching holder (read-mostly endpoints, e.g., a holder's fees).
 * ============================================================ */

export async function requireSelfOrAdminOrBoard(
  holderId: string,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (
    user.role === "super_admin" ||
    user.role === "eci_admin" ||
    user.role === "board"
  ) {
    return user;
  }
  if (user.role === "holder" && user.holderId === holderId) return user;
  throw new ForbiddenError("Access denied");
}

/* ============================================================
 * roleAtLeast — for comparing privilege levels.
 *
 * Privilege order (highest → lowest):
 *   super_admin > eci_admin > board > holder
 * ============================================================ */

const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 4,
  eci_admin: 3,
  board: 2,
  holder: 1,
};

export function roleAtLeast(have: UserRole, want: UserRole): boolean {
  return ROLE_RANK[have] >= ROLE_RANK[want];
}

/* ============================================================
 * isAdmin / isStaff helpers — useful in templates/components.
 * ============================================================ */

export function isAdmin(role: UserRole): boolean {
  return role === "super_admin" || role === "eci_admin";
}

export function isStaff(role: UserRole): boolean {
  return isAdmin(role) || role === "board";
}
