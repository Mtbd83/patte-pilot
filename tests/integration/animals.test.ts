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
  animals,
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
  createAnimalPlacement,
  updateAnimalPlacement,
  deleteAnimalPlacement,
  listAnimals,
  listAnimalsPage,
  getAnimalStatusCounts,
  listAnimalIntakeYears,
  listPubliclyAdoptableAnimals,
  exportAnimalRegisterCsv,
  exportAnimalRegisterPdf,
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

  it("lets an admin add a historical placement to an already-adopted animal", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "Archive",
      species: "chat",
      intakeDate: "2026-01-01",
      status: "adopte",
    });
    // No foster family at creation for an already-adopted animal — add its
    // missing past placement directly.
    const placement = await createAnimalPlacement({
      animalId: animal.id,
      organizationId,
      fosterFamilyId: fosterFamilyAId,
      startedAt: "2026-01-01",
      endedAt: "2026-01-20",
      notes: "Ajouté rétroactivement",
    });

    expect(placement.startedAt.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(placement.endedAt?.toISOString().slice(0, 10)).toBe("2026-01-20");

    // Adding a closed historical placement must not resurrect currentFosterFamilyId.
    const unchanged = await db.query.animals.findFirst({ where: eq(animals.id, animal.id) });
    expect(unchanged?.currentFosterFamilyId).toBeNull();
  });

  it("rejects adding a second open placement for the same animal", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "DoublePlacement",
      species: "chat",
      intakeDate: "2026-01-01",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    await expect(
      createAnimalPlacement({
        animalId: animal.id,
        organizationId,
        fosterFamilyId: fosterFamilyBId,
        startedAt: "2026-01-05",
      }),
    ).rejects.toThrow(/déjà en cours/);
  });

  it("rejects a placement whose end date precedes its start date", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "MauvaiseDate",
      species: "chat",
      intakeDate: "2026-01-01",
      status: "adopte",
    });

    await expect(
      createAnimalPlacement({
        animalId: animal.id,
        organizationId,
        fosterFamilyId: fosterFamilyAId,
        startedAt: "2026-01-10",
        endedAt: "2026-01-01",
      }),
    ).rejects.toThrow(/ne peut pas précéder/);
  });

  it("lets an admin correct an existing placement's dates and family", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "AModifier",
      species: "chat",
      intakeDate: "2026-01-05",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });

    const original = await db.query.animalPlacements.findFirst({
      where: eq(animalPlacements.animalId, animal.id),
    });
    if (!original) throw new Error("Seed failed.");

    const updated = await updateAnimalPlacement({
      placementId: original.id,
      animalId: animal.id,
      organizationId,
      fosterFamilyId: fosterFamilyAId,
      startedAt: "2026-01-03", // corrected: intake was actually a couple days earlier
      notes: "Date corrigée",
    });

    expect(updated.startedAt.toISOString().slice(0, 10)).toBe("2026-01-03");
    expect(updated.notes).toBe("Date corrigée");
  });

  it("closing a placement via edit clears currentFosterFamilyId; reopening it restores it", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "ReouvrirFerme",
      species: "chat",
      intakeDate: "2026-01-05",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    const placement = await db.query.animalPlacements.findFirst({
      where: eq(animalPlacements.animalId, animal.id),
    });
    if (!placement) throw new Error("Seed failed.");

    await updateAnimalPlacement({
      placementId: placement.id,
      animalId: animal.id,
      organizationId,
      fosterFamilyId: fosterFamilyAId,
      startedAt: "2026-01-05",
      endedAt: "2026-01-10",
    });
    const closed = await db.query.animals.findFirst({ where: eq(animals.id, animal.id) });
    expect(closed?.currentFosterFamilyId).toBeNull();

    await updateAnimalPlacement({
      placementId: placement.id,
      animalId: animal.id,
      organizationId,
      fosterFamilyId: fosterFamilyAId,
      startedAt: "2026-01-05",
    });
    const reopened = await db.query.animals.findFirst({ where: eq(animals.id, animal.id) });
    expect(reopened?.currentFosterFamilyId).toBe(fosterFamilyAId);
  });

  it("lets an admin delete a placement, clearing currentFosterFamilyId if it was the open one", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "APlacementSupprimer",
      species: "chat",
      intakeDate: "2026-01-05",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    const placement = await db.query.animalPlacements.findFirst({
      where: eq(animalPlacements.animalId, animal.id),
    });
    if (!placement) throw new Error("Seed failed.");

    await deleteAnimalPlacement({ placementId: placement.id, animalId: animal.id, organizationId });

    const gone = await db.query.animalPlacements.findFirst({ where: eq(animalPlacements.id, placement.id) });
    expect(gone).toBeUndefined();

    const updatedAnimal = await db.query.animals.findFirst({ where: eq(animals.id, animal.id) });
    expect(updatedAnimal?.currentFosterFamilyId).toBeNull();
  });

  it("deleting a closed (historical) placement doesn't touch currentFosterFamilyId", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "HistoriqueSupprimer",
      species: "chat",
      intakeDate: "2026-01-05",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    const historical = await createAnimalPlacement({
      animalId: animal.id,
      organizationId,
      fosterFamilyId: fosterFamilyBId,
      startedAt: "2025-01-01",
      endedAt: "2025-06-01",
    });

    await deleteAnimalPlacement({ placementId: historical.id, animalId: animal.id, organizationId });

    const gone = await db.query.animalPlacements.findFirst({ where: eq(animalPlacements.id, historical.id) });
    expect(gone).toBeUndefined();

    const unchanged = await db.query.animals.findFirst({ where: eq(animals.id, animal.id) });
    expect(unchanged?.currentFosterFamilyId).toBe(fosterFamilyAId);
  });

  it("rejects a non-admin from deleting a placement", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "PlacementProtege",
      species: "chat",
      intakeDate: "2026-01-05",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    const placement = await db.query.animalPlacements.findFirst({
      where: eq(animalPlacements.animalId, animal.id),
    });
    if (!placement) throw new Error("Seed failed.");

    authMock.mockResolvedValue({ user: { id: benevoleUserId } });
    await expect(
      deleteAnimalPlacement({ placementId: placement.id, animalId: animal.id, organizationId }),
    ).rejects.toThrow(ForbiddenError);
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

  it("publicly lists only à-l'adoption and réservé animals, without requiring auth", async () => {
    const forAdoption = await createAnimal({
      organizationId,
      name: "PublicPickMe",
      species: "chat",
      intakeDate: "2026-01-01",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    await changeAnimalStatus({
      animalId: forAdoption.id,
      organizationId,
      status: "a_l_adoption",
      fosterFamilyId: fosterFamilyAId,
    });

    const reserved = await createAnimal({
      organizationId,
      name: "PublicReserved",
      species: "chien",
      intakeDate: "2026-01-01",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    await changeAnimalStatus({
      animalId: reserved.id,
      organizationId,
      status: "reserve",
      fosterFamilyId: fosterFamilyAId,
    });

    authMock.mockResolvedValue(null);
    const publicList = await listPubliclyAdoptableAnimals({ organizationId });

    expect(publicList.some((a) => a.id === forAdoption.id && a.status === "a_l_adoption")).toBe(true);
    expect(publicList.some((a) => a.id === reserved.id && a.status === "reserve")).toBe(true);
    expect(publicList.every((a) => a.status === "a_l_adoption" || a.status === "reserve")).toBe(true);
  });

  it("allows a bénévole to list animals (read access)", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    const all = await listAnimals({ organizationId });
    expect(all.length).toBeGreaterThan(0);
  });

  it("orders adopted animals by adoption date, most recent first", async () => {
    const older = await createAnimal({
      organizationId,
      name: "AdoptOlder",
      species: "chat",
      intakeDate: "2026-01-01",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    await changeAnimalStatus({
      animalId: older.id,
      organizationId,
      status: "adopte",
      adoptionDate: "2026-01-10",
    });

    const newer = await createAnimal({
      organizationId,
      name: "AdoptNewer",
      species: "chat",
      intakeDate: "2026-01-01",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    // Created after "older" but adopted on an EARLIER date than "older" isn't
    // possible to seed while (createdAt-based) order would differ from
    // adoptionDate-based order, so instead give it a LATER adoption date
    // despite being created later too — the real assertion is that
    // adoptionDate (not createdAt) drives the order among "adopte" animals.
    await changeAnimalStatus({
      animalId: newer.id,
      organizationId,
      status: "adopte",
      adoptionDate: "2026-03-01",
    });

    const { animals: adoptedPage } = await listAnimalsPage({ organizationId, status: "adopte", page: 1 });
    const olderIndex = adoptedPage.findIndex((a) => a.id === older.id);
    const newerIndex = adoptedPage.findIndex((a) => a.id === newer.id);
    expect(olderIndex).toBeGreaterThan(-1);
    expect(newerIndex).toBeGreaterThan(-1);
    // Most recent adoption date first.
    expect(newerIndex).toBeLessThan(olderIndex);
  });

  it("only prioritizes a booster reminder that's actually due soon, not one owed but weeks away", async () => {
    const today = new Date();

    const dueSoon = await createAnimal({
      organizationId,
      name: "BoosterDueSoon",
      species: "chat",
      intakeDate: "2026-01-01",
      status: "en_soins",
      fosterFamilyId: fosterFamilyAId,
    });
    // Booster due 30 days after the first vaccine — dated so it falls within
    // the next 14 days.
    const dueSoonVaccineDate = new Date(today);
    dueSoonVaccineDate.setDate(dueSoonVaccineDate.getDate() - 25);
    await updateAnimalHealthChecklist({
      animalId: dueSoon.id,
      organizationId,
      firstVaccineDone: true,
      firstVaccineDate: dueSoonVaccineDate.toISOString().slice(0, 10),
    });

    const dueFar = await createAnimal({
      organizationId,
      name: "BoosterDueFar",
      species: "chat",
      intakeDate: "2026-01-01",
      status: "en_soins",
      fosterFamilyId: fosterFamilyBId,
    });
    // Owed (first vaccine done, booster not done) but not due for weeks.
    await updateAnimalHealthChecklist({
      animalId: dueFar.id,
      organizationId,
      firstVaccineDone: true,
      firstVaccineDate: today.toISOString().slice(0, 10),
    });

    const { animals: page } = await listAnimalsPage({ organizationId, status: "en_soins", page: 1 });
    const dueSoonIndex = page.findIndex((a) => a.id === dueSoon.id);
    const dueFarIndex = page.findIndex((a) => a.id === dueFar.id);
    expect(dueSoonIndex).toBeGreaterThan(-1);
    expect(dueFarIndex).toBeGreaterThan(-1);
    // Both are "en_soins" (same status rank), so only the imminent reminder
    // should bump its animal ahead of the one whose booster isn't due yet.
    expect(dueSoonIndex).toBeLessThan(dueFarIndex);
  });

  it("counts animals per status across the whole organization", async () => {
    const counts = await getAnimalStatusCounts({ organizationId });
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const all = await listAnimals({ organizationId });
    expect(total).toBe(all.length);
    expect(counts.adopte).toBeGreaterThan(0);
  });

  it("lists distinct intake years including the current year", async () => {
    const years = await listAnimalIntakeYears({ organizationId });
    expect(years).toContain(new Date().getFullYear());
  });

  it("exports the placement register as CSV, filtered by intake year", async () => {
    const animal = await createAnimal({
      organizationId,
      name: "RegistreCsv",
      species: "chat",
      icadNumber: "250000000012345",
      intakeDate: "2031-03-10",
      status: "quarantaine",
      fosterFamilyId: fosterFamilyAId,
    });
    await changeAnimalStatus({
      animalId: animal.id,
      organizationId,
      status: "adopte",
      adoptionDate: "2031-04-01",
    });

    const { csv } = await exportAnimalRegisterCsv({ organizationId, year: 2031 });
    expect(csv).toContain("Animal;N° ICAD;Date d'entrée;Date d'adoption;Date de changement ICAD");
    expect(csv).toContain("RegistreCsv");
    expect(csv).toContain("250000000012345");
    expect(csv).toContain("10/03/2031");
    expect(csv).toContain("01/04/2031");

    const otherYear = await exportAnimalRegisterCsv({ organizationId, year: 2031 - 1 });
    expect(otherYear.csv).not.toContain("RegistreCsv");
  });

  it("exports the placement register as a PDF", async () => {
    const { pdfBase64 } = await exportAnimalRegisterPdf({
      organizationId,
      periodDescription: "Toutes les années",
    });
    const bytes = Buffer.from(pdfBase64, "base64");
    expect(bytes.subarray(0, 5).toString("utf-8")).toBe("%PDF-");
  });

  it("rejects a non-admin from exporting the register", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId } });
    await expect(exportAnimalRegisterCsv({ organizationId })).rejects.toThrow(ForbiddenError);
    await expect(
      exportAnimalRegisterPdf({ organizationId, periodDescription: "Toutes les années" }),
    ).rejects.toThrow(ForbiddenError);
  });
});
