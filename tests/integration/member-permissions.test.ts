/**
 * Integration tests for granular bénévole permissions: a bénévole holds
 * zero permissions by default, an admin can grant any subset of the five
 * (cumulable), "contrat" cannot stand without "candidature", and removing
 * the "benevole" role clears any permissions that member held.
 *
 * Runs against a real (test) Postgres database — each run seeds its own
 * uniquely-named organization/users (via a random suffix) and tears them
 * down in afterAll, so the suite can be re-run repeatedly without
 * collisions.
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import { updateMemberRoles } from "@/server/actions/members";
import {
  ForbiddenError,
  getMemberPermissions,
  requireAdminOrPermission,
} from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;

describe("bénévole granular permissions", () => {
  let organizationId: string;
  let adminUserId: string;
  let benevoleUserId: string;
  let benevoleMemberId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db
      .insert(users)
      .values({ email: `admin-perm-${suffix}@example.com` })
      .returning();
    const [benevole] = await db
      .insert(users)
      .values({ email: `benevole-perm-${suffix}@example.com` })
      .returning();
    if (!admin || !benevole) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    benevoleUserId = benevole.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Perm ${suffix}`, slug: `test-perm-${suffix}` })
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
    if (!benevoleMember) throw new Error("Seed setup failed: benevole member not created.");
    benevoleMemberId = benevoleMember.id;
    await db.insert(organizationMemberRoles).values({ memberId: benevoleMemberId, role: "benevole" });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, benevoleUserId));
  });

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
  });

  it("starts a bénévole with zero permissions", async () => {
    const permissions = await getMemberPermissions(benevoleUserId, organizationId);
    expect(permissions).toEqual([]);
  });

  it("always lets an admin through requireAdminOrPermission, even without the permission", async () => {
    await expect(
      requireAdminOrPermission(adminUserId, organizationId, "comptabilite"),
    ).resolves.toBeUndefined();
  });

  it("rejects a bénévole without the permission, then allows it once granted", async () => {
    await expect(
      requireAdminOrPermission(benevoleUserId, organizationId, "prise_en_charge"),
    ).rejects.toThrow(ForbiddenError);

    await updateMemberRoles({
      organizationId,
      memberId: benevoleMemberId,
      roles: ["benevole"],
      permissions: ["prise_en_charge"],
    });

    await expect(
      requireAdminOrPermission(benevoleUserId, organizationId, "prise_en_charge"),
    ).resolves.toBeUndefined();
  });

  it("accumulates multiple permissions for the same bénévole", async () => {
    await updateMemberRoles({
      organizationId,
      memberId: benevoleMemberId,
      roles: ["benevole"],
      permissions: ["prise_en_charge", "comptabilite", "gestion_famille_accueil"],
    });

    const permissions = await getMemberPermissions(benevoleUserId, organizationId);
    expect(permissions.sort()).toEqual(["comptabilite", "gestion_famille_accueil", "prise_en_charge"].sort());
  });

  it("rejects granting 'contrat' without 'candidature'", async () => {
    await expect(
      updateMemberRoles({
        organizationId,
        memberId: benevoleMemberId,
        roles: ["benevole"],
        permissions: ["contrat"],
      }),
    ).rejects.toThrow(/Candidature/);
  });

  it("allows 'contrat' once 'candidature' is also granted", async () => {
    await updateMemberRoles({
      organizationId,
      memberId: benevoleMemberId,
      roles: ["benevole"],
      permissions: ["candidature", "contrat"],
    });

    const permissions = await getMemberPermissions(benevoleUserId, organizationId);
    expect(permissions.sort()).toEqual(["candidature", "contrat"].sort());
  });

  it("clears permissions once the 'benevole' role is removed", async () => {
    await updateMemberRoles({
      organizationId,
      memberId: benevoleMemberId,
      roles: ["benevole"],
      permissions: ["comptabilite"],
    });
    expect(await getMemberPermissions(benevoleUserId, organizationId)).toEqual(["comptabilite"]);

    await updateMemberRoles({
      organizationId,
      memberId: benevoleMemberId,
      roles: ["famille_accueil"],
      permissions: ["comptabilite"],
    });

    expect(await getMemberPermissions(benevoleUserId, organizationId)).toEqual([]);

    // Restore the benevole role for any subsequent test run ordering.
    await updateMemberRoles({
      organizationId,
      memberId: benevoleMemberId,
      roles: ["benevole"],
    });
  });

  it("rejects a non-admin from calling updateMemberRoles", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });

    await expect(
      updateMemberRoles({
        organizationId,
        memberId: benevoleMemberId,
        roles: ["benevole"],
        permissions: ["comptabilite"],
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
