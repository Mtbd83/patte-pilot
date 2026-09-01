import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  organizationMembers,
  organizationMemberRoles,
  users,
  type OrgRole,
  type OrgPermission,
} from "@/db/schema";
import { PERMISSION_LABELS } from "@/lib/permission-labels";

export class ForbiddenError extends Error {
  constructor(message = "Accès refusé") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Returns the roles a given user holds inside a given organization.
 * Returns an empty array if the user is not a member (never throws),
 * so callers can decide how to react.
 */
export async function getMemberRoles(
  userId: string,
  organizationId: string,
): Promise<OrgRole[]> {
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.isActive, true),
    ),
    with: { roles: true },
  });

  if (!member) return [];
  return member.roles.map((r) => r.role);
}

/**
 * Server-side guard: throws ForbiddenError unless the user holds at least
 * one of the required roles in the organization. Always call this at the
 * top of server actions / route handlers that touch org-scoped data —
 * never trust a role sent from the client.
 */
export async function requireRole(
  userId: string,
  organizationId: string,
  allowedRoles: OrgRole[],
): Promise<OrgRole[]> {
  const roles = await getMemberRoles(userId, organizationId);
  const hasAccess = roles.some((role) => allowedRoles.includes(role));

  if (!hasAccess) {
    throw new ForbiddenError(
      `L'utilisateur n'a pas l'un des rôles requis (${allowedRoles.join(", ")}) dans cette organisation.`,
    );
  }

  return roles;
}

/** Convenience guard for admin-only actions. */
export async function requireAdmin(userId: string, organizationId: string) {
  return requireRole(userId, organizationId, ["admin"]);
}

/**
 * Returns the granular sub-rights a given user holds inside a given
 * organization — only meaningful for a "benevole" (see
 * organizationMemberPermissions), but not restricted to it: an admin's
 * permission rows, if any exist, are simply irrelevant since requireAdmin-
 * OrPermission below always passes admins regardless.
 */
export async function getMemberPermissions(
  userId: string,
  organizationId: string,
): Promise<OrgPermission[]> {
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.isActive, true),
    ),
    with: { permissions: true },
  });

  if (!member) return [];
  return member.permissions.map((p) => p.permission);
}

/**
 * Server-side guard: throws ForbiddenError unless the user is an admin, or
 * holds the specific sub-permission — the admin-or-permission pattern used
 * throughout for actions that used to be admin-only (and, for the two
 * candidature actions, actions that used to be open to every bénévole
 * unconditionally — see organizationMemberPermissions).
 */
export async function requireAdminOrPermission(
  userId: string,
  organizationId: string,
  permission: OrgPermission,
) {
  const roles = await getMemberRoles(userId, organizationId);
  if (roles.includes("admin")) return;

  const permissions = await getMemberPermissions(userId, organizationId);
  if (!permissions.includes(permission)) {
    throw new ForbiddenError(
      `Cette action nécessite le droit "${PERMISSION_LABELS[permission]}" (ou d'être administrateur·rice) dans cette organisation.`,
    );
  }
}

/**
 * Platform-level operator status — independent of any organization's own
 * roles (a user can be a platform manager and also a member of one or more
 * organizations, or neither). No self-service path to become one.
 */
export async function isPlatformManager(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user?.isPlatformManager ?? false;
}

/** Server-side guard: throws ForbiddenError unless the user is a platform manager. */
export async function requirePlatformManager(userId: string) {
  if (!(await isPlatformManager(userId))) {
    throw new ForbiddenError("Réservé aux gestionnaires de la plateforme.");
  }
}

/** User IDs of every active admin of an organization — e.g. to notify them of a new adoption application. */
export async function listOrganizationAdminUserIds(organizationId: string): Promise<string[]> {
  const members = await db.query.organizationMembers.findMany({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.isActive, true),
    ),
    with: { roles: true },
  });

  return members
    .filter((member) => member.roles.some((r) => r.role === "admin"))
    .map((member) => member.userId);
}

/** User IDs of every active admin, plus every bénévole holding the given permission — e.g. to notify them of a new stray-cat report. */
export async function listOrganizationAdminOrPermissionUserIds(
  organizationId: string,
  permission: OrgPermission,
): Promise<string[]> {
  const members = await db.query.organizationMembers.findMany({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.isActive, true),
    ),
    with: { roles: true, permissions: true },
  });

  return members
    .filter(
      (member) =>
        member.roles.some((r) => r.role === "admin") ||
        member.permissions.some((p) => p.permission === permission),
    )
    .map((member) => member.userId);
}
