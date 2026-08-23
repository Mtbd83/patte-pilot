"use server";

import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/db";
import {
  invitations,
  organizationMembers,
  organizationMemberRoles,
  organizationMemberPermissions,
  organizations,
  users,
  orgRoleEnum,
  orgPermissionEnum,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";
import { sendEmail, invitationEmailHtml, organizationSmtpConfig } from "@/lib/mailer";
import { getRequestOrigin } from "@/lib/request-origin";

const INVITATION_TTL_DAYS = 7;

const createInvitationSchema = z
  .object({
    organizationId: z.string().uuid(),
    email: z.string().email(),
    roles: z.array(z.enum(orgRoleEnum.enumValues)).min(1),
    // Only meaningful when "benevole" is among `roles` — dropped otherwise,
    // same rule as updateMemberRoles in src/server/actions/members.ts.
    benevolePermissions: z.array(z.enum(orgPermissionEnum.enumValues)).optional(),
  })
  .refine(
    (data) => !data.benevolePermissions?.includes("contrat") || data.benevolePermissions.includes("candidature"),
    { message: "Le droit \"Contrat\" nécessite le droit \"Candidature\".", path: ["benevolePermissions"] },
  );

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/**
 * Admin-only: create and email an invitation for someone to join the
 * organization with one or more roles.
 */
export async function createInvitation(input: CreateInvitationInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, email, roles, benevolePermissions } = createInvitationSchema.parse(input);

  await requireAdmin(session.user.id, organizationId);

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  if (!organization) throw new Error("Organisation introuvable.");

  const inviter = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [invitation] = await db
    .insert(invitations)
    .values({
      organizationId,
      email: email.toLowerCase().trim(),
      roles,
      benevolePermissions: roles.includes("benevole") ? benevolePermissions ?? [] : [],
      token,
      invitedByUserId: session.user.id,
      expiresAt,
    })
    .returning();
  if (!invitation) throw new Error("Échec de la création de l'invitation.");

  const acceptUrl = `${await getRequestOrigin()}/invite/${token}`;

  await sendEmail({
    to: invitation.email,
    subject: `Invitation à rejoindre ${organization.name}`,
    html: invitationEmailHtml({
      organizationName: organization.name,
      inviterName: inviter?.firstName ?? inviter?.email ?? "Un administrateur",
      acceptUrl,
      roles,
    }),
    fromName: organization.name,
    replyTo: organization.contactEmail ?? undefined,
    organizationSmtp: organizationSmtpConfig(organization),
  });

  return invitation;
}

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

/**
 * Accept a pending invitation for the currently authenticated user.
 * The invitation email must match the authenticated user's email —
 * this prevents someone from hijacking another person's invite link.
 */
export async function acceptInvitation(input: z.infer<typeof acceptInvitationSchema>) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new ForbiddenError("Non authentifié.");
  }
  const userId = session.user.id;
  const userEmail = session.user.email;

  const { token } = acceptInvitationSchema.parse(input);

  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });

  if (!invitation) throw new Error("Invitation introuvable.");
  if (invitation.status !== "pending") throw new Error("Cette invitation n'est plus valide.");
  if (invitation.expiresAt < new Date()) {
    await db
      .update(invitations)
      .set({ status: "expired" })
      .where(eq(invitations.id, invitation.id));
    throw new Error("Cette invitation a expiré.");
  }
  if (invitation.email !== userEmail.toLowerCase().trim()) {
    throw new ForbiddenError("Cette invitation a été envoyée à une autre adresse email.");
  }

  await db.transaction(async (tx) => {
    let [member] = await tx
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, invitation.organizationId),
          eq(organizationMembers.userId, userId),
        ),
      );

    if (!member) {
      [member] = await tx
        .insert(organizationMembers)
        .values({
          organizationId: invitation.organizationId,
          userId,
        })
        .returning();
    }
    if (!member) throw new Error("Échec de la création du membre.");

    for (const role of invitation.roles) {
      await tx
        .insert(organizationMemberRoles)
        .values({ memberId: member.id, role })
        .onConflictDoNothing();
    }
    for (const permission of invitation.benevolePermissions ?? []) {
      await tx
        .insert(organizationMemberPermissions)
        .values({ memberId: member.id, permission })
        .onConflictDoNothing();
    }

    await tx
      .update(invitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
  });

  return { organizationId: invitation.organizationId };
}

const createAccountAndAcceptInvitationSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * For someone who received an invitation but doesn't have an account yet:
 * creates their account and accepts the invitation in one step, so they
 * don't have to sign up then separately revisit the invite link.
 */
export async function createAccountAndAcceptInvitation(
  input: z.infer<typeof createAccountAndAcceptInvitationSchema>,
) {
  const { token, email, password } = createAccountAndAcceptInvitationSchema.parse(input);

  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });
  if (!invitation) throw new Error("Invitation introuvable.");
  if (invitation.status !== "pending") throw new Error("Cette invitation n'est plus valide.");
  if (invitation.expiresAt < new Date()) {
    await db
      .update(invitations)
      .set({ status: "expired" })
      .where(eq(invitations.id, invitation.id));
    throw new Error("Cette invitation a expiré.");
  }
  if (invitation.email !== email.toLowerCase().trim()) {
    throw new ForbiddenError("Cette invitation a été envoyée à une autre adresse email.");
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, invitation.email),
  });
  if (existingUser) {
    throw new Error(
      "Un compte existe déjà avec cette adresse email. Connectez-vous pour accepter l'invitation.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: invitation.email, passwordHash })
      .returning();
    if (!user) throw new Error("Échec de la création du compte.");

    const [member] = await tx
      .insert(organizationMembers)
      .values({ organizationId: invitation.organizationId, userId: user.id })
      .returning();
    if (!member) throw new Error("Échec de la création du membre.");

    for (const role of invitation.roles) {
      await tx
        .insert(organizationMemberRoles)
        .values({ memberId: member.id, role })
        .onConflictDoNothing();
    }
    for (const permission of invitation.benevolePermissions ?? []) {
      await tx
        .insert(organizationMemberPermissions)
        .values({ memberId: member.id, permission })
        .onConflictDoNothing();
    }

    await tx
      .update(invitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    return { organizationId: invitation.organizationId };
  });
}
