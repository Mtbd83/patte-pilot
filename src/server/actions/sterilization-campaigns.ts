"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  sterilizationCampaigns,
  sterilizationVouchers,
  sterilizationCampaignVolunteers,
  sterilizationPartnerEnum,
  organizationMembers,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireAdmin, requireAdminOrPermission, getMemberRoles, getMemberPermissions, ForbiddenError } from "@/lib/permissions";
import { dateString } from "@/lib/validation";
import { uploadImage } from "@/lib/uploads";

/**
 * Admin, or bénévole holding "campagne_sterilisation" AND assigned to this
 * specific campaign (see sterilizationCampaignVolunteers) — holding the
 * permission alone only unlocks the tab, not any particular campaign.
 */
async function requireAdminOrCampaignAccess(userId: string, organizationId: string, campaignId: string) {
  const roles = await getMemberRoles(userId, organizationId);
  if (roles.includes("admin")) return;

  const permissions = await getMemberPermissions(userId, organizationId);
  if (!permissions.includes("campagne_sterilisation")) {
    throw new ForbiddenError(
      "Cette action nécessite le droit \"Campagne stérilisation\" (ou d'être administrateur·rice) dans cette organisation.",
    );
  }

  const member = await db.query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, organizationId)),
  });
  const assignment = member
    ? await db.query.sterilizationCampaignVolunteers.findFirst({
        where: and(
          eq(sterilizationCampaignVolunteers.campaignId, campaignId),
          eq(sterilizationCampaignVolunteers.memberId, member.id),
        ),
      })
    : null;
  if (!assignment) {
    throw new ForbiddenError("Vous n'êtes pas assigné·e à cette campagne.");
  }
}

const createSterilizationCampaignSchema = z
  .object({
    organizationId: z.string().uuid(),
    city: z.string().min(1).max(120),
    partner: z.enum(sterilizationPartnerEnum.enumValues),
    vetName: z.string().min(1).max(200),
    vetAddress: z.string().optional(),
    vetPhone: z.string().max(30).optional(),
    voucherQuotaTotal: z.coerce.number().int().min(1),
    voucherQuotaMale: z.coerce.number().int().min(0).optional(),
    voucherQuotaFemale: z.coerce.number().int().min(0).optional(),
  })
  .refine(
    (data) =>
      data.voucherQuotaMale === undefined ||
      data.voucherQuotaFemale === undefined ||
      data.voucherQuotaMale + data.voucherQuotaFemale === data.voucherQuotaTotal,
    {
      message: "La somme des bons mâles et femelles doit être égale au nombre total de bons.",
      path: ["voucherQuotaFemale"],
    },
  );

export type CreateSterilizationCampaignInput = z.infer<typeof createSterilizationCampaignSchema>;

/** Admin-only: creates a new sterilization campaign ("Campagne de stérilisation Chat Libre"). */
export async function createSterilizationCampaign(input: CreateSterilizationCampaignInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createSterilizationCampaignSchema.parse(input);
  await requireAdmin(session.user.id, data.organizationId);

  const [campaign] = await db.insert(sterilizationCampaigns).values(data).returning();
  if (!campaign) throw new Error("Échec de la création de la campagne.");
  return campaign;
}

const updateSterilizationCampaignSchema = z
  .object({
    campaignId: z.string().uuid(),
    organizationId: z.string().uuid(),
    city: z.string().min(1).max(120).optional(),
    partner: z.enum(sterilizationPartnerEnum.enumValues).optional(),
    vetName: z.string().min(1).max(200).optional(),
    vetAddress: z.string().optional(),
    vetPhone: z.string().max(30).optional(),
    voucherQuotaTotal: z.coerce.number().int().min(1).optional(),
    voucherQuotaMale: z.coerce.number().int().min(0).nullable().optional(),
    voucherQuotaFemale: z.coerce.number().int().min(0).nullable().optional(),
  })
  .refine(
    (data) =>
      !data.voucherQuotaMale ||
      !data.voucherQuotaFemale ||
      !data.voucherQuotaTotal ||
      data.voucherQuotaMale + data.voucherQuotaFemale === data.voucherQuotaTotal,
    {
      message: "La somme des bons mâles et femelles doit être égale au nombre total de bons.",
      path: ["voucherQuotaFemale"],
    },
  );

export type UpdateSterilizationCampaignInput = z.infer<typeof updateSterilizationCampaignSchema>;

/** Admin-only: updates a campaign's own details (its bénévole assignments are managed separately). */
export async function updateSterilizationCampaign(input: UpdateSterilizationCampaignInput) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { campaignId, organizationId, ...rest } = updateSterilizationCampaignSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const campaign = await db.query.sterilizationCampaigns.findFirst({
    where: and(eq(sterilizationCampaigns.id, campaignId), eq(sterilizationCampaigns.organizationId, organizationId)),
  });
  if (!campaign) throw new Error("Campagne introuvable.");

  const [updated] = await db
    .update(sterilizationCampaigns)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(sterilizationCampaigns.id, campaignId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour de la campagne.");
  return updated;
}

const listSterilizationCampaignsSchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * Admin, or bénévole with "campagne_sterilisation": lists sterilization
 * campaigns, most recent first, with their vet and voucher count. An admin
 * sees every campaign; a bénévole only the ones she's assigned to.
 */
export async function listSterilizationCampaigns(
  input: z.infer<typeof listSterilizationCampaignsSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listSterilizationCampaignsSchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "campagne_sterilisation");

  const roles = await getMemberRoles(session.user.id, organizationId);
  const all = await db.query.sterilizationCampaigns.findMany({
    where: eq(sterilizationCampaigns.organizationId, organizationId),
    orderBy: (campaigns, { desc }) => [desc(campaigns.createdAt)],
    with: { vouchers: { columns: { id: true } }, volunteers: true },
  });

  if (roles.includes("admin")) return all;

  const member = await db.query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.userId, session.user.id), eq(organizationMembers.organizationId, organizationId)),
  });
  if (!member) return [];

  return all.filter((campaign) => campaign.volunteers.some((v) => v.memberId === member.id));
}

const getSterilizationCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin, or bénévole assigned to this campaign: its vet and full voucher list, most recent first. */
export async function getSterilizationCampaign(input: z.infer<typeof getSterilizationCampaignSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { campaignId, organizationId } = getSterilizationCampaignSchema.parse(input);
  await requireAdminOrCampaignAccess(session.user.id, organizationId, campaignId);

  const campaign = await db.query.sterilizationCampaigns.findFirst({
    where: and(eq(sterilizationCampaigns.id, campaignId), eq(sterilizationCampaigns.organizationId, organizationId)),
    with: {
      vouchers: { orderBy: (vouchers, { desc }) => [desc(vouchers.date)] },
    },
  });
  if (!campaign) throw new Error("Campagne introuvable.");
  return campaign;
}

/** Sex of the sterilized cat — deliberately narrower than animalSexEnum: a bon is only logged once known, never "inconnu". */
const voucherSexSchema = z.enum(["male", "femelle"]);

const createSterilizationVoucherFieldsSchema = z.object({
  campaignId: z.string().uuid(),
  organizationId: z.string().uuid(),
  voucherNumber: z.string().min(1).max(60),
  identificationNumber: z.string().min(1).max(60),
  date: dateString,
  sex: voucherSexSchema,
});

/**
 * Admin, or bénévole assigned to this campaign: logs one voucher ("bon"),
 * as the association performs each sterilization — photo optional. Takes
 * FormData (rather than a plain object) because of the optional file.
 */
export async function createSterilizationVoucher(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = createSterilizationVoucherFieldsSchema.parse({
    campaignId: formData.get("campaignId"),
    organizationId: formData.get("organizationId"),
    voucherNumber: formData.get("voucherNumber"),
    identificationNumber: formData.get("identificationNumber"),
    date: formData.get("date"),
    sex: formData.get("sex"),
  });
  await requireAdminOrCampaignAccess(session.user.id, data.organizationId, data.campaignId);

  const campaign = await db.query.sterilizationCampaigns.findFirst({
    where: and(
      eq(sterilizationCampaigns.id, data.campaignId),
      eq(sterilizationCampaigns.organizationId, data.organizationId),
    ),
  });
  if (!campaign) throw new Error("Campagne introuvable.");

  const file = formData.get("file");
  const photoUrl =
    file instanceof File && file.size > 0
      ? await uploadImage(file, `campagnes-sterilisation/${data.campaignId}`)
      : null;

  const [voucher] = await db
    .insert(sterilizationVouchers)
    .values({
      campaignId: data.campaignId,
      voucherNumber: data.voucherNumber,
      identificationNumber: data.identificationNumber,
      date: data.date,
      sex: data.sex,
      photoUrl,
    })
    .returning();
  if (!voucher) throw new Error("Échec de l'ajout du bon.");
  return voucher;
}

const updateSterilizationVoucherFieldsSchema = z.object({
  voucherId: z.string().uuid(),
  organizationId: z.string().uuid(),
  voucherNumber: z.string().min(1).max(60),
  identificationNumber: z.string().min(1).max(60),
  date: dateString,
  sex: voucherSexSchema,
});

/**
 * Admin, or bénévole assigned to the voucher's campaign: edits a logged
 * voucher — a new photo (if provided) replaces the existing one, otherwise
 * it's kept as-is.
 */
export async function updateSterilizationVoucher(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = updateSterilizationVoucherFieldsSchema.parse({
    voucherId: formData.get("voucherId"),
    organizationId: formData.get("organizationId"),
    voucherNumber: formData.get("voucherNumber"),
    identificationNumber: formData.get("identificationNumber"),
    date: formData.get("date"),
    sex: formData.get("sex"),
  });

  const voucher = await db.query.sterilizationVouchers.findFirst({
    where: eq(sterilizationVouchers.id, data.voucherId),
    with: { campaign: true },
  });
  if (!voucher || voucher.campaign.organizationId !== data.organizationId) {
    throw new Error("Bon introuvable.");
  }
  await requireAdminOrCampaignAccess(session.user.id, data.organizationId, voucher.campaignId);

  const file = formData.get("file");
  const photoUrl =
    file instanceof File && file.size > 0
      ? await uploadImage(file, `campagnes-sterilisation/${voucher.campaignId}`)
      : voucher.photoUrl;

  const [updated] = await db
    .update(sterilizationVouchers)
    .set({
      voucherNumber: data.voucherNumber,
      identificationNumber: data.identificationNumber,
      date: data.date,
      sex: data.sex,
      photoUrl,
      updatedAt: new Date(),
    })
    .where(eq(sterilizationVouchers.id, data.voucherId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du bon.");
  return updated;
}

const deleteSterilizationVoucherSchema = z.object({
  voucherId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin, or bénévole assigned to the voucher's campaign: removes a logged voucher (e.g. entered by mistake). */
export async function deleteSterilizationVoucher(
  input: z.infer<typeof deleteSterilizationVoucherSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { voucherId, organizationId } = deleteSterilizationVoucherSchema.parse(input);

  const voucher = await db.query.sterilizationVouchers.findFirst({
    where: eq(sterilizationVouchers.id, voucherId),
    with: { campaign: true },
  });
  if (!voucher || voucher.campaign.organizationId !== organizationId) {
    throw new Error("Bon introuvable.");
  }
  await requireAdminOrCampaignAccess(session.user.id, organizationId, voucher.campaignId);

  await db.delete(sterilizationVouchers).where(eq(sterilizationVouchers.id, voucherId));
}

const listAssignableCampaignVolunteersSchema = z.object({
  organizationId: z.string().uuid(),
});

/** Admin-only: org members holding "campagne_sterilisation" — the pool assignable to a campaign. */
export async function listAssignableCampaignVolunteers(
  input: z.infer<typeof listAssignableCampaignVolunteersSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listAssignableCampaignVolunteersSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const members = await db.query.organizationMembers.findMany({
    where: and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.isActive, true)),
    with: { user: true, permissions: true },
  });

  return members
    .filter((member) => member.permissions.some((p) => p.permission === "campagne_sterilisation"))
    .map((member) => ({
      id: member.id,
      label:
        member.user.firstName || member.user.lastName
          ? `${member.user.firstName ?? ""} ${member.user.lastName ?? ""}`.trim()
          : member.user.email,
    }));
}

const listCampaignVolunteersSchema = z.object({
  campaignId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: the bénévoles currently assigned to a campaign. */
export async function listCampaignVolunteers(input: z.infer<typeof listCampaignVolunteersSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { campaignId, organizationId } = listCampaignVolunteersSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const campaign = await db.query.sterilizationCampaigns.findFirst({
    where: and(eq(sterilizationCampaigns.id, campaignId), eq(sterilizationCampaigns.organizationId, organizationId)),
  });
  if (!campaign) throw new Error("Campagne introuvable.");

  const assignments = await db.query.sterilizationCampaignVolunteers.findMany({
    where: eq(sterilizationCampaignVolunteers.campaignId, campaignId),
    with: { member: { with: { user: true } } },
  });

  return assignments.map((assignment) => ({
    memberId: assignment.memberId,
    label:
      assignment.member.user.firstName || assignment.member.user.lastName
        ? `${assignment.member.user.firstName ?? ""} ${assignment.member.user.lastName ?? ""}`.trim()
        : assignment.member.user.email,
  }));
}

const assignCampaignVolunteerSchema = z.object({
  campaignId: z.string().uuid(),
  organizationId: z.string().uuid(),
  memberId: z.string().uuid(),
});

/** Admin-only: grants a bénévole (who must already hold "campagne_sterilisation") access to one campaign. */
export async function assignCampaignVolunteer(input: z.infer<typeof assignCampaignVolunteerSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { campaignId, organizationId, memberId } = assignCampaignVolunteerSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const campaign = await db.query.sterilizationCampaigns.findFirst({
    where: and(eq(sterilizationCampaigns.id, campaignId), eq(sterilizationCampaigns.organizationId, organizationId)),
  });
  if (!campaign) throw new Error("Campagne introuvable.");

  const member = await db.query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, organizationId)),
    with: { permissions: true },
  });
  if (!member) throw new Error("Membre introuvable.");
  if (!member.permissions.some((p) => p.permission === "campagne_sterilisation")) {
    throw new Error("Ce membre n'a pas le droit \"Campagne stérilisation\".");
  }

  await db.insert(sterilizationCampaignVolunteers).values({ campaignId, memberId }).onConflictDoNothing();
}

const unassignCampaignVolunteerSchema = z.object({
  campaignId: z.string().uuid(),
  organizationId: z.string().uuid(),
  memberId: z.string().uuid(),
});

/** Admin-only: revokes a bénévole's access to one specific campaign. */
export async function unassignCampaignVolunteer(
  input: z.infer<typeof unassignCampaignVolunteerSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { campaignId, organizationId, memberId } = unassignCampaignVolunteerSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const campaign = await db.query.sterilizationCampaigns.findFirst({
    where: and(eq(sterilizationCampaigns.id, campaignId), eq(sterilizationCampaigns.organizationId, organizationId)),
  });
  if (!campaign) throw new Error("Campagne introuvable.");

  await db
    .delete(sterilizationCampaignVolunteers)
    .where(
      and(
        eq(sterilizationCampaignVolunteers.campaignId, campaignId),
        eq(sterilizationCampaignVolunteers.memberId, memberId),
      ),
    );
}
