"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizationMembers, organizationMemberRoles, orgRoleEnum } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";

const updateMemberRolesSchema = z.object({
  organizationId: z.string().uuid(),
  memberId: z.string().uuid(),
  roles: z.array(z.enum(orgRoleEnum.enumValues)).min(1, "Sélectionnez au moins un rôle."),
});

/** Admin-only: replaces the set of roles held by an existing org member. */
export async function updateMemberRoles(input: z.infer<typeof updateMemberRolesSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, memberId, roles } = updateMemberRolesSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const member = await db.query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, organizationId)),
  });
  if (!member) throw new Error("Membre introuvable.");

  await db.transaction(async (tx) => {
    await tx.delete(organizationMemberRoles).where(eq(organizationMemberRoles.memberId, memberId));
    await tx.insert(organizationMemberRoles).values(roles.map((role) => ({ memberId, role })));
  });
}
