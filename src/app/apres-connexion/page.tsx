import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, PawPrint } from "lucide-react";
import { auth } from "@/lib/auth";
import { listOrganizationsForUser } from "@/lib/organizations";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

/**
 * Landing spot after a login with no specific destination in mind (i.e. no
 * callbackUrl): sends a single-org user straight to their dashboard, and
 * only bothers a multi-org user with a choice.
 */
export default async function ApresConnexionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const organizations = await listOrganizationsForUser(session.user.id);

  const [onlyOrganization] = organizations;
  if (organizations.length === 1 && onlyOrganization) {
    redirect(`/organisations/${onlyOrganization.slug}`);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <PawPrint className="size-8 text-primary" />
          <h1 className="text-xl font-semibold">PattePilot</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{organizations.length === 0 ? "Aucune association" : "Choisissez une association"}</CardTitle>
            <CardDescription>
              {organizations.length === 0
                ? "Vous n'êtes membre d'aucune association pour le moment."
                : "Vous êtes membre de plusieurs associations."}
            </CardDescription>
          </CardHeader>
          {organizations.length > 0 && (
            <CardContent className="flex flex-col gap-2">
              {organizations.map((organization) => (
                <Link
                  key={organization.id}
                  href={`/organisations/${organization.slug}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  {organization.name}
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          )}
        </Card>
      </div>
    </main>
  );
}
