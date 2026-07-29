/**
 * Integration tests for the animal server actions, run against a real
 * (test) Postgres database. Each run seeds its own uniquely-named
 * organization/users (via a random suffix) and tears them down in
 * afterAll, so the suite can be re-run repeatedly without collisions.
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));
jest.mock("@/lib/uploads", () => ({
  uploadImage: jest.fn().mockResolvedValue("https://storage.example.com/fake-photo.jpg"),
}));
jest.mock("@/lib/push", () => ({
  sendPushToUsers: jest.fn().mockResolvedValue(undefined),
}));

import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
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
  updateAnimalDescription,
  uploadAnimalPhoto,
  changeAnimalStatus,
  updateAnimalHealthChecklist,
  listAnimals,
} from "@/server/actions/animals";
import { createFosterFamily } from "@/server/actions/foster-families";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;
const sendPushToUsersMock = sendPushToUsers as jest.Mock;

describe("animals server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let benevoleUserId: string;
  let outsiderUserId: string;
  let familleAccueilUserId: string;
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
    const [familleAccueil] = await db
      .insert(users)
      .values({ email: `famille-accueil-an-${suffix}@example.com` })
      .returning();
    if (!admin || !benevole || !outsider || !familleAccueil) {
      throw new Error("Seed setup failed: users not created.");
    }
    adminUserId = admin.id;
    benevoleUserId = benevole.id;
    outsiderUserId = outsider.id;
    familleAccueilUserId = familleAccueil.id;

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

    const [faMember] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: familleAccueilUserId })
      .returning();
    if (!faMember) throw new Error("Seed setup failed: famille d'accueil member not created.");
    await db
      .insert(organizationMemberRoles)
      .values({ memberId: faMember.id, role: "famille_accueil" });

    authMock.mockResolvedValue({ user: { id: adminUserId, email: admin.email } });
    const fosterA = await createFosterFamily({
      organizationId,
      firstName: "Famille",
      lastName: `A-${suffix}`,
      hasCats: true,
      hasDogs: false,
      hasRabbits: false,
      linkedUserId: familleAccueilUserId,
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
    await db.delete(users).where(eq(users.id, familleAccueilUserId));
  });

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    sendPushToUsersMock.mockClear();
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
    // The first placement starts on the intake date, not "whenever this row was created".
    expect(placement?.startedAt.toISOString().slice(0, 10)).toBe("2026-01-10");

    // fosterFamilyA is linked to familleAccueilUserId (see beforeAll).
    expect(sendPushToUsersMock).toHaveBeenCalledWith(
      [familleAccueilUserId],
      expect.objectContaining({ title: "Nouvel animal confié", body: expect.stringContaining("Filou") }),
    );
  });

  it("sends no placement notification when the foster family has no linked account", async () => {
    await createAnimal({
      organizationId,
      name: "Sans-Lien",
      species: "chat",
      intakeDate: "2026-01-10",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyBId,
    });

    expect(sendPushToUsersMock).not.toHaveBeenCalled();
  });

  it("sends a placement notification when moving an animal to a linked foster family", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Voyageur",
      species: "chat",
      intakeDate: "2026-01-10",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyBId,
    });
    sendPushToUsersMock.mockClear();

    await changeAnimalStatus({
      animalId: animal.id,
      organizationId,
      status: "en_famille_accueil",
      fosterFamilyId: fosterFamilyAId,
    });

    expect(sendPushToUsersMock).toHaveBeenCalledWith(
      [familleAccueilUserId],
      expect.objectContaining({ title: "Nouvel animal confié", body: expect.stringContaining("Voyageur") }),
    );
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
      placementChangeDate: "2026-02-05",
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
    // The date given for the change, not "whenever this action happened to run".
    expect(oldPlacement?.endedAt?.toISOString().slice(0, 10)).toBe("2026-02-05");

    const newPlacement = await db.query.animalPlacements.findFirst({
      where: and(
        eq(animalPlacements.animalId, animal.id),
        eq(animalPlacements.fosterFamilyId, fosterFamilyBId),
        isNull(animalPlacements.endedAt),
      ),
    });
    expect(newPlacement).toBeDefined();
    expect(newPlacement?.startedAt.toISOString().slice(0, 10)).toBe("2026-02-05");
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

    const closedPlacement = await db.query.animalPlacements.findFirst({
      where: and(eq(animalPlacements.animalId, animal.id), eq(animalPlacements.fosterFamilyId, fosterFamilyAId)),
    });
    // Ends on the adoption date itself, not whenever this action ran.
    expect(closedPlacement?.endedAt?.toISOString().slice(0, 10)).toBe("2026-02-01");
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

  it("lets the responsible famille d'accueil edit the description, but not another animal's", async () => {
    const ownAnimal = await createAnimal({
      organizationId,
      name: "Mistigri",
      species: "chat",
      intakeDate: "2026-01-17",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    const otherAnimal = await createAnimal({
      organizationId,
      name: "Pixel",
      species: "chat",
      intakeDate: "2026-01-17",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyBId,
    });

    authMock.mockResolvedValue({ user: { id: familleAccueilUserId } });
    const updated = await updateAnimalDescription({
      animalId: ownAnimal.id,
      organizationId,
      description: "Très câlin, a peur des aspirateurs.",
    });
    expect(updated.description).toBe("Très câlin, a peur des aspirateurs.");

    await expect(
      updateAnimalDescription({ animalId: otherAnimal.id, organizationId, description: "Pas la mienne" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a bénévole from editing an animal's description", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Nougat",
      species: "chat",
      intakeDate: "2026-01-17",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    authMock.mockResolvedValue({ user: { id: benevoleUserId } });
    await expect(
      updateAnimalDescription({ animalId: animal.id, organizationId, description: "Non autorisé" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lets the responsible famille d'accueil add a photo only when there isn't one yet", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Réglisse",
      species: "chat",
      intakeDate: "2026-01-17",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("animalId", animal.id);
    formData.set("file", new File(["fake"], "photo.jpg", { type: "image/jpeg" }));

    authMock.mockResolvedValue({ user: { id: familleAccueilUserId } });
    const updated = await uploadAnimalPhoto(formData);
    expect(updated.photoUrl).toBe("https://storage.example.com/fake-photo.jpg");

    // A second attempt must be rejected — she can add one, not replace it.
    const secondFormData = new FormData();
    secondFormData.set("organizationId", organizationId);
    secondFormData.set("animalId", animal.id);
    secondFormData.set("file", new File(["fake2"], "photo2.jpg", { type: "image/jpeg" }));
    await expect(uploadAnimalPhoto(secondFormData)).rejects.toThrow(ForbiddenError);
  });

  it("rejects a famille d'accueil from adding a photo to another foster family's animal", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Praline",
      species: "chat",
      intakeDate: "2026-01-17",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyBId,
    });

    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.set("animalId", animal.id);
    formData.set("file", new File(["fake"], "photo.jpg", { type: "image/jpeg" }));

    authMock.mockResolvedValue({ user: { id: familleAccueilUserId } });
    await expect(uploadAnimalPhoto(formData)).rejects.toThrow(ForbiddenError);
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
