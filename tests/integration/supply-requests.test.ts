/**
 * Integration tests for the supply-request server actions, run against a
 * real (test) Postgres database. Each run seeds its own uniquely-named
 * organization/users/foster-family (via a random suffix) and tears them
 * down in afterAll, so the suite is re-runnable without collisions.
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));
jest.mock("@/lib/push", () => ({
  sendPushToUsers: jest.fn().mockResolvedValue(undefined),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push";
import { db } from "@/db";
import { users, organizations, organizationMembers, organizationMemberRoles, supplyRequests } from "@/db/schema";
import { createFosterFamily } from "@/server/actions/foster-families";
import {
  createSupplyRequest,
  listMySupplyRequests,
  listSupplyRequestsForAdmin,
  markSupplyRequestReceived,
  treatSupplyRequest,
} from "@/server/actions/supply-requests";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;
const sendPushToUsersMock = sendPushToUsers as jest.Mock;

describe("supply request server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let familleAccueilUserId: string;
  let unlinkedFamilleAccueilUserId: string;
  let benevoleUserId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db.insert(users).values({ email: `admin-sr-${suffix}@example.com` }).returning();
    const [familleAccueil] = await db
      .insert(users)
      .values({ email: `fa-sr-${suffix}@example.com` })
      .returning();
    const [unlinkedFamilleAccueil] = await db
      .insert(users)
      .values({ email: `fa-unlinked-sr-${suffix}@example.com` })
      .returning();
    const [benevole] = await db.insert(users).values({ email: `benevole-sr-${suffix}@example.com` }).returning();
    if (!admin || !familleAccueil || !unlinkedFamilleAccueil || !benevole) {
      throw new Error("Seed setup failed: users not created.");
    }
    adminUserId = admin.id;
    familleAccueilUserId = familleAccueil.id;
    unlinkedFamilleAccueilUserId = unlinkedFamilleAccueil.id;
    benevoleUserId = benevole.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Supply ${suffix}`, slug: `test-supply-${suffix}` })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    async function addMember(userId: string, role: "admin" | "famille_accueil" | "benevole") {
      const [member] = await db.insert(organizationMembers).values({ organizationId, userId }).returning();
      if (!member) throw new Error("Seed setup failed: member not created.");
      await db.insert(organizationMemberRoles).values({ memberId: member.id, role });
    }
    await addMember(adminUserId, "admin");
    await addMember(familleAccueilUserId, "famille_accueil");
    await addMember(unlinkedFamilleAccueilUserId, "famille_accueil");
    await addMember(benevoleUserId, "benevole");

    authMock.mockResolvedValue({ user: { id: adminUserId } });
    await createFosterFamily({
      organizationId,
      firstName: "Sophie",
      lastName: `Martin-${suffix}`,
      linkedUserId: familleAccueilUserId,
    });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, familleAccueilUserId));
    await db.delete(users).where(eq(users.id, unlinkedFamilleAccueilUserId));
    await db.delete(users).where(eq(users.id, benevoleUserId));
  });

  beforeEach(() => {
    sendPushToUsersMock.mockClear();
  });

  it("lets a linked famille d'accueil create a request and notifies admins", async () => {
    authMock.mockResolvedValue({ user: { id: familleAccueilUserId } });
    const request = await createSupplyRequest({
      organizationId,
      category: "croquettes_chat",
      quantity: 2,
      comment: "Grain fin de préférence",
    });

    expect(request.status).toBe("en_cours");
    expect(request.quantity).toBe(2);
    expect(sendPushToUsersMock).toHaveBeenCalledWith(
      [adminUserId],
      expect.objectContaining({ title: "Nouvelle demande de fournitures" }),
    );
  });

  it("rejects a famille d'accueil with no linked foster-family record", async () => {
    authMock.mockResolvedValue({ user: { id: unlinkedFamilleAccueilUserId } });
    await expect(
      createSupplyRequest({ organizationId, category: "litiere", quantity: 1 }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a bénévole from creating a supply request", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId } });
    await expect(
      createSupplyRequest({ organizationId, category: "litiere", quantity: 1 }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lists only the caller's own requests, defaults quantity to 1", async () => {
    authMock.mockResolvedValue({ user: { id: familleAccueilUserId } });
    await createSupplyRequest({ organizationId, category: "panier" });

    const mine = await listMySupplyRequests({ organizationId });
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.category !== undefined)).toBe(true);
    const panier = mine.find((r) => r.category === "panier");
    expect(panier?.quantity).toBe(1);
  });

  it("rejects a non-admin from listing all requests", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId } });
    await expect(listSupplyRequestsForAdmin({ organizationId })).rejects.toThrow(ForbiddenError);
  });

  it("admin marks a request received, notifies the requesting family, then treats it (deletes it)", async () => {
    authMock.mockResolvedValue({ user: { id: familleAccueilUserId } });
    const request = await createSupplyRequest({ organizationId, category: "griffoir", quantity: 1 });

    authMock.mockResolvedValue({ user: { id: adminUserId } });
    const asAdmin = await listSupplyRequestsForAdmin({ organizationId });
    expect(asAdmin.some((r) => r.id === request.id && r.fosterFamily.linkedUserId === familleAccueilUserId)).toBe(
      true,
    );

    sendPushToUsersMock.mockClear();
    const received = await markSupplyRequestReceived({ requestId: request.id, organizationId });
    expect(received.status).toBe("pris_en_compte");
    expect(sendPushToUsersMock).toHaveBeenCalledWith(
      [familleAccueilUserId],
      expect.objectContaining({ title: "Demande prise en compte" }),
    );

    await treatSupplyRequest({ requestId: request.id, organizationId });
    const gone = await db.query.supplyRequests.findFirst({ where: eq(supplyRequests.id, request.id) });
    expect(gone).toBeUndefined();
  });

  it("rejects a non-admin from changing or treating a request's status", async () => {
    authMock.mockResolvedValue({ user: { id: familleAccueilUserId } });
    const request = await createSupplyRequest({ organizationId, category: "bac_litiere", quantity: 1 });

    authMock.mockResolvedValue({ user: { id: benevoleUserId } });
    await expect(
      markSupplyRequestReceived({ requestId: request.id, organizationId }),
    ).rejects.toThrow(ForbiddenError);
    await expect(treatSupplyRequest({ requestId: request.id, organizationId })).rejects.toThrow(ForbiddenError);
  });
});
