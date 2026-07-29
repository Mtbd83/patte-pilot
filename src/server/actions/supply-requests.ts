"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { supplyRequests, supplyRequestCategoryEnum, fosterFamilies, organizations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireRole, listOrganizationAdminUserIds, ForbiddenError } from "@/lib/permissions";
import { sendPushToUsers } from "@/lib/push";
import { SUPPLY_REQUEST_CATEGORY_LABELS } from "@/lib/supply-request-labels";

/** The foster-family record this user IS, in this org — a request is always made as a specific family, not just "a famille_accueil member". */
async function getOwnFosterFamily(userId: string, organizationId: string) {
  return db.query.fosterFamilies.findFirst({
    where: and(eq(fosterFamilies.organizationId, organizationId), eq(fosterFamilies.linkedUserId, userId)),
  });
}

const createSupplyRequestSchema = z.object({
  organizationId: z.string().uuid(),
  category: z.enum(supplyRequestCategoryEnum.enumValues),
  quantity: z.coerce.number().int().min(1).default(1),
  comment: z.string().max(500).optional(),
});

/**
 * Famille d'accueil only, and only if linked to a foster-family record in
 * this org: creates a supply request and notifies every admin.
 */
export async function createSupplyRequest(input: z.input<typeof createSupplyRequestSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createSupplyRequestSchema.parse(input);
  await requireRole(session.user.id, data.organizationId, ["famille_accueil"]);

  const fosterFamily = await getOwnFosterFamily(session.user.id, data.organizationId);
  if (!fosterFamily) {
    throw new ForbiddenError("Votre compte n'est associé à aucune fiche famille d'accueil.");
  }

  const [request] = await db
    .insert(supplyRequests)
    .values({
      organizationId: data.organizationId,
      fosterFamilyId: fosterFamily.id,
      category: data.category,
      quantity: data.quantity,
      comment: data.comment,
    })
    .returning();
  if (!request) throw new Error("Échec de la création de la demande.");

  try {
    const [adminUserIds, organization] = await Promise.all([
      listOrganizationAdminUserIds(data.organizationId),
      db.query.organizations.findFirst({ where: eq(organizations.id, data.organizationId) }),
    ]);
    await sendPushToUsers(adminUserIds, {
      title: "Nouvelle demande de fournitures",
      body: `${fosterFamily.firstName} ${fosterFamily.lastName} demande : ${data.quantity}x ${SUPPLY_REQUEST_CATEGORY_LABELS[data.category]}`,
      url: organization ? `/organisations/${organization.slug}/stock` : undefined,
    });
  } catch (err) {
    console.error("Échec de l'envoi de la notification de nouvelle demande de fournitures:", err);
  }

  return request;
}

const listMySupplyRequestsSchema = z.object({ organizationId: z.string().uuid() });

/** Famille d'accueil only: her own requests, most recent first. */
export async function listMySupplyRequests(input: z.infer<typeof listMySupplyRequestsSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listMySupplyRequestsSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["famille_accueil"]);

  const fosterFamily = await getOwnFosterFamily(session.user.id, organizationId);
  if (!fosterFamily) return [];

  return db.query.supplyRequests.findMany({
    where: eq(supplyRequests.fosterFamilyId, fosterFamily.id),
    orderBy: desc(supplyRequests.createdAt),
  });
}

const listSupplyRequestsForAdminSchema = z.object({ organizationId: z.string().uuid() });

/** Admin-only: every open request for the org, with the requesting family attached. */
export async function listSupplyRequestsForAdmin(
  input: z.infer<typeof listSupplyRequestsForAdminSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listSupplyRequestsForAdminSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  return db.query.supplyRequests.findMany({
    where: eq(supplyRequests.organizationId, organizationId),
    orderBy: desc(supplyRequests.createdAt),
    with: { fosterFamily: true },
  });
}

const markSupplyRequestReceivedSchema = z.object({
  requestId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: marks a request "pris en compte" and notifies the requesting family. */
export async function markSupplyRequestReceived(
  input: z.infer<typeof markSupplyRequestReceivedSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { requestId, organizationId } = markSupplyRequestReceivedSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const request = await db.query.supplyRequests.findFirst({
    where: and(eq(supplyRequests.id, requestId), eq(supplyRequests.organizationId, organizationId)),
    with: { fosterFamily: true },
  });
  if (!request) throw new Error("Demande introuvable.");

  const [updated] = await db
    .update(supplyRequests)
    .set({ status: "pris_en_compte", updatedAt: new Date() })
    .where(eq(supplyRequests.id, requestId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour de la demande.");

  if (request.fosterFamily.linkedUserId) {
    try {
      const organization = await db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) });
      await sendPushToUsers([request.fosterFamily.linkedUserId], {
        title: "Demande prise en compte",
        body: `Votre demande de ${SUPPLY_REQUEST_CATEGORY_LABELS[request.category]} a été prise en compte.`,
        url: organization ? `/organisations/${organization.slug}` : undefined,
      });
    } catch (err) {
      console.error("Échec de l'envoi de la notification de demande prise en compte:", err);
    }
  }

  return updated;
}

const treatSupplyRequestSchema = z.object({
  requestId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: "traité" — the request is done, so its row is simply removed. */
export async function treatSupplyRequest(input: z.infer<typeof treatSupplyRequestSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { requestId, organizationId } = treatSupplyRequestSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const request = await db.query.supplyRequests.findFirst({
    where: and(eq(supplyRequests.id, requestId), eq(supplyRequests.organizationId, organizationId)),
  });
  if (!request) throw new Error("Demande introuvable.");

  await db.delete(supplyRequests).where(eq(supplyRequests.id, requestId));
}
