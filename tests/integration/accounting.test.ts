/**
 * Integration tests for the accounting server actions, run against a real
 * (test) Postgres database. Each run seeds its own uniquely-named
 * organization/users and tears them down in afterAll, so the suite is
 * re-runnable without collisions.
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import {
  createAccountingEntry,
  updateAccountingEntry,
  deleteAccountingEntry,
  listAccountingEntries,
  listAccountingEntriesPage,
  listAccountingEntryYears,
  getAccountingSummary,
} from "@/server/actions/accounting";
import { createAnimal } from "@/server/actions/animals";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;

describe("accounting server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let outsiderUserId: string;
  let animalId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db
      .insert(users)
      .values({ email: `admin-acc-${suffix}@example.com` })
      .returning();
    const [outsider] = await db
      .insert(users)
      .values({ email: `outsider-acc-${suffix}@example.com` })
      .returning();
    if (!admin || !outsider) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    outsiderUserId = outsider.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Compta ${suffix}`, slug: `test-compta-${suffix}` })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    const [member] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: adminUserId })
      .returning();
    if (!member) throw new Error("Seed setup failed: member not created.");
    await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });

    authMock.mockResolvedValue({ user: { id: adminUserId, email: admin.email } });
    // "adopte" doesn't require a foster family, so this needs no extra fixture.
    const animal = await createAnimal({
      organizationId,
      name: "Simba",
      species: "chat",
      intakeDate: "2026-01-01",
      status: "adopte",
    });
    animalId = animal.id;
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, outsiderUserId));
  });

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
  });

  it("creates an income entry", async () => {
    const entry = await createAccountingEntry({
      organizationId,
      date: "2026-01-15",
      type: "entree",
      category: "autre",
      amount: 50,
      comment: "Don ponctuel",
    });
    expect(entry.type).toBe("entree");
    expect(entry.amount).toBe("50.00");
  });

  it("creates an expense entry linked to an animal", async () => {
    const entry = await createAccountingEntry({
      organizationId,
      date: "2026-01-16",
      type: "sortie",
      category: "veterinaire",
      amount: 75.5,
      animalId,
      comment: "Consultation",
    });
    expect(entry.animalId).toBe(animalId);
    expect(entry.amount).toBe("75.50");
  });

  it("rejects a non-member from creating an entry", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(
      createAccountingEntry({
        organizationId,
        date: "2026-01-17",
        type: "entree",
        category: "autre",
        amount: 10,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      createAccountingEntry({
        organizationId,
        date: "2026-01-17",
        type: "entree",
        category: "autre",
        amount: 0,
      }),
    ).rejects.toThrow();
  });

  it("lists entries with the linked animal populated", async () => {
    const entries = await listAccountingEntries({ organizationId });
    const withAnimal = entries.find((e) => e.animalId === animalId);
    expect(withAnimal?.animal?.name).toBe("Simba");
  });

  it("computes totals and balance", async () => {
    const summary = await getAccountingSummary({ organizationId });
    expect(summary.totalIn).toBeCloseTo(50);
    expect(summary.totalOut).toBeCloseTo(75.5);
    expect(summary.balance).toBeCloseTo(50 - 75.5);
  });

  it("computes totals scoped to the same filters as the entry list", async () => {
    const filtered = await getAccountingSummary({ organizationId, category: "veterinaire" });
    expect(filtered.totalIn).toBe(0);
    expect(filtered.totalOut).toBeCloseTo(75.5);

    const filteredByAnimal = await getAccountingSummary({ organizationId, animalId });
    expect(filteredByAnimal.totalOut).toBeCloseTo(75.5);
  });

  it("deletes an entry", async () => {
    const entry = await createAccountingEntry({
      organizationId,
      date: "2026-01-18",
      type: "entree",
      category: "autre",
      amount: 20,
    });
    await deleteAccountingEntry({ entryId: entry.id, organizationId });
    const entries = await listAccountingEntries({ organizationId });
    expect(entries.find((e) => e.id === entry.id)).toBeUndefined();
  });

  it("rejects a category that doesn't match the type", async () => {
    await expect(
      createAccountingEntry({
        organizationId,
        date: "2026-01-19",
        type: "sortie",
        category: "don",
        amount: 15,
      }),
    ).rejects.toThrow();
  });

  it("updates an entry in place", async () => {
    const entry = await createAccountingEntry({
      organizationId,
      date: "2026-01-20",
      type: "entree",
      category: "don",
      amount: 30,
      comment: "Avant modif",
    });

    const updated = await updateAccountingEntry({
      entryId: entry.id,
      organizationId,
      date: "2026-01-21",
      type: "entree",
      category: "adhesion",
      amount: 45,
      comment: "Après modif",
    });

    expect(updated.date).toBe("2026-01-21");
    expect(updated.category).toBe("adhesion");
    expect(updated.amount).toBe("45.00");
    expect(updated.comment).toBe("Après modif");

    await deleteAccountingEntry({ entryId: entry.id, organizationId });
  });

  it("rejects a non-admin from updating an entry", async () => {
    const entry = await createAccountingEntry({
      organizationId,
      date: "2026-01-22",
      type: "entree",
      category: "don",
      amount: 10,
    });

    authMock.mockResolvedValue({ user: { id: outsiderUserId } });
    await expect(
      updateAccountingEntry({
        entryId: entry.id,
        organizationId,
        date: "2026-01-22",
        type: "entree",
        category: "don",
        amount: 20,
      }),
    ).rejects.toThrow(ForbiddenError);

    authMock.mockResolvedValue({ user: { id: adminUserId } });
    await deleteAccountingEntry({ entryId: entry.id, organizationId });
  });

  it("lists distinct years with at least the current year", async () => {
    const years = await listAccountingEntryYears({ organizationId });
    expect(years).toContain(2026);
  });

  it("paginates filtered entries at 20 per page", async () => {
    const seeded = [];
    for (let i = 0; i < 25; i += 1) {
      const day = String(i + 1).padStart(2, "0");
      seeded.push(
        await createAccountingEntry({
          organizationId,
          date: `2026-06-${day}`,
          type: "entree",
          category: "adhesion",
          amount: 10 + i,
          comment: `Pagination-${i}`,
        }),
      );
    }

    const firstPage = await listAccountingEntriesPage({
      organizationId,
      category: "adhesion",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      page: 1,
    });
    expect(firstPage.total).toBe(25);
    expect(firstPage.entries).toHaveLength(20);
    expect(firstPage.totalPages).toBe(2);

    const secondPage = await listAccountingEntriesPage({
      organizationId,
      category: "adhesion",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      page: 2,
    });
    expect(secondPage.entries).toHaveLength(5);

    await Promise.all(seeded.map((entry) => deleteAccountingEntry({ entryId: entry.id, organizationId })));
  });

  it("filters entries by linked animal", async () => {
    const entry = await createAccountingEntry({
      organizationId,
      date: "2026-07-01",
      type: "sortie",
      category: "veterinaire",
      amount: 12,
      animalId,
    });

    const filtered = await listAccountingEntriesPage({ organizationId, animalId, page: 1 });
    expect(filtered.entries.some((e) => e.id === entry.id)).toBe(true);
    expect(filtered.entries.every((e) => e.animalId === animalId)).toBe(true);

    await deleteAccountingEntry({ entryId: entry.id, organizationId });
  });
});
