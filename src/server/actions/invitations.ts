"use server";

import { randomBytes } from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
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
  fosterFamilies,
  orgRoleEnum,
  orgPermissionEnum,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";
import { sendEmail, invitationEmailHtml, organizationSmtpConfig } from "@/lib/mailer";
import { getRequestOrigin, getEmailLogoUrl } from "@/lib/request-origin";

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

  const normalizedEmail = email.toLowerCase().trim();
  const existingPending = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.organizationId, organizationId),
      eq(invitations.email, normalizedEmail),
      eq(invitations.status, "pending"),
    ),
  });
  if (existingPending) {
    throw new Error(
      "Une invitation est déjà en attente pour cette adresse — relancez-la ou supprimez-la avant d'en renvoyer une nouvelle.",
    );
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  if (!organization) throw new Error("Organisation introuvable.");

  const inviter = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const acceptUrl = `${await getRequestOrigin()}/invite/${token}`;

  // Sent before the row is inserted — a failed send (e.g. the organization
  // hasn't configured its own SMTP yet) must never leave behind an
  // invitation that looks "pending" but was never actually delivered.
  await sendEmail({
    to: normalizedEmail,
    subject: `Invitation à rejoindre ${organization.name}`,
    html: invitationEmailHtml({
      organizationName: organization.name,
      inviterName: inviter?.firstName ?? inviter?.email ?? "Un administrateur",
      acceptUrl,
      roles,
      logoUrl: await getEmailLogoUrl(),
    }),
    fromName: organization.name,
    replyTo: organization.contactEmail ?? undefined,
    organizationSmtp: organizationSmtpConfig(organization),
  });

  const [invitation] = await db
    .insert(invitations)
    .values({
      organizationId,
      email: normalizedEmail,
      roles,
      benevolePermissions: roles.includes("benevole") ? benevolePermissions ?? [] : [],
      token,
      invitedByUserId: session.user.id,
      expiresAt,
    })
    .returning();
  if (!invitation) throw new Error("Échec de la création de l'invitation.");

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

    // A famille_accueil invitation that matches an existing (not yet
    // linked) foster-family record by email connects automatically — no
    // separate manual "link this account" step needed.
    if (invitation.roles.includes("famille_accueil")) {
      await tx
        .update(fosterFamilies)
        .set({ linkedUserId: userId, updatedAt: new Date() })
        .where(
          and(
            eq(fosterFamilies.organizationId, invitation.organizationId),
            sql`lower(${fosterFamilies.email}) = ${invitation.email}`,
            isNull(fosterFamilies.linkedUserId),
          ),
        );
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

    // A famille_accueil invitation that matches an existing (not yet
    // linked) foster-family record by email connects automatically — no
    // separate manual "link this account" step needed.
    if (invitation.roles.includes("famille_accueil")) {
      await tx
        .update(fosterFamilies)
        .set({ linkedUserId: user.id, updatedAt: new Date() })
        .where(
          and(
            eq(fosterFamilies.organizationId, invitation.organizationId),
            sql`lower(${fosterFamilies.email}) = ${invitation.email}`,
            isNull(fosterFamilies.linkedUserId),
          ),
        );
    }

    await tx
      .update(invitations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    return { organizationId: invitation.organizationId };
  });
}

const listPendingInvitationsSchema = z.object({
  organizationId: z.string().uuid(),
});

/** Admin-only: pending invitations for the organization, newest first. */
export async function listPendingInvitations(
  input: z.infer<typeof listPendingInvitationsSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listPendingInvitationsSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  return db.query.invitations.findMany({
    where: and(eq(invitations.organizationId, organizationId), eq(invitations.status, "pending")),
    orderBy: desc(invitations.createdAt),
  });
}

const resendInvitationSchema = z.object({
  organizationId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

/**
 * Admin-only: re-sends a pending invitation's email and extends its expiry
 * by another INVITATION_TTL_DAYS — the token itself doesn't change, so any
 * copy of the original email keeps working too.
 */
export async function resendInvitation(input: z.infer<typeof resendInvitationSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, invitationId } = resendInvitationSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const invitation = await db.query.invitations.findFirst({
    where: and(eq(invitations.id, invitationId), eq(invitations.organizationId, organizationId)),
  });
  if (!invitation) throw new Error("Invitation introuvable.");
  if (invitation.status !== "pending") throw new Error("Cette invitation n'est plus en attente.");

  const organization = await db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) });
  if (!organization) throw new Error("Organisation introuvable.");

  const inviter = invitation.invitedByUserId
    ? await db.query.users.findFirst({ where: eq(users.id, invitation.invitedByUserId) })
    : null;

  const acceptUrl = `${await getRequestOrigin()}/invite/${invitation.token}`;

  // Sent before the expiry is extended — a failed send must never leave the
  // invitation looking freshly relaunched when no email actually went out.
  await sendEmail({
    to: invitation.email,
    subject: `Invitation à rejoindre ${organization.name}`,
    html: invitationEmailHtml({
      organizationName: organization.name,
      inviterName: inviter?.firstName ?? inviter?.email ?? "Un administrateur",
      acceptUrl,
      roles: invitation.roles,
      logoUrl: await getEmailLogoUrl(),
    }),
    fromName: organization.name,
    replyTo: organization.contactEmail ?? undefined,
    organizationSmtp: organizationSmtpConfig(organization),
  });

  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const [updated] = await db
    .update(invitations)
    .set({ expiresAt })
    .where(eq(invitations.id, invitationId))
    .returning();
  if (!updated) throw new Error("Échec de la relance de l'invitation.");

  return updated;
}

const deleteInvitationSchema = z.object({
  organizationId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

/** Admin-only: permanently cancels a pending invitation — e.g. to send a corrected one afterwards. */
export async function deleteInvitation(input: z.infer<typeof deleteInvitationSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, invitationId } = deleteInvitationSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const invitation = await db.query.invitations.findFirst({
    where: and(eq(invitations.id, invitationId), eq(invitations.organizationId, organizationId)),
  });
  if (!invitation) throw new Error("Invitation introuvable.");

  await db.delete(invitations).where(eq(invitations.id, invitationId));
}
