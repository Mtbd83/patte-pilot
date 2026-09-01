/**
 * Integration tests for the veterinarians server actions, run against a
 * real (test) Postgres database. Geocoding is mocked (no real network call
 * to Nominatim in tests — see src/lib/geocoding.ts).
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));
jest.mock("@/lib/geocoding", () => ({
  geocodeAddress: jest.fn().mockResolvedValue({ latitude: 43.1242, longitude: 5.9280 }),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocoding";
import { db } from "@/db";
import { users, organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import {
  createVeterinarian,
  updateVeterinarian,
  deleteVeterinarian,
  listVeterinarians,
  updateVetTariffsVisibility,
  createVeterinarianTariff,
  updateVeterinarianTariff,
  deleteVeterinarianTariff,
} from "@/server/actions/veterinarians";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;
const geocodeAddressMock = geocodeAddress as unknown as jest.Mock;

describe("veterinarians server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let benevoleUserId: string;
  let familleAccueilUserId: string;
  let outsiderUserId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db.insert(users).values({ email: `admin-vet-${suffix}@example.com` }).returning();
    const [benevole] = await db.insert(users).values({ email: `benevole-vet-${suffix}@example.com` }).returning();
    const [familleAccueil] = await db
      .insert(users)
      .values({ email: `famille-accueil-vet-${suffix}@example.com` })
      .returning();
    const [outsider] = await db.insert(users).values({ email: `outsider-vet-${suffix}@example.com` }).returning();
    if (!admin || !benevole || !familleAccueil || !outsider) {
      throw new Error("Seed setup failed: users not created.");
    }
    adminUserId = admin.id;
    benevoleUserId = benevole.id;
    familleAccueilUserId = familleAccueil.id;
    outsiderUserId = outsider.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Vets ${suffix}`, slug: `test-vets-${suffix}` })
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
    await db.insert(organizationMemberRoles).values({ memberId: benevoleMember.id, role: "benevole" });

    const [faMember] = await db
      .insert(organizationMembers)
      .values({ organizationId, userId: familleAccueilUserId })
      .returning();
    if (!faMember) throw new Error("Seed setup failed: famille d'accueil member not created.");
    await db.insert(organizationMemberRoles).values({ memberId: faMember.id, role: "famille_accueil" });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, benevoleUserId));
    await db.delete(users).where(eq(users.id, familleAccueilUserId));
    await db.delete(users).where(eq(users.id, outsiderUserId));
  });

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    geocodeAddressMock.mockClear();
  });

  it("creates a veterinarian and geocodes its address", async () => {
    const vet = await createVeterinarian({
      organizationId,
      name: "Clinique du Parc",
      address: "12 avenue de la Gare",
      postalCode: "83000",
      city: "Toulon",
      phone: "0400000000",
      notes: "Ouvert le dimanche matin pour les urgences.",
    });
    expect(vet.latitude).toBe(43.1242);
    expect(vet.longitude).toBe(5.928);
    expect(geocodeAddressMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-admin from creating a veterinarian", async () => {
    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(
      createVeterinarian({ organizationId, name: "Clinique interdite" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("re-geocodes when the address changes, not when only the phone changes", async () => {
    const vet = await createVeterinarian({ organizationId, name: "Cabinet Vétérinaire du Port", city: "Toulon" });
    geocodeAddressMock.mockClear();

    await updateVeterinarian({ veterinarianId: vet.id, organizationId, phone: "0400000001" });
    expect(geocodeAddressMock).not.toHaveBeenCalled();

    await updateVeterinarian({ veterinarianId: vet.id, organizationId, city: "Hyères" });
    expect(geocodeAddressMock).toHaveBeenCalledTimes(1);
  });

  it("uses manually-entered coordinates instead of geocoding when both are given", async () => {
    const vet = await createVeterinarian({
      organizationId,
      name: "Clinique Coordonnées Manuelles",
      address: "adresse dont le géocodage échoue",
      latitude: 43.5,
      longitude: 5.5,
    });
    expect(vet.latitude).toBe(43.5);
    expect(vet.longitude).toBe(5.5);
    expect(vet.geocodeError).toBeNull();
    expect(geocodeAddressMock).not.toHaveBeenCalled();
  });

  it("lets an admin fix a vet stuck without coordinates by entering them manually", async () => {
    geocodeAddressMock.mockResolvedValueOnce({ error: "Nominatim a répondu 403 Forbidden" });
    const vet = await createVeterinarian({ organizationId, name: "Sans Coordonnées", address: "adresse en échec" });
    expect(vet.latitude).toBeNull();
    expect(vet.geocodeError).toBe("Nominatim a répondu 403 Forbidden");

    const fixed = await updateVeterinarian({ veterinarianId: vet.id, organizationId, latitude: 43.6, longitude: 5.6 });
    expect(fixed.latitude).toBe(43.6);
    expect(fixed.longitude).toBe(5.6);
  });

  it("deletes a veterinarian", async () => {
    const vet = await createVeterinarian({ organizationId, name: "À supprimer" });
    await deleteVeterinarian({ veterinarianId: vet.id, organizationId });

    const list = await listVeterinarians({ organizationId });
    expect(list.find((v) => v.id === vet.id)).toBeUndefined();
  });

  describe("tariff visibility for famille d'accueil", () => {
    let vetId: string;

    beforeAll(async () => {
      authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
      const vet = await createVeterinarian({ organizationId, name: "Clinique Visibilité" });
      vetId = vet.id;
      await createVeterinarianTariff({
        organizationId,
        veterinarianId: vetId,
        actName: "Consultation",
        price: 30,
      });
    });

    it("admin always sees tariffs regardless of the setting; a bénévole is rejected entirely (admin/famille d'accueil only tab)", async () => {
      await updateVetTariffsVisibility({ organizationId, visible: false });

      authMock.mockResolvedValue({ user: { id: adminUserId } });
      const asAdmin = await listVeterinarians({ organizationId });
      expect(asAdmin.find((v) => v.id === vetId)?.tariffs.length).toBeGreaterThan(0);

      authMock.mockResolvedValue({ user: { id: benevoleUserId } });
      await expect(listVeterinarians({ organizationId })).rejects.toThrow(ForbiddenError);
    });

    it("hides tariffs from famille d'accueil when the org setting is off", async () => {
      await updateVetTariffsVisibility({ organizationId, visible: false });

      authMock.mockResolvedValue({ user: { id: familleAccueilUserId } });
      const list = await listVeterinarians({ organizationId });
      expect(list.find((v) => v.id === vetId)?.tariffs).toEqual([]);
    });

    it("shows tariffs to famille d'accueil once the org setting is on", async () => {
      authMock.mockResolvedValue({ user: { id: adminUserId } });
      await updateVetTariffsVisibility({ organizationId, visible: true });

      authMock.mockResolvedValue({ user: { id: familleAccueilUserId } });
      const list = await listVeterinarians({ organizationId });
      expect(list.find((v) => v.id === vetId)?.tariffs.length).toBeGreaterThan(0);
    });

    it("rejects a non-admin from toggling the visibility setting", async () => {
      authMock.mockResolvedValue({ user: { id: benevoleUserId } });
      await expect(
        updateVetTariffsVisibility({ organizationId, visible: true }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("tariffs CRUD", () => {
    let vetId: string;

    beforeAll(async () => {
      authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
      const vet = await createVeterinarian({ organizationId, name: "Clinique Tarifs" });
      vetId = vet.id;
    });

    it("adds a tariff with an explicit species/sex, and one with the 'toutes/tous' wildcard", async () => {
      const specific = await createVeterinarianTariff({
        organizationId,
        veterinarianId: vetId,
        actName: "Stérilisation",
        species: "chien",
        sex: "femelle",
        price: 180,
      });
      expect(specific.species).toBe("chien");
      expect(specific.sex).toBe("femelle");

      const wildcard = await createVeterinarianTariff({
        organizationId,
        veterinarianId: vetId,
        actName: "Consultation",
        price: 30,
      });
      expect(wildcard.species).toBeNull();
      expect(wildcard.sex).toBeNull();
    });

    it("updates a tariff's price", async () => {
      const tariff = await createVeterinarianTariff({
        organizationId,
        veterinarianId: vetId,
        actName: "Vaccin",
        price: 45,
      });
      const updated = await updateVeterinarianTariff({ tariffId: tariff.id, organizationId, price: 50 });
      expect(Number(updated.price)).toBe(50);
    });

    it("deletes a tariff", async () => {
      const tariff = await createVeterinarianTariff({
        organizationId,
        veterinarianId: vetId,
        actName: "À supprimer",
        price: 10,
      });
      await deleteVeterinarianTariff({ tariffId: tariff.id, organizationId });

      const list = await listVeterinarians({ organizationId });
      const vet = list.find((v) => v.id === vetId);
      expect(vet?.tariffs.find((t) => t.id === tariff.id)).toBeUndefined();
    });

    it("rejects a non-admin from adding a tariff", async () => {
      authMock.mockResolvedValue({ user: { id: benevoleUserId } });
      await expect(
        createVeterinarianTariff({ organizationId, veterinarianId: vetId, actName: "Interdit", price: 10 }),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
