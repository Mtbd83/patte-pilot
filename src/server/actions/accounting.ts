"use server";

import { and, desc, eq, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accountingEntries, accountingTypeEnum, accountingCategoryEnum } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, ForbiddenError } from "@/lib/permissions";
import { dateString } from "@/lib/validation";
import { ACCOUNTING_CATEGORIES_BY_TYPE } from "@/lib/accounting-labels";

/** A "sortie" can't take an income-only category ("don"...) and vice versa. */
function refineCategoryMatchesType<T extends { type: (typeof accountingTypeEnum.enumValues)[number]; category: (typeof accountingCategoryEnum.enumValues)[number] }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  if (!ACCOUNTING_CATEGORIES_BY_TYPE[data.type].includes(data.category)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cette catégorie ne correspond pas au type choisi.",
      path: ["category"],
    });
  }
}

const createAccountingEntrySchema = z
  .object({
    organizationId: z.string().uuid(),
    date: dateString,
    type: z.enum(accountingTypeEnum.enumValues),
    category: z.enum(accountingCategoryEnum.enumValues),
    amount: z.coerce.number().positive("Le montant doit être supérieur à 0."),
    animalId: z.string().uuid().optional(),
    comment: z.string().optional(),
  })
  .superRefine(refineCategoryMatchesType);

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

const updateAccountingEntrySchema = z
  .object({
    entryId: z.string().uuid(),
    organizationId: z.string().uuid(),
    date: dateString,
    type: z.enum(accountingTypeEnum.enumValues),
    category: z.enum(accountingCategoryEnum.enumValues),
    amount: z.coerce.number().positive("Le montant doit être supérieur à 0."),
    animalId: z.string().uuid().optional(),
    comment: z.string().optional(),
  })
  .superRefine(refineCategoryMatchesType);

export type UpdateAccountingEntryInput = z.infer<typeof updateAccountingEntrySchema>;

/** Admin-only: edits an existing accounting entry in place. */
export async function updateAccountingEntry(input: UpdateAccountingEntryInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = updateAccountingEntrySchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const existing = await db.query.accountingEntries.findFirst({
    where: and(
      eq(accountingEntries.id, data.entryId),
      eq(accountingEntries.organizationId, data.organizationId),
    ),
  });
  if (!existing) throw new Error("Écriture introuvable.");

  const [entry] = await db
    .update(accountingEntries)
    .set({
      date: data.date,
      type: data.type,
      category: data.category,
      amount: data.amount.toFixed(2),
      animalId: data.animalId ?? null,
      comment: data.comment,
    })
    .where(eq(accountingEntries.id, data.entryId))
    .returning();
  if (!entry) throw new Error("Échec de la mise à jour de l'écriture comptable.");
  return entry;
}

const deleteAccountingEntrySchema = z.object({
  entryId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: removes an accounting entry. */
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

/** Admin-only: lists every accounting entry (no pagination) — used by tests and totals. */
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

const ACCOUNTING_PAGE_SIZE = 20;

const accountingFiltersSchema = z.object({
  organizationId: z.string().uuid(),
  category: z.enum(accountingCategoryEnum.enumValues).optional(),
  animalId: z.string().uuid().optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
});

function accountingFiltersWhere({
  organizationId,
  category,
  animalId,
  dateFrom,
  dateTo,
}: z.infer<typeof accountingFiltersSchema>) {
  const conditions = [eq(accountingEntries.organizationId, organizationId)];
  if (category) conditions.push(eq(accountingEntries.category, category));
  if (animalId) conditions.push(eq(accountingEntries.animalId, animalId));
  if (dateFrom) conditions.push(gte(accountingEntries.date, dateFrom));
  if (dateTo) conditions.push(lte(accountingEntries.date, dateTo));
  return and(...conditions);
}

const listAccountingEntriesPageSchema = accountingFiltersSchema.extend({
  page: z.number().int().min(1).default(1),
});

/**
 * Admin-only: the paginated, filterable entry list used by the Comptabilité
 * page — filters by category, linked animal and/or a date range, 20 entries
 * per page, most recent first.
 */
export async function listAccountingEntriesPage(
  input: z.infer<typeof listAccountingEntriesPageSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, page, ...filters } = listAccountingEntriesPageSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const where = accountingFiltersWhere({ organizationId, ...filters });

  const all = await db.query.accountingEntries.findMany({
    where,
    orderBy: desc(accountingEntries.date),
    with: { animal: true },
  });

  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / ACCOUNTING_PAGE_SIZE));
  const start = (page - 1) * ACCOUNTING_PAGE_SIZE;

  return {
    entries: all.slice(start, start + ACCOUNTING_PAGE_SIZE),
    total,
    page,
    pageSize: ACCOUNTING_PAGE_SIZE,
    totalPages,
  };
}

const entryYearsSchema = z.object({ organizationId: z.string().uuid() });

/** Admin-only: distinct years with at least one entry, most recent first — feeds the period filter. */
export async function listAccountingEntryYears(input: z.infer<typeof entryYearsSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = entryYearsSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const rows = await db.query.accountingEntries.findMany({
    where: eq(accountingEntries.organizationId, organizationId),
    columns: { date: true },
  });

  const years = new Set(rows.map((row) => Number(row.date.slice(0, 4))));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

/** Admin-only: total in / total out / balance — respects the same filters as listAccountingEntriesPage. */
export async function getAccountingSummary(input: z.infer<typeof accountingFiltersSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, ...filters } = accountingFiltersSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const entries = await db.query.accountingEntries.findMany({
    where: accountingFiltersWhere({ organizationId, ...filters }),
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

const totalsByAnimalSchema = z.object({
  organizationId: z.string().uuid(),
  animalIds: z.array(z.string().uuid()),
});

/**
 * Admin-only: net balance (entrées - sorties) per animal, for the given
 * animal ids — used to show a running cost/support total on the Animaux
 * list without pulling every entry for the whole organization.
 */
export async function getAccountingTotalsByAnimal(
  input: z.infer<typeof totalsByAnimalSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, animalIds } = totalsByAnimalSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  if (animalIds.length === 0) return {};

  const entries = await db.query.accountingEntries.findMany({
    where: and(
      eq(accountingEntries.organizationId, organizationId),
      inArray(accountingEntries.animalId, animalIds),
    ),
  });

  const totals: Record<string, number> = {};
  for (const entry of entries) {
    if (!entry.animalId) continue;
    const amount = Number(entry.amount);
    const signed = entry.type === "entree" ? amount : -amount;
    totals[entry.animalId] = (totals[entry.animalId] ?? 0) + signed;
  }
  return totals;
}
