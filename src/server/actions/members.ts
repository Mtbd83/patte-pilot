"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  organizationMembers,
  organizationMemberRoles,
  organizationMemberPermissions,
  orgRoleEnum,
  orgPermissionEnum,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";

const updateMemberRolesSchema = z
  .object({
    organizationId: z.string().uuid(),
    memberId: z.string().uuid(),
    roles: z.array(z.enum(orgRoleEnum.enumValues)).min(1, "Sélectionnez au moins un rôle."),
    // Only meaningful when "benevole" is among `roles` — ignored (and, if
    // "benevole" isn't selected, cleared) otherwise, see below.
    permissions: z.array(z.enum(orgPermissionEnum.enumValues)).optional(),
  })
  .refine((data) => !data.permissions?.includes("contrat") || data.permissions.includes("candidature"), {
    message: "Le droit \"Contrat\" nécessite le droit \"Candidature\".",
    path: ["permissions"],
  });

/**
 * Admin-only: replaces the set of roles (and, for a bénévole, the granular
 * sub-permissions) held by an existing org member — both in one transaction
 * so a page refresh never shows a half-applied change. Permissions are
 * silently dropped if "benevole" isn't among the submitted roles, so
 * removing that role never leaves orphaned permission rows granting
 * nothing to a role the member no longer has.
 */
export async function updateMemberRoles(input: z.infer<typeof updateMemberRolesSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, memberId, roles, permissions } = updateMemberRolesSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const member = await db.query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, organizationId)),
  });
  if (!member) throw new Error("Membre introuvable.");

  const effectivePermissions = roles.includes("benevole") ? (permissions ?? []) : [];

  await db.transaction(async (tx) => {
    await tx.delete(organizationMemberRoles).where(eq(organizationMemberRoles.memberId, memberId));
    await tx.insert(organizationMemberRoles).values(roles.map((role) => ({ memberId, role })));

    await tx.delete(organizationMemberPermissions).where(eq(organizationMemberPermissions.memberId, memberId));
    if (effectivePermissions.length > 0) {
      await tx
        .insert(organizationMemberPermissions)
        .values(effectivePermissions.map((permission) => ({ memberId, permission })));
    }
  });
}
