import { NextResponse } from "next/server";
import { db } from "@/db";
import { boosterDueDate, isBoosterOwed } from "@/lib/animal-care";
import { sendPushToUsers } from "@/lib/push";

export const dynamic = "force-dynamic";

const REMINDER_LEAD_DAYS = 10;

/**
 * Runs once a day (see vercel.json) and pushes exactly one reminder to a
 * foster family's linked account, exactly 10 days before her animal's
 * booster is due — not "within the next 10 days" (which would fire every
 * day of that window), a single notification on the one day it matters.
 * Triggered only by Vercel's cron scheduler (authenticated via CRON_SECRET,
 * the header Vercel itself attaches to the request).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + REMINDER_LEAD_DAYS);
  const targetDateStr = targetDate.toISOString().slice(0, 10);

  const allAnimals = await db.query.animals.findMany({
    with: { healthChecklist: true, currentFosterFamily: true, organization: true },
  });

  let sent = 0;
  for (const animal of allAnimals) {
    if (!animal.healthChecklist) continue;
    if (!isBoosterOwed(animal.healthChecklist, animal.status)) continue;

    const due = boosterDueDate(animal.healthChecklist);
    if (due !== targetDateStr) continue;

    const linkedUserId = animal.currentFosterFamily?.linkedUserId;
    if (!linkedUserId || !animal.organization) continue;

    await sendPushToUsers([linkedUserId], {
      title: "Rappel à prévoir",
      body: `Pensez au rappel de ${animal.name} en date du ${new Date(due).toLocaleDateString("fr-FR")}`,
      url: `/organisations/${animal.organization.slug}/animaux/${animal.id}`,
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, sent });
}
