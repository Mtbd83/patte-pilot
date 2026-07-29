import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { animals } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listFosterFamilies } from "@/server/actions/foster-families";
import { SPECIES_LABELS, SEX_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/animal-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AnimalEditForm } from "./animal-edit-form";
import { AnimalPhotoUpload } from "./animal-photo-upload";
import { AnimalDescriptionForm } from "./animal-description-form";
import { HealthChecklistForm } from "./health-checklist-form";
import { StatusForm } from "./status-form";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function AnimalDetailPage({
  params,
}: {
  params: { org: string; animalId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/animaux/${params.animalId}`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) return null;

  const roles = await getMemberRoles(session.user.id, organization.id);

  const animal = await db.query.animals.findFirst({
    where: and(eq(animals.id, params.animalId), eq(animals.organizationId, organization.id)),
    with: {
      healthChecklist: true,
      currentFosterFamily: true,
      placements: {
        with: { fosterFamily: true },
        orderBy: (placement) => desc(placement.startedAt),
      },
    },
  });
  if (!animal) notFound();

  const isAdmin = roles.includes("admin");
  const isResponsibleFosterFamily =
    !isAdmin &&
    roles.includes("famille_accueil") &&
    animal.currentFosterFamily?.linkedUserId === session.user.id;
  const canEditHealthChecklist = isAdmin || isResponsibleFosterFamily;

  const fosterFamilies = isAdmin
    ? await listFosterFamilies({ organizationId: organization.id })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}/animaux`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Animaux
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{animal.name}</h1>
          <Badge variant={STATUS_BADGE_VARIANT[animal.status]}>{STATUS_LABELS[animal.status]}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isAdmin || (isResponsibleFosterFamily && !animal.photoUrl) ? (
            <AnimalPhotoUpload organizationId={organization.id} animalId={animal.id} photoUrl={animal.photoUrl} />
          ) : (
            animal.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={animal.photoUrl}
                alt={animal.name}
                className="size-24 rounded-lg border border-border object-cover"
              />
            )
          )}
          {isAdmin ? (
            <AnimalEditForm organizationId={organization.id} animal={animal} />
          ) : (
            <>
              <dl>
                <InfoRow label="Espèce" value={SPECIES_LABELS[animal.species]} />
                <InfoRow label="Sexe" value={SEX_LABELS[animal.sex]} />
                <InfoRow label="Race" value={animal.breed || "—"} />
                <InfoRow label="Pelage" value={animal.coat || "—"} />
                <InfoRow label="N° ICAD" value={animal.icadNumber || "—"} />
                <InfoRow label="Date de naissance" value={animal.birthDate || "—"} />
                <InfoRow label="Date de prise en charge" value={animal.intakeDate} />
                {!isResponsibleFosterFamily && <InfoRow label="Description" value={animal.description || "—"} />}
              </dl>
              {isResponsibleFosterFamily && (
                <AnimalDescriptionForm
                  organizationId={organization.id}
                  animalId={animal.id}
                  description={animal.description}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statut &amp; famille d&apos;accueil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            Statut actuel : <strong>{STATUS_LABELS[animal.status]}</strong>
            {animal.currentFosterFamily && (
              <>
                {" — "}
                {animal.currentFosterFamily.firstName} {animal.currentFosterFamily.lastName}
              </>
            )}
          </p>
          {animal.adoptionDate && (
            <p className="text-sm text-muted-foreground">Adopté le {animal.adoptionDate}</p>
          )}
          {isAdmin && (
            <StatusForm
              organizationId={organization.id}
              animalId={animal.id}
              currentStatus={animal.status}
              currentFosterFamilyId={animal.currentFosterFamilyId}
              fosterFamilies={fosterFamilies.map((f) => ({
                id: f.id,
                firstName: f.firstName,
                lastName: f.lastName,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checklist santé</CardTitle>
        </CardHeader>
        <CardContent>
          {animal.healthChecklist &&
            (canEditHealthChecklist ? (
              <HealthChecklistForm
                organizationId={organization.id}
                animalId={animal.id}
                checklist={animal.healthChecklist}
              />
            ) : (
              <dl>
                <InfoRow
                  label="Primo vaccin"
                  value={
                    animal.healthChecklist.firstVaccineDone
                      ? `Fait${animal.healthChecklist.firstVaccineDate ? ` (${animal.healthChecklist.firstVaccineDate})` : ""}`
                      : "Non fait"
                  }
                />
                <InfoRow
                  label="Stérilisation"
                  value={
                    animal.healthChecklist.sterilizationDone
                      ? `Fait${animal.healthChecklist.sterilizationDate ? ` (${animal.healthChecklist.sterilizationDate})` : ""}`
                      : "Non fait"
                  }
                />
                <InfoRow
                  label="Rappel"
                  value={
                    animal.healthChecklist.boosterDone
                      ? `Fait${animal.healthChecklist.boosterDate ? ` (${animal.healthChecklist.boosterDate})` : ""}`
                      : "Non fait"
                  }
                />
                <InfoRow
                  label="Vermifuge"
                  value={
                    animal.healthChecklist.dewormingDone
                      ? `Fait${animal.healthChecklist.dewormingDate ? ` (${animal.healthChecklist.dewormingDate})` : ""}`
                      : "Non fait"
                  }
                />
                <InfoRow
                  label="Déparasitage externe"
                  value={
                    animal.healthChecklist.externalTreatmentDone
                      ? `Fait${animal.healthChecklist.externalTreatmentDate ? ` (${animal.healthChecklist.externalTreatmentDate})` : ""}`
                      : "Non fait"
                  }
                />
              </dl>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des placements</CardTitle>
        </CardHeader>
        <CardContent>
          {animal.placements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun placement enregistré.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Famille d&apos;accueil</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {animal.placements.map((placement) => (
                  <TableRow key={placement.id}>
                    <TableCell>
                      {placement.fosterFamily.firstName} {placement.fosterFamily.lastName}
                    </TableCell>
                    <TableCell>{new Date(placement.startedAt).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      {placement.endedAt
                        ? new Date(placement.endedAt).toLocaleDateString("fr-FR")
                        : "En cours"}
                    </TableCell>
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
