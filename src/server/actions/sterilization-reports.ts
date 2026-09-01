"use server";

import { randomBytes, randomUUID } from "crypto";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  sterilizationReportingMaps,
  sterilizationReports,
  sterilizationReportComments,
  sterilizationNeedEnum,
  reportFinderStatusEnum,
  reportManagementStatusEnum,
  animalSexEnum,
  organizations,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  requireAdmin,
  requireAdminOrPermission,
  listOrganizationAdminOrPermissionUserIds,
  ForbiddenError,
} from "@/lib/permissions";
import { uploadImage } from "@/lib/uploads";
import { getClientIp } from "@/lib/request-ip";
import { geocodeCityBoundary } from "@/lib/geocoding";
import { isPointInPolygon } from "@/lib/geo";
import { sendPushToUsers } from "@/lib/push";

const REPORT_RATE_LIMIT_MAX_PER_HOUR = 5;
const COMMENT_RATE_LIMIT_MAX_PER_HOUR = 5;

// ---------------------------------------------------------------------------
// Authenticated: admin creates maps; admin or a bénévole holding
// "campagne_sterilisation" manages reports on them (status changes,
// moderation) — see src/lib/permissions.ts.
// ---------------------------------------------------------------------------

const boundaryPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const createReportingMapSchema = z.object({
  organizationId: z.string().uuid(),
  city: z.string().min(1).max(120),
  boundary: z.array(boundaryPointSchema).min(3, "La zone doit avoir au moins 3 points.").max(300),
});

/**
 * Admin-only: creates a reporting map for a city — one per city per
 * organization. `boundary` is the polygon the admin traced by hand on the
 * map (see BoundaryDrawMap) — the zone a report must fall within.
 */
export async function createReportingMap(input: z.infer<typeof createReportingMapSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, city, boundary } = createReportingMapSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const existing = await db.query.sterilizationReportingMaps.findFirst({
    where: and(eq(sterilizationReportingMaps.organizationId, organizationId), eq(sterilizationReportingMaps.city, city)),
  });
  if (existing) throw new Error(`Une carte de signalement existe déjà pour ${city}.`);

  const [map] = await db
    .insert(sterilizationReportingMaps)
    .values({ organizationId, city, publicToken: randomBytes(32).toString("hex"), boundary })
    .returning();
  if (!map) throw new Error("Échec de la création de la carte.");
  return map;
}

const fetchCityBoundarySchema = z.object({
  organizationId: z.string().uuid(),
  city: z.string().min(1).max(120),
});

/**
 * Admin-only: looks up `city`'s real administrative boundary (reliably
 * available for French communes — see geocodeCityBoundary) to pre-fill the
 * map-creation form's zone automatically, the same way Google Maps shows a
 * place's outline. `boundary` is null when Nominatim has no polygon for
 * this place — the caller falls back to letting the admin trace it by hand,
 * starting from `center` (still returned whenever the place itself was
 * found, even without a polygon).
 */
export async function fetchCityBoundary(input: z.infer<typeof fetchCityBoundarySchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId, city } = fetchCityBoundarySchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const result = await geocodeCityBoundary(city);
  if ("error" in result) {
    return { center: null, boundary: null, error: result.error };
  }
  return { center: result.center, boundary: result.boundary, error: null };
}

const deleteReportingMapSchema = z.object({
  mapId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin-only: removes a reporting map, its reports and their comments (cascade). */
export async function deleteReportingMap(input: z.infer<typeof deleteReportingMapSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { mapId, organizationId } = deleteReportingMapSchema.parse(input);
  await requireAdmin(session.user.id, organizationId);

  const map = await db.query.sterilizationReportingMaps.findFirst({
    where: and(eq(sterilizationReportingMaps.id, mapId), eq(sterilizationReportingMaps.organizationId, organizationId)),
  });
  if (!map) throw new Error("Carte introuvable.");

  await db.delete(sterilizationReportingMaps).where(eq(sterilizationReportingMaps.id, mapId));
}

const listReportingMapsSchema = z.object({
  organizationId: z.string().uuid(),
});

/** Admin or bénévole with "campagne_sterilisation": lists reporting maps with their report count. */
export async function listReportingMaps(input: z.infer<typeof listReportingMapsSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { organizationId } = listReportingMapsSchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "campagne_sterilisation");

  return db.query.sterilizationReportingMaps.findMany({
    where: eq(sterilizationReportingMaps.organizationId, organizationId),
    orderBy: (maps, { desc }) => [desc(maps.createdAt)],
    with: { reports: { columns: { id: true } } },
  });
}

const getReportingMapDetailSchema = z.object({
  mapId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin or bénévole with "campagne_sterilisation": one map with all its reports and their comments. */
export async function getReportingMapDetail(input: z.infer<typeof getReportingMapDetailSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { mapId, organizationId } = getReportingMapDetailSchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "campagne_sterilisation");

  const map = await db.query.sterilizationReportingMaps.findFirst({
    where: and(eq(sterilizationReportingMaps.id, mapId), eq(sterilizationReportingMaps.organizationId, organizationId)),
    with: {
      reports: {
        orderBy: (reports, { desc }) => [desc(reports.createdAt)],
        with: { comments: { orderBy: (comments, { asc }) => [asc(comments.createdAt)] } },
      },
    },
  });
  if (!map) throw new Error("Carte introuvable.");
  return map;
}

const updateReportManagementStatusSchema = z.object({
  reportId: z.string().uuid(),
  organizationId: z.string().uuid(),
  status: z.enum(reportManagementStatusEnum.enumValues),
});

/** Admin or bénévole with "campagne_sterilisation": changes a report's own workflow status. */
export async function updateReportManagementStatus(
  input: z.infer<typeof updateReportManagementStatusSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { reportId, organizationId, status } = updateReportManagementStatusSchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "campagne_sterilisation");

  const report = await db.query.sterilizationReports.findFirst({
    where: eq(sterilizationReports.id, reportId),
    with: { map: true },
  });
  if (!report || report.map.organizationId !== organizationId) throw new Error("Signalement introuvable.");

  const [updated] = await db
    .update(sterilizationReports)
    .set({ managementStatus: status, updatedAt: new Date() })
    .where(eq(sterilizationReports.id, reportId))
    .returning();
  if (!updated) throw new Error("Échec de la mise à jour du statut.");
  return updated;
}

const deleteReportSchema = z.object({
  reportId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin or bénévole with "campagne_sterilisation": removes a report (modération anti-abus/spam). */
export async function deleteReport(input: z.infer<typeof deleteReportSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { reportId, organizationId } = deleteReportSchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "campagne_sterilisation");

  const report = await db.query.sterilizationReports.findFirst({
    where: eq(sterilizationReports.id, reportId),
    with: { map: true },
  });
  if (!report || report.map.organizationId !== organizationId) throw new Error("Signalement introuvable.");

  await db.delete(sterilizationReports).where(eq(sterilizationReports.id, reportId));
}

const deleteReportCommentSchema = z.object({
  commentId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/** Admin or bénévole with "campagne_sterilisation": removes a comment (modération anti-abus/spam). */
export async function deleteReportComment(input: z.infer<typeof deleteReportCommentSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { commentId, organizationId } = deleteReportCommentSchema.parse(input);
  await requireAdminOrPermission(session.user.id, organizationId, "campagne_sterilisation");

  const comment = await db.query.sterilizationReportComments.findFirst({
    where: eq(sterilizationReportComments.id, commentId),
    with: { report: { with: { map: true } } },
  });
  if (!comment || comment.report.map.organizationId !== organizationId) {
    throw new Error("Commentaire introuvable.");
  }

  await db.delete(sterilizationReportComments).where(eq(sterilizationReportComments.id, commentId));
}

// ---------------------------------------------------------------------------
// Public, no auth: the shared map link — anyone can view, report a stray cat
// (with a required photo), and comment on an existing report. Same anti-spam
// posture as submitAdoptionApplication: a honeypot field plus a per-IP rate
// limit, since there's no auth at all to lean on otherwise.
// ---------------------------------------------------------------------------

const getPublicReportingMapSchema = z.object({
  token: z.string().min(1),
});

/** Public: a map's city/org name and all its reports with their comments — never exposes reporterIp. */
export async function getPublicReportingMap(input: z.infer<typeof getPublicReportingMapSchema>) {
  const { token } = getPublicReportingMapSchema.parse(input);

  const map = await db.query.sterilizationReportingMaps.findFirst({
    where: eq(sterilizationReportingMaps.publicToken, token),
  });
  if (!map) throw new Error("Carte introuvable.");

  const [organization, reports] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, map.organizationId), columns: { name: true } }),
    db.query.sterilizationReports.findMany({
      where: eq(sterilizationReports.mapId, map.id),
      orderBy: (reports, { desc }) => [desc(reports.createdAt)],
      columns: {
        id: true,
        latitude: true,
        longitude: true,
        photoUrl: true,
        sex: true,
        needsSterilization: true,
        finderStatus: true,
        managementStatus: true,
        description: true,
        createdAt: true,
      },
      with: {
        comments: {
          orderBy: (comments, { asc }) => [asc(comments.createdAt)],
          columns: { id: true, authorName: true, text: true, createdAt: true },
        },
      },
    }),
  ]);
  if (!organization) throw new Error("Association introuvable.");

  return {
    city: map.city,
    organizationName: organization.name,
    boundary: map.boundary,
    reports,
  };
}

const createReportSchema = z.object({
  mapToken: z.string().min(1),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  sex: z.enum(animalSexEnum.enumValues),
  needsSterilization: z.enum(sterilizationNeedEnum.enumValues),
  finderStatus: z.enum(reportFinderStatusEnum.enumValues),
  description: z.string().optional(),
  contact: z.string().max(200).optional(),
  honeypot: z.string().optional(),
});

/**
 * Public: reports a stray cat on a map — photo is required. Takes FormData
 * (rather than a plain object) because of the file. Two anti-spam measures
 * given the total absence of auth: a honeypot field, and a per-IP,
 * per-map rate limit.
 */
export async function createReport(formData: FormData) {
  const { honeypot, ...data } = createReportSchema.parse({
    mapToken: formData.get("mapToken"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    sex: formData.get("sex"),
    needsSterilization: formData.get("needsSterilization"),
    finderStatus: formData.get("finderStatus"),
    description: formData.get("description") || undefined,
    contact: formData.get("contact") || undefined,
    honeypot: formData.get("honeypot") || undefined,
  });

  // A filled honeypot means a bot, not a real visitor — silently no-op
  // instead of throwing, so the bot has no signal it was caught.
  if (honeypot) return null;

  const map = await db.query.sterilizationReportingMaps.findFirst({
    where: eq(sterilizationReportingMaps.publicToken, data.mapToken),
  });
  if (!map) throw new Error("Carte introuvable.");

  if (!isPointInPolygon({ latitude: data.latitude, longitude: data.longitude }, map.boundary)) {
    throw new Error(
      `Ce lieu est en dehors de la zone de ${map.city} — sélectionnez un endroit dans la zone indiquée sur la carte.`,
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Une photo est obligatoire pour signaler un chat.");
  }

  const ipAddress = await getClientIp();
  if (ipAddress) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFromSameIp = await db.query.sterilizationReports.findMany({
      where: and(
        eq(sterilizationReports.mapId, map.id),
        eq(sterilizationReports.reporterIp, ipAddress),
        gte(sterilizationReports.createdAt, oneHourAgo),
      ),
    });
    if (recentFromSameIp.length >= REPORT_RATE_LIMIT_MAX_PER_HOUR) {
      throw new Error("Trop de signalements envoyés récemment — réessayez plus tard.");
    }
  }

  const photoUrl = await uploadImage(file, `signalements/${randomUUID()}`);

  const [report] = await db
    .insert(sterilizationReports)
    .values({
      mapId: map.id,
      latitude: data.latitude,
      longitude: data.longitude,
      photoUrl,
      sex: data.sex,
      needsSterilization: data.needsSterilization,
      finderStatus: data.finderStatus,
      description: data.description,
      contact: data.contact,
      reporterIp: ipAddress,
    })
    .returning({ id: sterilizationReports.id });
  if (!report) throw new Error("Échec de l'envoi du signalement.");

  // Best-effort: never let a notification failure break the public submission.
  try {
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, map.organizationId),
    });
    if (organization) {
      const userIds = await listOrganizationAdminOrPermissionUserIds(
        map.organizationId,
        "campagne_sterilisation",
      );
      await sendPushToUsers(userIds, {
        title: "Nouveau signalement",
        body: `Nouveau signalement sur la carte de "${map.city}"`,
        url: `/organisations/${organization.slug}/campagnes-sterilisation/cartes-signalement/${map.id}`,
      });
    }
  } catch (err) {
    console.error("Échec d'envoi de la notification de nouveau signalement:", err);
  }

  return report;
}

const createReportCommentSchema = z.object({
  mapToken: z.string().min(1),
  reportId: z.string().uuid(),
  authorName: z.string().min(1).max(120),
  text: z.string().min(1),
  honeypot: z.string().optional(),
});

/** Public: comments on a report (e.g. "c'est le mien") — same honeypot + rate-limit posture as createReport. */
export async function createReportComment(input: z.infer<typeof createReportCommentSchema>) {
  const { honeypot, mapToken, reportId, ...rest } = createReportCommentSchema.parse(input);

  if (honeypot) return null;

  const map = await db.query.sterilizationReportingMaps.findFirst({
    where: eq(sterilizationReportingMaps.publicToken, mapToken),
  });
  if (!map) throw new Error("Carte introuvable.");

  const report = await db.query.sterilizationReports.findFirst({
    where: and(eq(sterilizationReports.id, reportId), eq(sterilizationReports.mapId, map.id)),
  });
  if (!report) throw new Error("Signalement introuvable.");

  const ipAddress = await getClientIp();
  if (ipAddress) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentFromSameIp = await db.query.sterilizationReportComments.findMany({
      where: and(
        eq(sterilizationReportComments.reportId, reportId),
        eq(sterilizationReportComments.reporterIp, ipAddress),
        gte(sterilizationReportComments.createdAt, oneHourAgo),
      ),
    });
    if (recentFromSameIp.length >= COMMENT_RATE_LIMIT_MAX_PER_HOUR) {
      throw new Error("Trop de commentaires envoyés récemment — réessayez plus tard.");
    }
  }

  const [comment] = await db
    .insert(sterilizationReportComments)
    .values({ reportId, authorName: rest.authorName, text: rest.text, reporterIp: ipAddress })
    .returning({ id: sterilizationReportComments.id, authorName: sterilizationReportComments.authorName, text: sterilizationReportComments.text, createdAt: sterilizationReportComments.createdAt });
  if (!comment) throw new Error("Échec de l'envoi du commentaire.");
  return comment;
}
