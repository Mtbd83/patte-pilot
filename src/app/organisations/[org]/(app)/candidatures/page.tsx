import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listAdoptionApplications } from "@/server/actions/adoption-applications";
import { listAnimals } from "@/server/actions/animals";
import {
  ADOPTION_STATUS_LABELS,
  ADOPTION_STATUS_BADGE_VARIANT,
  ADOPTION_STATUS_ROW_CLASS,
} from "@/lib/adoption-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { InlineStatusForm } from "./inline-status-form";
import { DeleteApplicationButton } from "./delete-application-button";

export default async function CandidaturesPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/candidatures`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  if (roles.length === 0) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Vous n&apos;êtes pas membre de cette organisation.</p>
        </CardContent>
      </Card>
    );
  }

  const isAdmin = roles.includes("admin");
  // Bénévoles can also work candidatures (change status, record the
  // adopted animal) — only famille d'accueil is read-only here.
  const canEditStatus = isAdmin || roles.includes("benevole");

  const [applications, animalsList] = await Promise.all([
    listAdoptionApplications({ organizationId: organization.id }),
    canEditStatus ? listAnimals({ organizationId: organization.id }) : Promise.resolve([]),
  ]);
  const animalOptions = animalsList.map((animal) => ({ id: animal.id, name: animal.name }));
  const publicFormPath = `/organisations/${params.org}/adopter`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {organization.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Candidatures d&apos;adoption</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Formulaire public à partager :{" "}
          <Link href={publicFormPath} target="_blank" className="text-foreground hover:underline">
            {publicFormPath}
          </Link>
        </p>
      </div>

      <Card>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune candidature reçue pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Animal souhaité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Animal adopté</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application.id} className={ADOPTION_STATUS_ROW_CLASS[application.status]}>
                    <TableCell>
                      <Link
                        href={`/organisations/${params.org}/candidatures/${application.id}`}
                        className="font-medium hover:underline"
                      >
                        {application.firstName} {application.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{application.city || "—"}</TableCell>
                    <TableCell>{application.email}</TableCell>
                    <TableCell>
                      {application.desiredSpecies ? SPECIES_LABELS[application.desiredSpecies] : "—"}
                      {application.specificAnimalName ? ` (${application.specificAnimalName})` : ""}
                    </TableCell>
                    <TableCell>
                      {canEditStatus ? (
                        <InlineStatusForm
                          organizationId={organization.id}
                          applicationId={application.id}
                          currentStatus={application.status}
                          currentTargetAnimalId={application.targetAnimalId}
                          animals={animalOptions}
                        />
                      ) : (
                        <Badge variant={ADOPTION_STATUS_BADGE_VARIANT[application.status]}>
                          {ADOPTION_STATUS_LABELS[application.status]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {application.targetAnimal ? (
                        <Link
                          href={`/organisations/${params.org}/animaux/${application.targetAnimal.id}`}
                          className="hover:underline"
                        >
                          {application.targetAnimal.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DeleteApplicationButton
                          organizationId={organization.id}
                          applicationId={application.id}
                          applicantName={`${application.firstName} ${application.lastName}`}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
