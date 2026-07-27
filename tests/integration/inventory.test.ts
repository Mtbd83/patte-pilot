/**
 * Integration tests for the inventory server actions, run against a real
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
  createInventoryItem,
  updateInventoryItem,
  adjustInventoryQuantity,
  deleteInventoryItem,
  listInventoryItems,
} from "@/server/actions/inventory";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;

describe("inventory server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let outsiderUserId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db
      .insert(users)
      .values({ email: `admin-inv-${suffix}@example.com` })
      .returning();
    const [outsider] = await db
      .insert(users)
      .values({ email: `outsider-inv-${suffix}@example.com` })
      .returning();
    if (!admin || !outsider) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    outsiderUserId = outsider.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Stock ${suffix}`, slug: `test-stock-${suffix}` })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    const [member] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: adminUserId })
      .returning();
    if (!member) throw new Error("Seed setup failed: member not created.");
    await db.insert(organizationMemberRoles).values({ memberId: member.id, role: "admin" });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, outsiderUserId));
  });

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
  });

  it("creates an item and computes its initial status", async () => {
    const item = await createInventoryItem({
      organizationId,
      articleName: "Croquettes chaton",
      category: "nourriture",
      animalSpecies: "chat",
      quantity: 20,
      minQuantity: 5,
      unitPrice: 12.9,
    });
    expect(item.status).toBe("ok");
    expect(item.unitPrice).toBe("12.90");
  });

  it("flags a newly created item as rupture when quantity is zero", async () => {
    const item = await createInventoryItem({
      organizationId,
      articleName: "Litière",
      category: "hygiene",
      quantity: 0,
      minQuantity: 2,
    });
    expect(item.status).toBe("rupture");
  });

  it("flags an item as expired even with healthy quantity", async () => {
    const item = await createInventoryItem({
      organizationId,
      articleName: "Vermifuge",
      category: "medical",
      quantity: 30,
      minQuantity: 5,
      expirationDate: "2000-01-01",
    });
    expect(item.status).toBe("expire");
  });

  it("rejects a non-member from creating an item", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(
      createInventoryItem({ organizationId, articleName: "Interdit", category: "autre" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("recomputes status when updating quantity below the minimum", async () => {
    const item = await createInventoryItem({
      organizationId,
      articleName: "Sacs à croquettes",
      category: "nourriture",
      quantity: 20,
      minQuantity: 5,
    });
    const updated = await updateInventoryItem({ itemId: item.id, organizationId, quantity: 3 });
    expect(updated.status).toBe("stock_bas");
  });

  it("adjusts quantity up and down, never going below zero", async () => {
    const item = await createInventoryItem({
      organizationId,
      articleName: "Pipettes antipuces",
      category: "medical",
      quantity: 2,
      minQuantity: 1,
    });

    const increased = await adjustInventoryQuantity({ itemId: item.id, organizationId, delta: 5 });
    expect(increased.quantity).toBe(7);
    expect(increased.status).toBe("ok");

    const decreased = await adjustInventoryQuantity({
      itemId: item.id,
      organizationId,
      delta: -10,
    });
    expect(decreased.quantity).toBe(0);
    expect(decreased.status).toBe("rupture");
  });

  it("deletes an item", async () => {
    const item = await createInventoryItem({
      organizationId,
      articleName: "À supprimer",
      category: "autre",
      quantity: 1,
      minQuantity: 0,
    });
    await deleteInventoryItem({ itemId: item.id, organizationId });
    const items = await listInventoryItems({ organizationId });
    expect(items.find((i) => i.id === item.id)).toBeUndefined();
  });

  it("lists items filtered by category", async () => {
    const items = await listInventoryItems({ organizationId, category: "medical" });
    expect(items.every((i) => i.category === "medical")).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });
});
