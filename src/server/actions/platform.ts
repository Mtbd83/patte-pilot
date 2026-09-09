"use server";

import { randomBytes } from "crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import {
  organizations,
  organizationSignupRequests,
  invitations,
  organizationMembers,
  users,
  animals,
  adoptionApplications,
  sterilizationCampaigns,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requirePlatformManager, ForbiddenError } from "@/lib/permissions";
import {
  sendEmail,
  platformSmtpConfig,
  platformAdminInvitationEmailHtml,
  invitationEmailHtml,
  organizationSmtpConfig,
} from "@/lib/mailer";
import { getRequestOrigin } from "@/lib/request-origin";

const INVITATION_TTL_DAYS = 7;
const RATE_LIMIT_MAX_PER_HOUR = 5;

const slugSchema = z
  .string()
  .min(2)
  .max(200)
  .regex(/^[a-z0-9-]+$/, "Le slug ne doit contenir que des lettres minuscules, chiffres et tirets.");

async function getClientIp() {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    return forwardedFor?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

/**
 * Shared by approval and direct creation: sends an invitation email for
 * someone to become a brand-new organization's first admin. Unlike
 * `createInvitation` (src/server/actions/invitations.ts), this doesn't
 * require the caller to already be an admin of the target org — there
 * isn't one yet — and sends through the platform's own mailbox rather than
 * the organization's (which isn't configured yet either). The `invitations`
 * row itself is identical in shape, so the existing accept-invite flow
 * (src/app/invite/[token]) works unchanged.
 */
async function sendPlatformAdminInvite({
  organizationId,
  organizationName,
  email,
  invitedByUserId,
}: {
  organizationId: string;
  organizationName: string;
  email: string;
  invitedByUserId: string;
}) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [invitation] = await db
    .insert(invitations)
    .values({
      organizationId,
      email: email.toLowerCase().trim(),
      roles: ["admin"],
      token,
      invitedByUserId,
      expiresAt,
    })
    .returning();
  if (!invitation) throw new Error("Échec de la création de l'invitation.");

  const acceptUrl = `${await getRequestOrigin()}/invite/${token}`;

  await sendEmail({
    to: invitation.email,
    subject: `Bienvenue sur PattePilot — ${organizationName}`,
    html: platformAdminInvitationEmailHtml({ organizationName, acceptUrl }),
    fromName: "PattePilot",
    organizationSmtp: platformSmtpConfig(),
  });

  return invitation;
}

const submitOrganizationSignupRequestSchema = z.object({
  organizationName: z.string().min(2).max(200),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  phone: z.string().max(30).optional(),
  message: z.string().optional(),
  siren: z.string().max(20).optional(),
  address: z.string().optional(),
  postalCode: z.string().max(10).optional(),
  city: z.string().max(120).optional(),
  // Honeypot: real visitors never see or fill this field. Never persisted.
  honeypot: z.string().optional(),
});

/**
 * Public: anyone can submit a request for their association to join the
 * platform — deliberately no auth check. Same anti-spam measures as
 * `submitAdoptionApplication` (honeypot + per-IP rate limit).
 */
export async function submitOrganizationSignupRequest(
  input: z.infer<typeof submitOrganizationSignupRequestSchema>,
) {
  const { honeypot, ...data } = submitOrganizationSignupRequestSchema.parse(input);

  if (honeypot) {
    return null;
  }

  const ipAddress = await getClientIp();
  if (ipAddress) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFromSameIp = await db.query.organizationSignupRequests.findMany({
      where: and(
        eq(organizationSignupRequests.ipAddress, ipAddress),
        gte(organizationSignupRequests.createdAt, oneHourAgo),
      ),
    });
    if (recentFromSameIp.length >= RATE_LIMIT_MAX_PER_HOUR) {
      throw new Error("Trop de demandes envoyées récemment — réessayez plus tard.");
    }
  }

  const [request] = await db
    .insert(organizationSignupRequests)
    .values({ ...data, ipAddress })
    .returning();
  if (!request) throw new Error("Échec de l'envoi de la demande.");
  return request;
}

const listSignupRequestsSchema = z.object({
  status: z.enum(["en_attente", "approuve", "refuse"]).optional(),
});

/** Platform manager only: lists signup requests, newest first. */
export async function listOrganizationSignupRequests(
  input: z.infer<typeof listSignupRequestsSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  await requirePlatformManager(session.user.id);

  const { status } = listSignupRequestsSchema.parse(input);
  return db.query.organizationSignupRequests.findMany({
    where: status ? eq(organizationSignupRequests.status, status) : undefined,
    orderBy: desc(organizationSignupRequests.createdAt),
  });
}

/** Platform manager only: lists every organization on the platform. */
export async function listOrganizationsForPlatformManager() {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  await requirePlatformManager(session.user.id);

  return db.query.organizations.findMany({ orderBy: desc(organizations.createdAt) });
}

const approveSignupRequestSchema = z.object({
  requestId: z.string().uuid(),
  slug: slugSchema,
});

/**
 * Platform manager only: creates the organization from the request's
 * details (name + legal/letterhead info pre-filled), emails an admin
 * invite to the requester, and marks the request approved.
 */
export async function approveOrganizationSignupRequest(
  input: z.infer<typeof approveSignupRequestSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  await requirePlatformManager(session.user.id);

  const { requestId, slug } = approveSignupRequestSchema.parse(input);

  const request = await db.query.organizationSignupRequests.findFirst({
    where: eq(organizationSignupRequests.id, requestId),
  });
  if (!request) throw new Error("Demande introuvable.");
  if (request.status !== "en_attente") throw new Error("Cette demande a déjà été traitée.");

  const [organization] = await db
    .insert(organizations)
    .values({
      name: request.organizationName,
      slug,
      contactEmail: request.contactEmail,
      siren: request.siren,
      address: request.address,
      postalCode: request.postalCode,
      city: request.city,
    })
    .returning();
  if (!organization) throw new Error("Échec de la création de l'organisation.");

  await sendPlatformAdminInvite({
    organizationId: organization.id,
    organizationName: organization.name,
    email: request.contactEmail,
    invitedByUserId: session.user.id,
  });

  const [updated] = await db
    .update(organizationSignupRequests)
    .set({ status: "approuve", reviewedAt: new Date(), createdOrganizationId: organization.id })
    .where(eq(organizationSignupRequests.id, requestId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour de la demande.");

  return { request: updated, organization };
}

const rejectSignupRequestSchema = z.object({
  requestId: z.string().uuid(),
  reviewNotes: z.string().optional(),
});

/** Platform manager only: marks a request refused. No email is sent. */
export async function rejectOrganizationSignupRequest(
  input: z.infer<typeof rejectSignupRequestSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  await requirePlatformManager(session.user.id);

  const { requestId, reviewNotes } = rejectSignupRequestSchema.parse(input);

  const request = await db.query.organizationSignupRequests.findFirst({
    where: eq(organizationSignupRequests.id, requestId),
  });
  if (!request) throw new Error("Demande introuvable.");
  if (request.status !== "en_attente") throw new Error("Cette demande a déjà été traitée.");

  const [updated] = await db
    .update(organizationSignupRequests)
    .set({ status: "refuse", reviewedAt: new Date(), reviewNotes })
    .where(eq(organizationSignupRequests.id, requestId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour de la demande.");
  return updated;
}

const createOrganizationAsPlatformManagerSchema = z.object({
  name: z.string().min(2).max(200),
  slug: slugSchema,
  adminEmail: z.string().email(),
});

/** Platform manager only: creates an organization directly (no signup request) and invites its first admin. */
export async function createOrganizationAsPlatformManager(
  input: z.infer<typeof createOrganizationAsPlatformManagerSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  await requirePlatformManager(session.user.id);

  const { name, slug, adminEmail } = createOrganizationAsPlatformManagerSchema.parse(input);

  const [organization] = await db.insert(organizations).values({ name, slug }).returning();
  if (!organization) throw new Error("Échec de la création de l'organisation.");

  await sendPlatformAdminInvite({
    organizationId: organization.id,
    organizationName: organization.name,
    email: adminEmail,
    invitedByUserId: session.user.id,
  });

  return organization;
}

const updateOrganizationIdentitySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(200),
  slug: slugSchema,
});

/** Platform manager only: renames an organization and/or changes its slug. Everything else stays the organization's own responsibility (its own Paramètres). */
export async function updateOrganizationIdentity(
  input: z.infer<typeof updateOrganizationIdentitySchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  await requirePlatformManager(session.user.id);

  const { organizationId, name, slug } = updateOrganizationIdentitySchema.parse(input);

  const [updated] = await db
    .update(organizations)
    .set({ name, slug, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning();
  if (!updated) throw new Error("Organisation introuvable.");
  return updated;
}

const deleteOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
  confirmName: z.string(),
});

/**
 * Platform manager only: permanently deletes an organization and everything
 * tied to it (animals, candidatures, familles d'accueil, comptabilité,
 * stock, documents, invitations, membres...) — every table referencing
 * organizations.id cascades at the database level. Requires retyping the
 * organization's exact name as a safety check against this being irreversible.
 */
export async function deleteOrganizationAsPlatformManager(
  input: z.infer<typeof deleteOrganizationSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  await requirePlatformManager(session.user.id);

  const { organizationId, confirmName } = deleteOrganizationSchema.parse(input);

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  if (!organization) throw new Error("Organisation introuvable.");
  if (confirmName !== organization.name) {
    throw new Error("Le nom saisi ne correspond pas — suppression annulée.");
  }

  await db.delete(organizations).where(eq(organizations.id, organizationId));
}

/** Whether the current session belongs to a platform manager — for conditionally showing the "Espace plateforme" link, e.g. */
export async function checkIsPlatformManager() {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  return user?.isPlatformManager ?? false;
}

const getOrganizationDetailSchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * Platform manager only: one organization's members (with roles/
 * permissions), its still-pending invitations, and a few headline counts —
 * everything editable stays the organization's own responsibility in its
 * own Membres/Paramètres pages; this view is read-only except for
 * resending an invitation (see resendInvitation below).
 */
export async function getOrganizationDetailForPlatformManager(
  input: z.infer<typeof getOrganizationDetailSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  await requirePlatformManager(session.user.id);

  const { organizationId } = getOrganizationDetailSchema.parse(input);

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  if (!organization) throw new Error("Organisation introuvable.");

  const [members, pendingInvitations, animalsList, applicationsList, campaignsList] = await Promise.all([
    db.query.organizationMembers.findMany({
      where: and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.isActive, true)),
      with: { user: true, roles: true, permissions: true },
    }),
    db.query.invitations.findMany({
      where: and(eq(invitations.organizationId, organizationId), eq(invitations.status, "pending")),
      orderBy: desc(invitations.createdAt),
    }),
    db.query.animals.findMany({ where: eq(animals.organizationId, organizationId), columns: { id: true } }),
    db.query.adoptionApplications.findMany({
      where: eq(adoptionApplications.organizationId, organizationId),
      columns: { id: true },
    }),
    db.query.sterilizationCampaigns.findMany({
      where: eq(sterilizationCampaigns.organizationId, organizationId),
      columns: { id: true },
    }),
  ]);

  return {
    organization,
    members,
    pendingInvitations,
    stats: {
      animalsCount: animalsList.length,
      applicationsCount: applicationsList.length,
      campaignsCount: campaignsList.length,
    },
  };
}

const resendInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

/**
 * Platform manager only: re-sends a pending invitation's email and extends
 * its expiry by another INVITATION_TTL_DAYS — the token itself doesn't
 * change, so any copy of the original email keeps working too.
 */
export async function resendInvitation(input: z.infer<typeof resendInvitationSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");
  await requirePlatformManager(session.user.id);

  const { invitationId } = resendInvitationSchema.parse(input);

  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId),
    with: { organization: true, invitedBy: true },
  });
  if (!invitation) throw new Error("Invitation introuvable.");
  if (invitation.status !== "pending") throw new Error("Cette invitation n'est plus en attente.");

  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const [updated] = await db
    .update(invitations)
    .set({ expiresAt })
    .where(eq(invitations.id, invitationId))
    .returning();
  if (!updated) throw new Error("Échec de la relance de l'invitation.");

  const acceptUrl = `${await getRequestOrigin()}/invite/${invitation.token}`;

  await sendEmail({
    to: invitation.email,
    subject: `Invitation à rejoindre ${invitation.organization.name}`,
    html: invitationEmailHtml({
      organizationName: invitation.organization.name,
      inviterName: invitation.invitedBy?.firstName ?? invitation.invitedBy?.email ?? "Un administrateur",
      acceptUrl,
      roles: invitation.roles,
    }),
    fromName: invitation.organization.name,
    replyTo: invitation.organization.contactEmail ?? undefined,
    organizationSmtp: organizationSmtpConfig(invitation.organization),
  });

  return updated;
}
