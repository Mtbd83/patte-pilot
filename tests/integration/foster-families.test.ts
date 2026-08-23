/**
 * Integration tests for the foster-family server actions, run against a
 * real (test) Postgres database. Each run seeds its own uniquely-named
 * organization/users (via a random suffix) and tears them down in
 * afterAll, so the suite can be re-run repeatedly without collisions.
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
  createFosterFamily,
  updateFosterFamily,
  deactivateFosterFamily,
  reactivateFosterFamily,
  listFosterFamilies,
} from "@/server/actions/foster-families";
import { createAnimal, changeAnimalStatus } from "@/server/actions/animals";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;

describe("foster families server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let outsiderUserId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db
      .insert(users)
      .values({ email: `admin-ff-${suffix}@example.com` })
      .returning();
    const [outsider] = await db
      .insert(users)
      .values({ email: `outsider-ff-${suffix}@example.com` })
      .returning();
    if (!admin || !outsider) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    outsiderUserId = outsider.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test FA ${suffix}`, slug: `test-fa-${suffix}` })
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

  it("creates and updates a foster family", async () => {
    const fosterFamily = await createFosterFamily({
      organizationId,
      firstName: "Jeanne",
      lastName: "Dupont",
      hasCats: true,
      hasDogs: false,
      hasRabbits: false,
    });
    expect(fosterFamily.hasCats).toBe(true);
    expect(fosterFamily.isActive).toBe(true);

    const updated = await updateFosterFamily({
      fosterFamilyId: fosterFamily.id,
      organizationId,
      phone: "0600000000",
    });
    expect(updated.phone).toBe("0600000000");
    expect(updated.lastName).toBe("Dupont");
  });

  it("rejects a non-member from creating a foster family", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });

    await expect(
      createFosterFamily({
        organizationId,
        firstName: "Interdit",
        lastName: "Interdit",
        hasCats: false,
        hasDogs: false,
        hasRabbits: false,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("refuses to deactivate a foster family currently hosting an animal, then allows it once freed", async () => {
    const fosterFamily = await createFosterFamily({
      organizationId,
      firstName: "Marc",
      lastName: "Martin",
      hasCats: false,
      hasDogs: true,
      hasRabbits: false,
    });

    const animal = await createAnimal({
      organizationId,
      name: "Rex",
      species: "chien",
      sex: "male",
      intakeDate: "2026-02-01",
      status: "en_soins",
      fosterFamilyId: fosterFamily.id,
    });

    await expect(
      deactivateFosterFamily({ fosterFamilyId: fosterFamily.id, organizationId }),
    ).rejects.toThrow(/actuellement hébergé/);

    await changeAnimalStatus({
      animalId: animal.id,
      organizationId,
      status: "adopte",
    });

    const deactivated = await deactivateFosterFamily({
      fosterFamilyId: fosterFamily.id,
      organizationId,
    });
    expect(deactivated.isActive).toBe(false);
  });

  it("reactivates a deactivated foster family", async () => {
    const fosterFamily = await createFosterFamily({
      organizationId,
      firstName: "Sophie",
      lastName: "Bernard",
      hasCats: true,
      hasDogs: false,
      hasRabbits: false,
    });

    const deactivated = await deactivateFosterFamily({
      fosterFamilyId: fosterFamily.id,
      organizationId,
    });
    expect(deactivated.isActive).toBe(false);

    const reactivated = await reactivateFosterFamily({
      fosterFamilyId: fosterFamily.id,
      organizationId,
    });
    expect(reactivated.isActive).toBe(true);
  });

  it("rejects a non-member from reactivating a foster family", async () => {
    const fosterFamily = await createFosterFamily({
      organizationId,
      firstName: "Interdit",
      lastName: "Reactivation",
      hasCats: false,
      hasDogs: false,
      hasRabbits: false,
    });
    await deactivateFosterFamily({ fosterFamilyId: fosterFamily.id, organizationId });

    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });

    await expect(
      reactivateFosterFamily({ fosterFamilyId: fosterFamily.id, organizationId }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lists only active foster families by default, and all of them with includeInactive", async () => {
    const activeOnly = await listFosterFamilies({ organizationId, includeInactive: false });
    expect(activeOnly.every((f) => f.isActive)).toBe(true);

    const all = await listFosterFamilies({ organizationId, includeInactive: true });
    expect(all.length).toBeGreaterThanOrEqual(activeOnly.length);
    expect(all.some((f) => f.isActive === false)).toBe(true);
  });
});
