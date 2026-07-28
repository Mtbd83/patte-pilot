import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ContractFieldMapper } from "./contract-field-mapper-loader";

export default async function ContratParametresPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/parametres/contrat`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  if (!roles.includes("admin")) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seul·e·s les administrateur·rice·s peuvent modifier les paramètres.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}/parametres`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Paramètres
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Modèle de contrat d&apos;adoption</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Votre contrat, tel quel</CardTitle>
          <CardDescription>
            Téléversez votre contrat d&apos;adoption habituel (inchangé), puis indiquez en cliquant sur le
            document où chaque information doit s&apos;écrire. Réglage à faire une fois — pas à chaque
            adoption.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContractFieldMapper
            organizationId={organization.id}
            contractTemplateUrl={organization.contractTemplateUrl}
            initialPositions={organization.contractFieldPositions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
