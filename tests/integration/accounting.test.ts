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
  deleteAccountingEntry,
  listAccountingEntries,
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
});
