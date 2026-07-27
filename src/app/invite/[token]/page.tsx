import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { acceptInvitation } from "@/server/actions/invitations";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { InviteSignupForm } from "./invite-signup-form";

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pattepilot-logo.svg" alt="PattePilot" className="h-40 w-auto" />
        </div>
        <Card>{children}</Card>
      </div>
    </main>
  );
}

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
      <InviteShell>
        <CardHeader>
          <CardTitle>Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Cette invitation n&apos;est plus valide.</p>
        </CardContent>
      </InviteShell>
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
      <InviteShell>
        <CardHeader>
          <CardTitle>Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </InviteShell>
    );
  }

  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, invitation.email),
  });

  if (existingUser) {
    redirect(`/connexion?callbackUrl=/invite/${params.token}`);
  }

  return (
    <InviteShell>
      <CardHeader>
        <CardTitle>Invitation</CardTitle>
        <CardDescription>Créez votre compte pour rejoindre l&apos;association.</CardDescription>
      </CardHeader>
      <CardContent>
        <InviteSignupForm token={params.token} email={invitation.email} />
      </CardContent>
    </InviteShell>
  );
}
