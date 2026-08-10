/**
 * Integration tests for the /api/cron/booster-reminders route handler, run
 * against a real (test) Postgres database. Each run seeds its own
 * uniquely-named organization/users/animals and tears them down in
 * afterAll, so the suite is re-runnable without collisions.
 */
jest.mock("@/lib/push", () => ({
  sendPushToUsers: jest.fn().mockResolvedValue(undefined),
}));

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, organizations, animals, animalHealthChecklists, fosterFamilies } from "@/db/schema";
import { sendPushToUsers } from "@/lib/push";
import { GET } from "@/app/api/cron/booster-reminders/route";

const sendPushToUsersMock = sendPushToUsers as jest.Mock;

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function request(secret?: string) {
  return new Request("http://localhost/api/cron/booster-reminders", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/cron/booster-reminders", () => {
  let organizationId: string;
  let linkedUserId: string;
  let fosterFamilyId: string;

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [org] = await db
      .insert(organizations)
      .values({ name: `Test Cron ${suffix}`, slug: `test-cron-${suffix}` })
      .returning();
    if (!org) throw new Error("Seed setup failed: organization not created.");
    organizationId = org.id;

    const [linkedUser] = await db
      .insert(users)
      .values({ email: `fa-cron-${suffix}@example.com` })
      .returning();
    if (!linkedUser) throw new Error("Seed setup failed: user not created.");
    linkedUserId = linkedUser.id;

    const [family] = await db
      .insert(fosterFamilies)
      .values({ organizationId, firstName: "Cron", lastName: "Test", linkedUserId })
      .returning();
    if (!family) throw new Error("Seed setup failed: foster family not created.");
    fosterFamilyId = family.id;
  });

  afterAll(async () => {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, linkedUserId));
  });

  beforeEach(() => {
    sendPushToUsersMock.mockClear();
  });

  it("rejects a request without the correct CRON_SECRET", async () => {
    const response = await GET(request("wrong-secret"));
    expect(response.status).toBe(401);
    expect(sendPushToUsersMock).not.toHaveBeenCalled();
  });

  it("notifies the linked foster family exactly 10 days before the booster is due", async () => {
    // firstVaccineDate 20 days ago -> booster due in 10 days (30-day delay).
    const [dueIn10] = await db
      .insert(animals)
      .values({
        organizationId,
        name: "Dans10Jours",
        species: "chat",
        intakeDate: isoDaysFromNow(-30),
        status: "en_famille_accueil",
        currentFosterFamilyId: fosterFamilyId,
      })
      .returning();
    if (!dueIn10) throw new Error("Seed failed.");
    await db.insert(animalHealthChecklists).values({
      animalId: dueIn10.id,
      firstVaccineDone: true,
      firstVaccineDate: isoDaysFromNow(-20),
      boosterDone: false,
    });

    // Due in 9 days — must NOT trigger.
    const [dueIn9] = await db
      .insert(animals)
      .values({
        organizationId,
        name: "Dans9Jours",
        species: "chat",
        intakeDate: isoDaysFromNow(-29),
        status: "en_famille_accueil",
        currentFosterFamilyId: fosterFamilyId,
      })
      .returning();
    if (!dueIn9) throw new Error("Seed failed.");
    await db.insert(animalHealthChecklists).values({
      animalId: dueIn9.id,
      firstVaccineDone: true,
      firstVaccineDate: isoDaysFromNow(-21),
      boosterDone: false,
    });

    // Due in 10 days but already done — must NOT trigger.
    const [alreadyDone] = await db
      .insert(animals)
      .values({
        organizationId,
        name: "DejaFait",
        species: "chat",
        intakeDate: isoDaysFromNow(-30),
        status: "en_famille_accueil",
        currentFosterFamilyId: fosterFamilyId,
      })
      .returning();
    if (!alreadyDone) throw new Error("Seed failed.");
    await db.insert(animalHealthChecklists).values({
      animalId: alreadyDone.id,
      firstVaccineDone: true,
      firstVaccineDate: isoDaysFromNow(-20),
      boosterDone: true,
    });

    const response = await GET(request(process.env.CRON_SECRET));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sent).toBeGreaterThanOrEqual(1);

    expect(sendPushToUsersMock).toHaveBeenCalledWith(
      [linkedUserId],
      expect.objectContaining({
        title: "Rappel à prévoir",
        body: expect.stringContaining("Dans10Jours"),
      }),
    );
    expect(sendPushToUsersMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: expect.stringContaining("Dans9Jours") }),
    );
    expect(sendPushToUsersMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: expect.stringContaining("DejaFait") }),
    );
  });

  it("notifies again a year after the last booster, for as long as the animal isn't adopted", async () => {
    // Booster given 355 days ago -> next annual recall due in 10 days.
    const boosterDate = isoDaysFromNow(-355);

    const [stillInCare] = await db
      .insert(animals)
      .values({
        organizationId,
        name: "RappelAnnuel",
        species: "chat",
        intakeDate: isoDaysFromNow(-400),
        status: "en_famille_accueil",
        currentFosterFamilyId: fosterFamilyId,
      })
      .returning();
    if (!stillInCare) throw new Error("Seed failed.");
    await db.insert(animalHealthChecklists).values({
      animalId: stillInCare.id,
      firstVaccineDone: true,
      firstVaccineDate: isoDaysFromNow(-400),
      boosterDone: true,
      boosterDate,
    });

    // Same annual due date, but already adopted -> must NOT trigger.
    const [adopted] = await db
      .insert(animals)
      .values({
        organizationId,
        name: "RappelAnnuelAdopte",
        species: "chat",
        intakeDate: isoDaysFromNow(-400),
        status: "adopte",
      })
      .returning();
    if (!adopted) throw new Error("Seed failed.");
    await db.insert(animalHealthChecklists).values({
      animalId: adopted.id,
      firstVaccineDone: true,
      firstVaccineDate: isoDaysFromNow(-400),
      boosterDone: true,
      boosterDate,
    });

    const response = await GET(request(process.env.CRON_SECRET));
    expect(response.status).toBe(200);

    expect(sendPushToUsersMock).toHaveBeenCalledWith(
      [linkedUserId],
      expect.objectContaining({
        title: "Rappel à prévoir",
        body: expect.stringContaining("RappelAnnuel"),
      }),
    );
    expect(sendPushToUsersMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: expect.stringContaining("RappelAnnuelAdopte") }),
    );
  });
});
