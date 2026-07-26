import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { acceptInvitation } from "@/server/actions/invitations";
import { InviteSignupForm } from "./invite-signup-form";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const session = await auth();

  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, params.token),
  });

  if (!invitation || invitation.status !== "pending" || invitation.expiresAt < new Date()) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Invitation</h1>
        <p style={{ color: "crimson" }}>Cette invitation n&apos;est plus valide.</p>
      </main>
    );
  }

  // Only treat the visitor as "logged in for this invitation" if their
  // session email actually matches — e.g. a browser that happens to still
  // hold someone else's session (a different tab, a shared machine) must
  // fall through to the sign-in/sign-up path below, not silently fail.
  const isSignedInAsInvitee = session?.user?.email?.toLowerCase().trim() === invitation.email;

  if (isSignedInAsInvitee) {
    let organizationId: string | null = null;
    let error: string | null = null;
    try {
      const result = await acceptInvitation({ token: params.token });
      organizationId = result.organizationId;
    } catch (e) {
      // Note: `redirect()` below must stay outside this try/catch — it works
      // by throwing, and catching it here would swallow the redirect.
      error = e instanceof Error ? e.message : "Une erreur est survenue.";
    }

    if (organizationId) {
      redirect(`/organisations/${organizationId}`);
    }

    return (
      <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Invitation</h1>
        <p style={{ color: "crimson" }}>{error}</p>
      </main>
    );
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, invitation.email),
  });

  if (existingUser) {
    redirect(`/connexion?callbackUrl=/invite/${params.token}`);
  }

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Invitation</h1>
      <p>Créez votre compte pour rejoindre l&apos;association.</p>
      <InviteSignupForm token={params.token} email={invitation.email} />
    </main>
  );
}
