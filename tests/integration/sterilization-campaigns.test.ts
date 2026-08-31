/**
 * Integration tests for the sterilization-campaign server actions, run
 * against a real (test) Postgres database. Each run seeds its own
 * uniquely-named organization/users (via a random suffix) and tears them
 * down in afterAll, so the suite can be re-run repeatedly without
 * collisions. Image upload is mocked (no real storage call in tests).
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));
jest.mock("@/lib/uploads", () => ({
  uploadImage: jest.fn().mockResolvedValue("https://storage.example.com/fake-voucher-photo.jpg"),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import {
  createSterilizationCampaign,
  updateSterilizationCampaign,
  listSterilizationCampaigns,
  getSterilizationCampaign,
  createSterilizationVoucher,
  updateSterilizationVoucher,
  deleteSterilizationVoucher,
  listAssignableCampaignVolunteers,
  listCampaignVolunteers,
  assignCampaignVolunteer,
  unassignCampaignVolunteer,
} from "@/server/actions/sterilization-campaigns";
import { updateSterilizationCampaignModule } from "@/server/actions/organizations";
import { updateMemberRoles } from "@/server/actions/members";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;

describe("sterilization campaign server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let benevoleUserId: string;
  let benevoleMemberId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db.insert(users).values({ email: `admin-ster-${suffix}@example.com` }).returning();
    const [benevole] = await db.insert(users).values({ email: `benevole-ster-${suffix}@example.com` }).returning();
    if (!admin || !benevole) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    benevoleUserId = benevole.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Ster ${suffix}`, slug: `test-ster-${suffix}` })
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
    benevoleMemberId = benevoleMember.id;
    await db.insert(organizationMemberRoles).values({ memberId: benevoleMember.id, role: "benevole" });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, benevoleUserId));
  });

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
  });

  it("toggles the module, off by default", async () => {
    const before = await db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) });
    expect(before?.sterilizationCampaignModuleEnabled).toBe(false);

    await updateSterilizationCampaignModule({ organizationId, enabled: true });
    const after = await db.query.organizations.findFirst({ where: eq(organizations.id, organizationId) });
    expect(after?.sterilizationCampaignModuleEnabled).toBe(true);
  });

  it("rejects a non-admin from toggling the module", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    await expect(
      updateSterilizationCampaignModule({ organizationId, enabled: true }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("creates a campaign with an undifferentiated voucher quota", async () => {
    const campaign = await createSterilizationCampaign({
      organizationId,
      city: "Marseille",
      partner: "spa",
      vetName: "Dr. Test Sterilization",
      voucherQuotaTotal: 20,
    });
    expect(campaign.city).toBe("Marseille");
    expect(campaign.voucherQuotaTotal).toBe(20);
    expect(campaign.voucherQuotaMale).toBeNull();
  });

  it("creates a campaign with a male/female voucher split", async () => {
    const campaign = await createSterilizationCampaign({
      organizationId,
      city: "Aix-en-Provence",
      partner: "fondation_brigitte_bardot",
      vetName: "Dr. Test Sterilization",
      voucherQuotaTotal: 10,
      voucherQuotaMale: 4,
      voucherQuotaFemale: 6,
    });
    expect(campaign.voucherQuotaMale).toBe(4);
    expect(campaign.voucherQuotaFemale).toBe(6);
  });

  it("rejects a male/female split that doesn't sum to the total", async () => {
    await expect(
      createSterilizationCampaign({
        organizationId,
        city: "Toulon",
        partner: "trente_millions_damis",
        vetName: "Dr. Test Sterilization",
        voucherQuotaTotal: 10,
        voucherQuotaMale: 4,
        voucherQuotaFemale: 4,
      }),
    ).rejects.toThrow(/somme des bons/);
  });

  it("rejects a non-admin from creating a campaign", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    await expect(
      createSterilizationCampaign({
        organizationId,
        city: "Interdit",
        partner: "spa",
        vetName: "Dr. Test Sterilization",
        voucherQuotaTotal: 5,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lists campaigns with their voucher count, and logs/edits/deletes vouchers", async () => {
    const campaign = await createSterilizationCampaign({
      organizationId,
      city: "Gap",
      partner: "spa",
      vetName: "Dr. Test Sterilization",
      voucherQuotaTotal: 3,
    });

    const voucherFormData = new FormData();
    voucherFormData.set("campaignId", campaign.id);
    voucherFormData.set("organizationId", organizationId);
    voucherFormData.set("voucherNumber", "001");
    voucherFormData.set("identificationNumber", "250000000000001");
    voucherFormData.set("date", "2026-02-01");
    voucherFormData.set("sex", "femelle");
    voucherFormData.set("file", new File(["fake"], "chat.jpg", { type: "image/jpeg" }));

    const voucher = await createSterilizationVoucher(voucherFormData);
    expect(voucher.voucherNumber).toBe("001");
    expect(voucher.photoUrl).toBe("https://storage.example.com/fake-voucher-photo.jpg");

    const list = await listSterilizationCampaigns({ organizationId });
    const listed = list.find((c) => c.id === campaign.id);
    expect(listed?.vouchers.length).toBe(1);

    const detail = await getSterilizationCampaign({ campaignId: campaign.id, organizationId });
    expect(detail.vouchers[0]?.identificationNumber).toBe("250000000000001");

    const updateFormData = new FormData();
    updateFormData.set("voucherId", voucher.id);
    updateFormData.set("organizationId", organizationId);
    updateFormData.set("voucherNumber", "001-bis");
    updateFormData.set("identificationNumber", "250000000000001");
    updateFormData.set("date", "2026-02-02");
    updateFormData.set("sex", "male");

    const updatedVoucher = await updateSterilizationVoucher(updateFormData);
    expect(updatedVoucher.voucherNumber).toBe("001-bis");
    expect(updatedVoucher.sex).toBe("male");
    // No new file provided — the existing photo is kept, not cleared.
    expect(updatedVoucher.photoUrl).toBe("https://storage.example.com/fake-voucher-photo.jpg");

    await deleteSterilizationVoucher({ voucherId: voucher.id, organizationId });
    const afterDelete = await getSterilizationCampaign({ campaignId: campaign.id, organizationId });
    expect(afterDelete.vouchers.length).toBe(0);
  });

  it("lets an admin edit a campaign's own fields", async () => {
    const campaign = await createSterilizationCampaign({
      organizationId,
      city: "Digne",
      partner: "spa",
      vetName: "Dr. Test Sterilization",
      voucherQuotaTotal: 5,
    });

    const updated = await updateSterilizationCampaign({
      campaignId: campaign.id,
      organizationId,
      city: "Digne-les-Bains",
      voucherQuotaTotal: 8,
    });
    expect(updated.city).toBe("Digne-les-Bains");
    expect(updated.voucherQuotaTotal).toBe(8);
    expect(updated.partner).toBe("spa");
  });

  describe("per-campaign bénévole access (campagne_sterilisation permission)", () => {
    it("gives a bénévole with the permission but no assignment an empty list, and rejects direct access", async () => {
      await updateMemberRoles({
        organizationId,
        memberId: benevoleMemberId,
        roles: ["benevole"],
        permissions: ["campagne_sterilisation"],
      });

      const campaign = await createSterilizationCampaign({
        organizationId,
        city: "Briançon",
        partner: "spa",
        vetName: "Dr. Test Sterilization",
        voucherQuotaTotal: 4,
      });

      authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });

      const list = await listSterilizationCampaigns({ organizationId });
      expect(list.some((c) => c.id === campaign.id)).toBe(false);

      await expect(
        getSterilizationCampaign({ campaignId: campaign.id, organizationId }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejects assigning a member who doesn't hold the permission", async () => {
      const [otherBenevole] = await db
        .insert(users)
        .values({ email: `no-permission-${randomUUID().slice(0, 8)}@example.com` })
        .returning();
      const [otherMember] = await db
        .insert(organizationMembers)
        .values({ organizationId, userId: otherBenevole!.id })
        .returning();
      await db.insert(organizationMemberRoles).values({ memberId: otherMember!.id, role: "benevole" });

      const campaign = await createSterilizationCampaign({
        organizationId,
        city: "Sisteron",
        partner: "spa",
        vetName: "Dr. Test Sterilization",
        voucherQuotaTotal: 4,
      });

      await expect(
        assignCampaignVolunteer({ campaignId: campaign.id, organizationId, memberId: otherMember!.id }),
      ).rejects.toThrow(/Campagne stérilisation/);

      await db.delete(organizationMembers).where(eq(organizationMembers.id, otherMember!.id));
      await db.delete(users).where(eq(users.id, otherBenevole!.id));
    });

    it("grants access to an assigned campaign only, and revokes it on unassignment", async () => {
      const assignedCampaign = await createSterilizationCampaign({
        organizationId,
        city: "Embrun",
        partner: "spa",
        vetName: "Dr. Test Sterilization",
        voucherQuotaTotal: 4,
      });
      const otherCampaign = await createSterilizationCampaign({
        organizationId,
        city: "Barcelonnette",
        partner: "spa",
        vetName: "Dr. Test Sterilization",
        voucherQuotaTotal: 4,
      });

      const assignable = await listAssignableCampaignVolunteers({ organizationId });
      expect(assignable.some((v) => v.id === benevoleMemberId)).toBe(true);

      await assignCampaignVolunteer({
        campaignId: assignedCampaign.id,
        organizationId,
        memberId: benevoleMemberId,
      });

      const volunteers = await listCampaignVolunteers({ campaignId: assignedCampaign.id, organizationId });
      expect(volunteers.some((v) => v.memberId === benevoleMemberId)).toBe(true);

      authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });

      const list = await listSterilizationCampaigns({ organizationId });
      expect(list.some((c) => c.id === assignedCampaign.id)).toBe(true);
      expect(list.some((c) => c.id === otherCampaign.id)).toBe(false);

      const detail = await getSterilizationCampaign({ campaignId: assignedCampaign.id, organizationId });
      expect(detail.city).toBe("Embrun");

      await expect(
        getSterilizationCampaign({ campaignId: otherCampaign.id, organizationId }),
      ).rejects.toThrow(ForbiddenError);

      const voucherFormData = new FormData();
      voucherFormData.set("campaignId", assignedCampaign.id);
      voucherFormData.set("organizationId", organizationId);
      voucherFormData.set("voucherNumber", "B-01");
      voucherFormData.set("identificationNumber", "250000000000099");
      voucherFormData.set("date", "2026-03-01");
      voucherFormData.set("sex", "male");
      const voucher = await createSterilizationVoucher(voucherFormData);
      expect(voucher.voucherNumber).toBe("B-01");

      const otherVoucherFormData = new FormData();
      otherVoucherFormData.set("campaignId", otherCampaign.id);
      otherVoucherFormData.set("organizationId", organizationId);
      otherVoucherFormData.set("voucherNumber", "C-01");
      otherVoucherFormData.set("identificationNumber", "250000000000098");
      otherVoucherFormData.set("date", "2026-03-01");
      otherVoucherFormData.set("sex", "male");
      await expect(createSterilizationVoucher(otherVoucherFormData)).rejects.toThrow(ForbiddenError);

      authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
      await unassignCampaignVolunteer({
        campaignId: assignedCampaign.id,
        organizationId,
        memberId: benevoleMemberId,
      });

      authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
      await expect(
        getSterilizationCampaign({ campaignId: assignedCampaign.id, organizationId }),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
