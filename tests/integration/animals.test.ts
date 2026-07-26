/**
 * Integration tests for the animal server actions, run against a real
 * (test) Postgres database. Each run seeds its own uniquely-named
 * organization/users (via a random suffix) and tears them down in
 * afterAll, so the suite can be re-run repeatedly without collisions.
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  organizations,
  organizationMembers,
  organizationMemberRoles,
  animalHealthChecklists,
  animalPlacements,
} from "@/db/schema";
import {
  createAnimal,
  updateAnimal,
  changeAnimalStatus,
  updateAnimalHealthChecklist,
  listAnimals,
} from "@/server/actions/animals";
import { createFosterFamily } from "@/server/actions/foster-families";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;

describe("animals server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let benevoleUserId: string;
  let outsiderUserId: string;
  let fosterFamilyAId: string;
  let fosterFamilyBId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db
      .insert(users)
      .values({ email: `admin-an-${suffix}@example.com` })
      .returning();
    const [benevole] = await db
      .insert(users)
      .values({ email: `benevole-an-${suffix}@example.com` })
      .returning();
    const [outsider] = await db
      .insert(users)
      .values({ email: `outsider-an-${suffix}@example.com` })
      .returning();
    if (!admin || !benevole || !outsider) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    benevoleUserId = benevole.id;
    outsiderUserId = outsider.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Animaux ${suffix}`, slug: `test-animaux-${suffix}` })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    const [adminMember] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: adminUserId })
      .returning();
    if (!adminMember) throw new Error("Seed setup failed: admin member not created.");
    await db.insert(organizationMemberRoles).values({ memberId: adminMember.id, role: "admin" });

    const [benevoleMember] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: benevoleUserId })
      .returning();
    if (!benevoleMember) throw new Error("Seed setup failed: bénévole member not created.");
    await db
      .insert(organizationMemberRoles)
      .values({ memberId: benevoleMember.id, role: "benevole" });

    authMock.mockResolvedValue({ user: { id: adminUserId, email: admin.email } });
    const fosterA = await createFosterFamily({
      organizationId,
      firstName: "Famille",
      lastName: `A-${suffix}`,
      hasCats: true,
      hasDogs: false,
      hasRabbits: false,
    });
    fosterFamilyAId = fosterA.id;

    const fosterB = await createFosterFamily({
      organizationId,
      firstName: "Famille",
      lastName: `B-${suffix}`,
      hasCats: false,
      hasDogs: true,
      hasRabbits: false,
    });
    fosterFamilyBId = fosterB.id;
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, benevoleUserId));
    await db.delete(users).where(eq(users.id, outsiderUserId));
  });

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
  });

  it("creates an animal with an initial placement and an empty health checklist", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Filou",
      species: "chat",
      sex: "male",
      intakeDate: "2026-01-10",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    expect(animal.status).toBe("quarantaine");
    expect(animal.currentFosterFamilyId).toBe(fosterFamilyAId);

    const checklist = await db.query.animalHealthChecklists.findFirst({
      where: eq(animalHealthChecklists.animalId, animal.id),
    });
    expect(checklist).toBeDefined();
    expect(checklist?.firstVaccineDone).toBe(false);
    expect(checklist?.sterilizationDone).toBe(false);

    const placement = await db.query.animalPlacements.findFirst({
      where: and(eq(animalPlacements.animalId, animal.id), isNull(animalPlacements.endedAt)),
    });
    expect(placement?.fosterFamilyId).toBe(fosterFamilyAId);
  });

  it("rejects creating an animal in a status that requires a foster family without providing one", async () => {
    await expect(
      createAnimal({
        organizationId,
        name: "SansFamille",
        species: "chat",
        intakeDate: "2026-01-10",
        status: "quarantaine",
      }),
    ).rejects.toThrow(/famille d'accueil est requise/);
  });

  it("rejects a non-member from creating an animal", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });

    await expect(
      createAnimal({
        organizationId,
        name: "Interdit",
        species: "chat",
        intakeDate: "2026-01-11",
        status: "en_soins",
        fosterFamilyId: fosterFamilyAId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a bénévole from creating an animal (admin-only)", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });

    await expect(
      createAnimal({
        organizationId,
        name: "Refuse",
        species: "lapin",
        intakeDate: "2026-01-11",
        status: "en_soins",
        fosterFamilyId: fosterFamilyAId,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("updates descriptive fields without touching status or foster family", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Milo",
      species: "chat",
      intakeDate: "2026-01-12",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    const updated = await updateAnimal({
      animalId: animal.id,
      organizationId,
      breed: "Européen",
      icadNumber: "250269999999999",
    });

    expect(updated.breed).toBe("Européen");
    expect(updated.icadNumber).toBe("250269999999999");
    expect(updated.status).toBe("quarantaine");
    expect(updated.currentFosterFamilyId).toBe(fosterFamilyAId);
  });

  it("moves an animal between foster families, closing the old placement and opening a new one", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Nala",
      species: "chat",
      intakeDate: "2026-01-13",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    const updated = await changeAnimalStatus({
      animalId: animal.id,
      organizationId,
      status: "en_famille_accueil",
      fosterFamilyId: fosterFamilyBId,
    });

    expect(updated.currentFosterFamilyId).toBe(fosterFamilyBId);
    expect(updated.status).toBe("en_famille_accueil");

    const oldPlacement = await db.query.animalPlacements.findFirst({
      where: and(
        eq(animalPlacements.animalId, animal.id),
        eq(animalPlacements.fosterFamilyId, fosterFamilyAId),
      ),
    });
    expect(oldPlacement?.endedAt).not.toBeNull();

    const newPlacement = await db.query.animalPlacements.findFirst({
      where: and(
        eq(animalPlacements.animalId, animal.id),
        eq(animalPlacements.fosterFamilyId, fosterFamilyBId),
        isNull(animalPlacements.endedAt),
      ),
    });
    expect(newPlacement).toBeDefined();
  });

  it("clears the foster family link and sets the adoption date when an animal is adopted", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Pixel",
      species: "chat",
      intakeDate: "2026-01-14",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    const adopted = await changeAnimalStatus({
      animalId: animal.id,
      organizationId,
      status: "adopte",
      adoptionDate: "2026-02-01",
    });

    expect(adopted.status).toBe("adopte");
    expect(adopted.currentFosterFamilyId).toBeNull();
    expect(adopted.adoptionDate).toBe("2026-02-01");

    const openPlacement = await db.query.animalPlacements.findFirst({
      where: and(eq(animalPlacements.animalId, animal.id), isNull(animalPlacements.endedAt)),
    });
    expect(openPlacement).toBeUndefined();
  });

  it("rejects switching to a status that requires a foster family without providing one", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Câlin",
      species: "chat",
      intakeDate: "2026-01-15",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    await expect(
      changeAnimalStatus({ animalId: animal.id, organizationId, status: "reserve" }),
    ).rejects.toThrow(/famille d'accueil est requise/);
  });

  it("updates the health checklist", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Salem",
      species: "chat",
      intakeDate: "2026-01-16",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    const checklist = await updateAnimalHealthChecklist({
      animalId: animal.id,
      organizationId,
      firstVaccineDone: true,
      firstVaccineDate: "2026-01-20",
    });

    expect(checklist.firstVaccineDone).toBe(true);
    expect(checklist.firstVaccineDate).toBe("2026-01-20");
    expect(checklist.sterilizationDone).toBe(false);
  });

  it("lists animals filtered by status", async () => {
    const adopted = await listAnimals({ organizationId, status: "adopte" });
    expect(adopted.every((a) => a.status === "adopte")).toBe(true);
    expect(adopted.some((a) => a.name === "Pixel")).toBe(true);
  });

  it("allows a bénévole to list animals (read access)", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    const all = await listAnimals({ organizationId });
    expect(all.length).toBeGreaterThan(0);
  });
});
