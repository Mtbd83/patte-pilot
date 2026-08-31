/**
 * Integration tests for the sterilization-report server actions (stray-cat
 * reporting maps), run against a real (test) Postgres database. Each run
 * seeds its own uniquely-named organization/users (via a random suffix) and
 * tears them down in afterAll, so the suite can be re-run repeatedly
 * without collisions. Image upload is mocked (no real storage call).
 */
jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));
jest.mock("@/lib/uploads", () => ({
  uploadImage: jest.fn().mockResolvedValue("https://storage.example.com/fake-report-photo.jpg"),
}));
jest.mock("@/lib/request-ip", () => ({
  getClientIp: jest.fn().mockResolvedValue("203.0.113.42"),
}));
// Only fetchCityBoundary (a pure convenience for pre-filling the admin's
// boundary-drawing map) still calls this — map creation/validation no
// longer touches geocoding at all, see makeSquareBoundary below.
jest.mock("@/lib/geocoding", () => ({
  geocodeCityBoundary: jest.fn().mockResolvedValue({
    center: { latitude: 43.5297, longitude: 5.4474 },
    boundary: null,
  }),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/request-ip";
import { geocodeCityBoundary } from "@/lib/geocoding";
import { db } from "@/db";
import { users, organizations, organizationMembers, organizationMemberRoles } from "@/db/schema";
import {
  createReportingMap,
  deleteReportingMap,
  fetchCityBoundary,
  listReportingMaps,
  getReportingMapDetail,
  updateReportManagementStatus,
  deleteReport,
  deleteReportComment,
  getPublicReportingMap,
  createReport,
  createReportComment,
} from "@/server/actions/sterilization-reports";
import { updateMemberRoles } from "@/server/actions/members";
import { ForbiddenError } from "@/lib/permissions";

const authMock = auth as unknown as jest.Mock;
const getClientIpMock = getClientIp as unknown as jest.Mock;
const geocodeCityBoundaryMock = geocodeCityBoundary as unknown as jest.Mock;

// A ~5.5km square around a fixed center — comfortably contains the default
// report location below and other "close by" test points, while a distant
// city (e.g. Paris) always falls well outside it.
const DEFAULT_CITY_CENTER = { latitude: 43.5297, longitude: 5.4474 };
function makeSquareBoundary(center = DEFAULT_CITY_CENTER, delta = 0.05) {
  return [
    { latitude: center.latitude - delta, longitude: center.longitude - delta },
    { latitude: center.latitude - delta, longitude: center.longitude + delta },
    { latitude: center.latitude + delta, longitude: center.longitude + delta },
    { latitude: center.latitude + delta, longitude: center.longitude - delta },
  ];
}

function makeReportFormData(overrides: Partial<Record<string, string>> = {}) {
  const formData = new FormData();
  formData.set("mapToken", overrides.mapToken ?? "");
  formData.set("latitude", overrides.latitude ?? "43.5297");
  formData.set("longitude", overrides.longitude ?? "5.4474");
  formData.set("sex", overrides.sex ?? "femelle");
  formData.set("needsSterilization", overrides.needsSterilization ?? "oui");
  formData.set("finderStatus", overrides.finderStatus ?? "errant");
  if (overrides.description) formData.set("description", overrides.description);
  if (overrides.honeypot) formData.set("honeypot", overrides.honeypot);
  if (overrides.noPhoto !== "true") {
    formData.set("file", new File(["fake"], "chat.jpg", { type: "image/jpeg" }));
  }
  return formData;
}

describe("sterilization report server actions", () => {
  let organizationId: string;
  let adminUserId: string;
  let benevoleUserId: string;
  let benevoleMemberId: string;
  let outsiderUserId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [admin] = await db.insert(users).values({ email: `admin-report-${suffix}@example.com` }).returning();
    const [benevole] = await db.insert(users).values({ email: `benevole-report-${suffix}@example.com` }).returning();
    const [outsider] = await db.insert(users).values({ email: `outsider-report-${suffix}@example.com` }).returning();
    if (!admin || !benevole || !outsider) throw new Error("Seed setup failed: users not created.");
    adminUserId = admin.id;
    benevoleUserId = benevole.id;
    outsiderUserId = outsider.id;

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Report ${suffix}`, slug: `test-report-${suffix}` })
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
    await db.insert(organizationMemberRoles).values({ memberId: benevoleMemberId, role: "benevole" });
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, benevoleUserId));
    await db.delete(users).where(eq(users.id, outsiderUserId));
  });

  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    getClientIpMock.mockResolvedValue("203.0.113.42");
    geocodeCityBoundaryMock.mockResolvedValue({
      center: { latitude: 43.5297, longitude: 5.4474 },
      boundary: null,
    });
  });

  it("rejects a bénévole without the permission from creating a map, admin succeeds", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    await expect(
      createReportingMap({ organizationId, city: "Digne", boundary: makeSquareBoundary() }),
    ).rejects.toThrow(ForbiddenError);

    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const map = await createReportingMap({ organizationId, city: "Digne", boundary: makeSquareBoundary() });
    expect(map.city).toBe("Digne");
    expect(map.publicToken).toHaveLength(64);
    expect(map.boundary).toHaveLength(4);
  });

  it("rejects a boundary with fewer than 3 points", async () => {
    await expect(
      createReportingMap({
        organizationId,
        city: "Trop-Court",
        boundary: makeSquareBoundary().slice(0, 2),
      }),
    ).rejects.toThrow(/au moins 3 points/);
  });

  it("fetches a city's boundary for the admin's draw-map, falling back to center-only or surfacing an error", async () => {
    const noPolygon = await fetchCityBoundary({ organizationId, city: "Digne-les-Bains" });
    expect(noPolygon).toEqual({
      center: { latitude: 43.5297, longitude: 5.4474 },
      boundary: null,
      error: null,
    });

    const boundary = makeSquareBoundary();
    geocodeCityBoundaryMock.mockResolvedValueOnce({
      center: { latitude: 43.5297, longitude: 5.4474 },
      boundary,
    });
    const withPolygon = await fetchCityBoundary({ organizationId, city: "Garéoult" });
    expect(withPolygon.boundary).toEqual(boundary);

    geocodeCityBoundaryMock.mockResolvedValueOnce({ error: "Ville introuvable" });
    const failed = await fetchCityBoundary({ organizationId, city: "Villeneuve" });
    expect(failed.center).toBeNull();
    expect(failed.boundary).toBeNull();
    expect(failed.error).toBe("Ville introuvable");
  });

  it("rejects a report location outside the map's drawn boundary, accepts one inside", async () => {
    const map = await createReportingMap({ organizationId, city: "LaSaisonne", boundary: makeSquareBoundary() });

    // Paris — nowhere near the ~5.5km square drawn around the default center.
    await expect(
      createReport(makeReportFormData({ mapToken: map.publicToken, latitude: "48.8566", longitude: "2.3522" })),
    ).rejects.toThrow(/en dehors de la zone de LaSaisonne/);

    // A point inside the drawn square is accepted.
    const created = await createReport(
      makeReportFormData({ mapToken: map.publicToken, latitude: "43.531", longitude: "5.449" }),
    );
    expect(created).not.toBeNull();
  });

  it("rejects a bénévole with the permission from creating a second map (admin-only)", async () => {
    await updateMemberRoles({
      organizationId,
      memberId: benevoleMemberId,
      roles: ["benevole"],
      permissions: ["campagne_sterilisation"],
    });

    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    await expect(createReportingMap({ organizationId, city: "Sisteron", boundary: makeSquareBoundary() })).rejects.toThrow(ForbiddenError);
  });

  it("refuses a duplicate map for the same city", async () => {
    await expect(createReportingMap({ organizationId, city: "Digne", boundary: makeSquareBoundary() })).rejects.toThrow(/existe déjà/);
  });

  it("lets a bénévole with the permission list and view maps, but rejects one without it", async () => {
    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    const list = await listReportingMaps({ organizationId });
    expect(list.some((m) => m.city === "Digne")).toBe(true);

    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(listReportingMaps({ organizationId })).rejects.toThrow(ForbiddenError);
  });

  it("publicly reports a stray cat with a photo, comments on it, and reflects it authenticated-side", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const map = await createReportingMap({ organizationId, city: "Manosque", boundary: makeSquareBoundary() });

    const publicView = await getPublicReportingMap({ token: map.publicToken });
    expect(publicView.city).toBe("Manosque");
    expect(publicView.reports).toHaveLength(0);

    const created = await createReport(
      makeReportFormData({ mapToken: map.publicToken, description: "Chat noir et blanc, timide" }),
    );
    expect(created).not.toBeNull();

    const afterReport = await getPublicReportingMap({ token: map.publicToken });
    expect(afterReport.reports).toHaveLength(1);
    const report = afterReport.reports[0]!;
    expect(report.photoUrl).toBe("https://storage.example.com/fake-report-photo.jpg");
    expect(report.managementStatus).toBe("en_cours");
    expect((report as Record<string, unknown>).reporterIp).toBeUndefined();

    const comment = await createReportComment({
      mapToken: map.publicToken,
      reportId: report.id,
      authorName: "Jean Dupont",
      text: "C'est le mien, il s'appelle Félix !",
    });
    expect(comment).not.toBeNull();

    const afterComment = await getPublicReportingMap({ token: map.publicToken });
    expect(afterComment.reports[0]!.comments).toHaveLength(1);
    expect(afterComment.reports[0]!.comments[0]!.authorName).toBe("Jean Dupont");

    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const detail = await getReportingMapDetail({ mapId: map.id, organizationId });
    expect(detail.reports).toHaveLength(1);
    expect(detail.reports[0]!.comments).toHaveLength(1);
  });

  it("requires a photo to submit a report", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const map = await createReportingMap({ organizationId, city: "Forcalquier", boundary: makeSquareBoundary() });

    await expect(
      createReport(makeReportFormData({ mapToken: map.publicToken, noPhoto: "true" })),
    ).rejects.toThrow(/photo est obligatoire/);
  });

  it("silently no-ops a report with a filled honeypot", async () => {
    const map = await createReportingMap({ organizationId, city: "Gap", boundary: makeSquareBoundary() });
    const result = await createReport(makeReportFormData({ mapToken: map.publicToken, honeypot: "spam" }));
    expect(result).toBeNull();

    const publicView = await getPublicReportingMap({ token: map.publicToken });
    expect(publicView.reports).toHaveLength(0);
  });

  it("rate-limits reports per IP per map", async () => {
    const map = await createReportingMap({ organizationId, city: "Barcelonnette", boundary: makeSquareBoundary() });

    for (let i = 0; i < 5; i += 1) {
      await createReport(makeReportFormData({ mapToken: map.publicToken }));
    }
    await expect(createReport(makeReportFormData({ mapToken: map.publicToken }))).rejects.toThrow(
      /Trop de signalements/,
    );
  });

  it("rate-limits comments per IP per report", async () => {
    const map = await createReportingMap({ organizationId, city: "Embrun", boundary: makeSquareBoundary() });
    const created = await createReport(makeReportFormData({ mapToken: map.publicToken }));

    for (let i = 0; i < 5; i += 1) {
      await createReportComment({
        mapToken: map.publicToken,
        reportId: created!.id,
        authorName: "Test",
        text: `Commentaire ${i}`,
      });
    }
    await expect(
      createReportComment({ mapToken: map.publicToken, reportId: created!.id, authorName: "Test", text: "encore" }),
    ).rejects.toThrow(/Trop de commentaires/);
  });

  it("lets admin and permitted bénévole change a report's management status, rejects an outsider", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const map = await createReportingMap({ organizationId, city: "Castellane", boundary: makeSquareBoundary() });
    const created = await createReport(makeReportFormData({ mapToken: map.publicToken }));

    const updated = await updateReportManagementStatus({
      reportId: created!.id,
      organizationId,
      status: "ferme",
    });
    expect(updated.managementStatus).toBe("ferme");

    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    const updatedAgain = await updateReportManagementStatus({
      reportId: created!.id,
      organizationId,
      status: "archive",
    });
    expect(updatedAgain.managementStatus).toBe("archive");

    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(
      updateReportManagementStatus({ reportId: created!.id, organizationId, status: "en_cours" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lets admin and permitted bénévole delete a report or comment, rejects an outsider", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const map = await createReportingMap({ organizationId, city: "Annot", boundary: makeSquareBoundary() });
    const created = await createReport(makeReportFormData({ mapToken: map.publicToken }));
    const comment = await createReportComment({
      mapToken: map.publicToken,
      reportId: created!.id,
      authorName: "Spammeur",
      text: "spam spam spam",
    });

    authMock.mockResolvedValue({ user: { id: outsiderUserId, email: "outsider@example.com" } });
    await expect(deleteReportComment({ commentId: comment!.id, organizationId })).rejects.toThrow(ForbiddenError);
    await expect(deleteReport({ reportId: created!.id, organizationId })).rejects.toThrow(ForbiddenError);

    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    await deleteReportComment({ commentId: comment!.id, organizationId });
    await deleteReport({ reportId: created!.id, organizationId });

    const publicView = await getPublicReportingMap({ token: map.publicToken });
    expect(publicView.reports).toHaveLength(0);
  });

  it("lets an admin delete a whole map (cascading its reports), but rejects a permitted bénévole", async () => {
    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    const map = await createReportingMap({ organizationId, city: "Riez", boundary: makeSquareBoundary() });
    await createReport(makeReportFormData({ mapToken: map.publicToken }));

    authMock.mockResolvedValue({ user: { id: benevoleUserId, email: "benevole@example.com" } });
    await expect(deleteReportingMap({ mapId: map.id, organizationId })).rejects.toThrow(ForbiddenError);

    authMock.mockResolvedValue({ user: { id: adminUserId, email: "admin@example.com" } });
    await deleteReportingMap({ mapId: map.id, organizationId });

    await expect(getPublicReportingMap({ token: map.publicToken })).rejects.toThrow(/introuvable/);
  });
});
