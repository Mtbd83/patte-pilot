"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizationHelloAssoLinks } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireRole, ForbiddenError } from "@/lib/permissions";

const listHelloAssoLinksSchema = z.object({
  organizationId: z.string().uuid(),
});

/** Any member: lists the organization's named HelloAsso links, newest first. */
export async function listHelloAssoLinks(input: z.infer<typeof listHelloAssoLinksSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listHelloAssoLinksSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole", "famille_accueil"]);

  return db.query.organizationHelloAssoLinks.findMany({
    where: eq(organizationHelloAssoLinks.organizationId, organizationId),
    orderBy: desc(organizationHelloAssoLinks.createdAt),
  });
}

const createHelloAssoLinkSchema = z.object({
  organizationId: z.string().uuid(),
  label: z.string().min(1, "Le libellé est requis.").max(120),
  url: z.string().url("Le lien doit être une URL valide."),
});

/** Admin-only: adds a new named HelloAsso link. */
export async function createHelloAssoLink(input: z.infer<typeof createHelloAssoLinkSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createHelloAssoLinkSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const [link] = await db.insert(organizationHelloAssoLinks).values(data).returning();
  if (!link) throw new Error("Échec de la création du lien HelloAsso.");
  return link;
}

const updateHelloAssoLinkSchema = z.object({
  linkId: z.string().uuid(),
  organizationId: z.string().uuid(),
  label: z.string().min(1, "Le libellé est requis.").max(120),
  url: z.string().url("Le lien doit être une URL valide."),
});

/** Admin-only: renames/updates a named HelloAsso link. */
export async function updateHelloAssoLink(input: z.infer<typeof updateHelloAssoLinkSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { linkId, organizationId, ...rest } = updateHelloAssoLinkSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const [updated] = await db
    .update(organizationHelloAssoLinks)
    .set(rest)
    .where(
      and(
        eq(organizationHelloAssoLinks.id, linkId),
        eq(organizationHelloAssoLinks.organizationId, organizationId),
      ),
    )
    .returning();
  if (!updated) throw new Error("Lien HelloAsso introuvable.");
  return updated;
}

const deleteHelloAssoLinkSchema = z.object({
  linkId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: removes a named HelloAsso link. */
export async function deleteHelloAssoLink(input: z.infer<typeof deleteHelloAssoLinkSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { linkId, organizationId } = deleteHelloAssoLinkSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  await db
    .delete(organizationHelloAssoLinks)
    .where(
      and(
        eq(organizationHelloAssoLinks.id, linkId),
        eq(organizationHelloAssoLinks.organizationId, organizationId),
      ),
    );
}
