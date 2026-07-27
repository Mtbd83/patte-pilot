"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accountingEntries, accountingTypeEnum, accountingCategoryEnum } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";
import { dateString } from "@/lib/validation";

const createAccountingEntrySchema = z.object({
  organizationId: z.string().uuid(),
  date: dateString,
  type: z.enum(accountingTypeEnum.enumValues),
  category: z.enum(accountingCategoryEnum.enumValues),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0."),
  animalId: z.string().uuid().optional(),
  comment: z.string().optional(),
});

export type CreateAccountingEntryInput = z.infer<typeof createAccountingEntrySchema>;

/** Admin-only: records a new accounting entry (income or expense). */
export async function createAccountingEntry(input: CreateAccountingEntryInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createAccountingEntrySchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const [entry] = await db
    .insert(accountingEntries)
    .values({
      organizationId: data.organizationId,
      date: data.date,
      type: data.type,
      category: data.category,
      amount: data.amount.toFixed(2),
      animalId: data.animalId,
      comment: data.comment,
      createdByUserId: session.user.id,
    })
    .returning();
  if (!entry) throw new Error("Échec de la création de l'écriture comptable.");
  return entry;
}

const deleteAccountingEntrySchema = z.object({
  entryId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/**
 * Admin-only: removes an accounting entry. Entries aren't editable in place
 * — correcting a mistake means deleting and re-entering it, which keeps a
 * clean audit trail (no silent retroactive edits to recorded amounts).
 */
export async function deleteAccountingEntry(
  input: z.infer<typeof deleteAccountingEntrySchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { entryId, organizationId } = deleteAccountingEntrySchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const entry = await db.query.accountingEntries.findFirst({
    where: and(eq(accountingEntries.id, entryId), eq(accountingEntries.organizationId, organizationId)),
  });
  if (!entry) throw new Error("Écriture introuvable.");

  await db.delete(accountingEntries).where(eq(accountingEntries.id, entryId));
}

const listAccountingEntriesSchema = z.object({
  organizationId: z.string().uuid(),
  type: z.enum(accountingTypeEnum.enumValues).optional(),
  category: z.enum(accountingCategoryEnum.enumValues).optional(),
});

/** Admin-only: lists accounting entries. */
export async function listAccountingEntries(
  input: z.infer<typeof listAccountingEntriesSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, type, category } = listAccountingEntriesSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const conditions = [eq(accountingEntries.organizationId, organizationId)];
  if (type) conditions.push(eq(accountingEntries.type, type));
  if (category) conditions.push(eq(accountingEntries.category, category));

  return db.query.accountingEntries.findMany({
    where: and(...conditions),
    orderBy: desc(accountingEntries.date),
    with: { animal: true },
  });
}

const summarySchema = z.object({ organizationId: z.string().uuid() });

/** Admin-only: total in / total out / balance across all recorded entries. */
export async function getAccountingSummary(input: z.infer<typeof summarySchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = summarySchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const entries = await db.query.accountingEntries.findMany({
    where: eq(accountingEntries.organizationId, organizationId),
  });

  let totalIn = 0;
  let totalOut = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount);
    if (entry.type === "entree") totalIn += amount;
    else totalOut += amount;
  }

  return { totalIn, totalOut, balance: totalIn - totalOut };
}
