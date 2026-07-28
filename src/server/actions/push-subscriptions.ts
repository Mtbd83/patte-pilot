"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/permissions";

const savePushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  authKey: z.string().min(1),
});

/**
 * Authenticated: registers (or re-registers, on conflict) the current
 * browser's push subscription for the logged-in user. A subscription is
 * personal, not scoped to an organization — no role check beyond being
 * signed in.
 */
export async function savePushSubscription(input: z.infer<typeof savePushSubscriptionSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const data = savePushSubscriptionSchema.parse(input);

  await db
    .insert(pushSubscriptions)
    .values({ userId: session.user.id, ...data })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: session.user.id, p256dh: data.p256dh, authKey: data.authKey },
    });
}

const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});

/** Authenticated: removes the current user's subscription for this browser (e.g. when disabling notifications). */
export async function deletePushSubscription(input: z.infer<typeof deletePushSubscriptionSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Non authentifié.");

  const { endpoint } = deletePushSubscriptionSchema.parse(input);
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, session.user.id),
      ),
    );
}
