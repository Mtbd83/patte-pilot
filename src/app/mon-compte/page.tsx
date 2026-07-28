import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { listOrganizationsForUser } from "@/lib/organizations";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccountForm } from "./delete-account-form";
import { LeaveOrganizationButton } from "./leave-organization-button";
import { SignOutButton } from "./sign-out-button";
import { PushNotificationsToggle } from "./push-notifications-toggle";

export default async function MonComptePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion?callbackUrl=/mon-compte");

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) redirect("/connexion");

  const organizations = await listOrganizationsForUser(session.user.id);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/apres-connexion"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" /> Retour
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">Mon compte</h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <SignOutButton />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mes organisations</CardTitle>
          </CardHeader>
          <CardContent>
            {organizations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Vous n&apos;êtes membre d&apos;aucune association pour le moment.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {organizations.map((organization) => (
                  <li
                    key={organization.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{organization.name}</span>
                    <LeaveOrganizationButton
                      organizationId={organization.id}
                      organizationName={organization.name}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <PushNotificationsToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Changer le mot de passe</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>Supprimer mon compte</CardTitle>
            <CardDescription>
              Cette action est définitive. Vous perdrez l&apos;accès à toutes les associations dont vous êtes
              membre.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
