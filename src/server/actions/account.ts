"use server";

import { and, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import { users, organizationMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis."),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères."),
});

/** Changes the current user's own password, after verifying the current one. */
export async function updatePassword(input: z.infer<typeof updatePasswordSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { currentPassword, newPassword } = updatePasswordSchema.parse(input);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user?.passwordHash) throw new Error("Compte introuvable.");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error("Mot de passe actuel incorrect.");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
}

type MembershipWithOrg = {
  id: string;
  organizationId: string;
  roles: { role: string }[];
  organization: { name: string };
};

/**
 * Throws if this membership is the organization's sole admin and the org has
 * other members — leaving/deleting would strand that team with no one able
 * to manage roles, invites, etc. An org with no other members at all is
 * fine to leave/delete alone, since nothing would be left stranded.
 */
async function assertNotSoleAdmin(membership: MembershipWithOrg) {
  if (!membership.roles.some((role) => role.role === "admin")) return;

  const otherMembers = await db.query.organizationMembers.findMany({
    where: and(
      eq(organizationMembers.organizationId, membership.organizationId),
      ne(organizationMembers.id, membership.id),
    ),
    with: { roles: true },
  });
  if (otherMembers.length === 0) return;

  const hasOtherAdmin = otherMembers.some((member) => member.roles.some((role) => role.role === "admin"));
  if (!hasOtherAdmin) {
    throw new Error(
      `Vous êtes l'unique administrateur·rice de "${membership.organization.name}". Désignez quelqu'un d'autre comme administrateur·rice avant de continuer.`,
    );
  }
}

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Mot de passe requis."),
});

/**
 * Deletes the current user's own account, after verifying their password.
 * Everything else (memberships, roles, and the linked-user-account
 * references on foster families / accounting entries) cleans up via the FK
 * cascade/set-null rules on `users`.
 */
export async function deleteAccount(input: z.infer<typeof deleteAccountSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  const userId = session.user.id;

  const { password } = deleteAccountSchema.parse(input);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.passwordHash) throw new Error("Compte introuvable.");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Mot de passe incorrect.");

  const memberships = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, userId),
    with: { roles: true, organization: true },
  });

  for (const membership of memberships) {
    await assertNotSoleAdmin(membership);
  }

  await db.delete(users).where(eq(users.id, userId));
}

const leaveOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * Removes the current user's own membership from an organization, without
 * touching their account or their memberships in any other organization.
 */
export async function leaveOrganization(input: z.infer<typeof leaveOrganizationSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = leaveOrganizationSchema.parse(input);

  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, session.user.id),
    ),
    with: { roles: true, organization: true },
  });
  if (!membership) throw new Error("Vous n'êtes pas membre de cette organisation.");

  await assertNotSoleAdmin(membership);

  await db.delete(organizationMembers).where(eq(organizationMembers.id, membership.id));
}

/** Marks the first-login guided tour (OnboardingTour) as seen, whether finished or skipped. */
export async function completeOnboarding() {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  await db
    .update(users)
    .set({ onboardingCompletedAt: new Date() })
    .where(eq(users.id, session.user.id));
}
