"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { inventoryItems, inventoryCategoryEnum, animalSpeciesEnum } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireRole, ForbiddenError } from "@/lib/permissions";
import { dateString } from "@/lib/validation";
import { computeInventoryStatus } from "@/lib/inventory-status";

const createInventoryItemSchema = z.object({
  organizationId: z.string().uuid(),
  articleName: z.string().min(1).max(200),
  category: z.enum(inventoryCategoryEnum.enumValues),
  animalSpecies: z.enum(animalSpeciesEnum.enumValues).optional(),
  quantity: z.coerce.number().int().min(0).default(0),
  minQuantity: z.coerce.number().int().min(0).default(0),
  unitPrice: z.coerce.number().min(0).optional(),
  expirationDate: dateString.optional(),
});

export type CreateInventoryItemInput = z.input<typeof createInventoryItemSchema>;

/** Admin-only: registers a new stock item, with its status computed from the start. */
export async function createInventoryItem(input: CreateInventoryItemInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createInventoryItemSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const status = computeInventoryStatus({
    quantity: data.quantity,
    minQuantity: data.minQuantity,
    expirationDate: data.expirationDate ?? null,
  });

  const [item] = await db
    .insert(inventoryItems)
    .values({
      organizationId: data.organizationId,
      articleName: data.articleName,
      category: data.category,
      animalSpecies: data.animalSpecies,
      quantity: data.quantity,
      minQuantity: data.minQuantity,
      unitPrice: data.unitPrice !== undefined ? data.unitPrice.toFixed(2) : undefined,
      expirationDate: data.expirationDate,
      status,
    })
    .returning();
  if (!item) throw new Error("Échec de la création de l'article.");
  return item;
}

const updateInventoryItemSchema = z.object({
  itemId: z.string().uuid(),
  organizationId: z.string().uuid(),
  articleName: z.string().min(1).max(200).optional(),
  category: z.enum(inventoryCategoryEnum.enumValues).optional(),
  animalSpecies: z.enum(animalSpeciesEnum.enumValues).nullable().optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  minQuantity: z.coerce.number().int().min(0).optional(),
  unitPrice: z.coerce.number().min(0).nullable().optional(),
  expirationDate: dateString.nullable().optional(),
});

export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

/** Admin-only: updates a stock item's fields and recomputes its status. */
export async function updateInventoryItem(input: UpdateInventoryItemInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { itemId, organizationId, ...rest } = updateInventoryItemSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const item = await db.query.inventoryItems.findFirst({
    where: and(eq(inventoryItems.id, itemId), eq(inventoryItems.organizationId, organizationId)),
  });
  if (!item) throw new Error("Article introuvable.");

  const nextQuantity = rest.quantity ?? item.quantity;
  const nextMinQuantity = rest.minQuantity ?? item.minQuantity;
  const nextExpirationDate =
    rest.expirationDate !== undefined ? rest.expirationDate : item.expirationDate;

  const status = computeInventoryStatus({
    quantity: nextQuantity,
    minQuantity: nextMinQuantity,
    expirationDate: nextExpirationDate,
  });

  const [updated] = await db
    .update(inventoryItems)
    .set({
      ...rest,
      unitPrice: rest.unitPrice !== undefined ? (rest.unitPrice?.toFixed(2) ?? null) : undefined,
      status,
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, itemId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour de l'article.");
  return updated;
}

const adjustQuantitySchema = z.object({
  itemId: z.string().uuid(),
  organizationId: z.string().uuid(),
  delta: z.coerce.number().int(),
});

/**
 * Admin-only: quick stock movement (+1 received, -1 used...) without going
 * through the full edit form. Quantity never goes below zero.
 */
export async function adjustInventoryQuantity(input: z.infer<typeof adjustQuantitySchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { itemId, organizationId, delta } = adjustQuantitySchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const item = await db.query.inventoryItems.findFirst({
    where: and(eq(inventoryItems.id, itemId), eq(inventoryItems.organizationId, organizationId)),
  });
  if (!item) throw new Error("Article introuvable.");

  const nextQuantity = Math.max(0, item.quantity + delta);
  const status = computeInventoryStatus({
    quantity: nextQuantity,
    minQuantity: item.minQuantity,
    expirationDate: item.expirationDate,
  });

  const [updated] = await db
    .update(inventoryItems)
    .set({ quantity: nextQuantity, status, updatedAt: new Date() })
    .where(eq(inventoryItems.id, itemId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du stock.");
  return updated;
}

const deleteInventoryItemSchema = z.object({
  itemId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: removes a stock item. */
export async function deleteInventoryItem(input: z.infer<typeof deleteInventoryItemSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { itemId, organizationId } = deleteInventoryItemSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const item = await db.query.inventoryItems.findFirst({
    where: and(eq(inventoryItems.id, itemId), eq(inventoryItems.organizationId, organizationId)),
  });
  if (!item) throw new Error("Article introuvable.");

  await db.delete(inventoryItems).where(eq(inventoryItems.id, itemId));
}

const listInventoryItemsSchema = z.object({
  organizationId: z.string().uuid(),
  category: z.enum(inventoryCategoryEnum.enumValues).optional(),
});

/** Any member (admin, bénévole or famille d'accueil): lists stock items. */
export async function listInventoryItems(input: z.infer<typeof listInventoryItemsSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, category } = listInventoryItemsSchema.parse(input);
  await requireRole(session.user.id, organizationId, ["admin", "benevole", "famille_accueil"]);

  const conditions = [eq(inventoryItems.organizationId, organizationId)];
  if (category) conditions.push(eq(inventoryItems.category, category));

  return db.query.inventoryItems.findMany({
    where: and(...conditions),
    orderBy: desc(inventoryItems.updatedAt),
  });
}
