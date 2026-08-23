import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { animals } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles, getMemberPermissions } from "@/lib/permissions";
import { listFosterFamilies } from "@/server/actions/foster-families";
import { listAccountingEntriesPage, getAccountingSummary } from "@/server/actions/accounting";
import { SPECIES_LABELS, SEX_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/animal-labels";
import { ACCOUNTING_TYPE_LABELS, ACCOUNTING_CATEGORY_LABELS } from "@/lib/accounting-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AnimalEditForm } from "./animal-edit-form";
import { AnimalPhotoUpload } from "./animal-photo-upload";
import { AnimalDescriptionForm } from "./animal-description-form";
import { HealthChecklistForm } from "./health-checklist-form";
import { StatusForm } from "./status-form";
import { PlacementDialog } from "./placement-dialog";
import { DeletePlacementButton } from "./delete-placement-button";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function AnimalDetailPage(
  props: {
    params: Promise<{ org: string; animalId: string }>;
  }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/animaux/${params.animalId}`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) return null;

  const [roles, permissions] = await Promise.all([
    getMemberRoles(session.user.id, organization.id),
    getMemberPermissions(session.user.id, organization.id),
  ]);

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
  const canManageAnimals = isAdmin || permissions.includes("prise_en_charge");
  const canManageFosterFamilies = isAdmin || permissions.includes("gestion_famille_accueil");
  const canAccessComptabilite = isAdmin || permissions.includes("comptabilite");

  const fosterFamilies = canManageAnimals
    ? await listFosterFamilies({ organizationId: organization.id })
    : [];
  // Includes inactive families too — a historical placement may well have
  // been with a family that's since been deactivated.
  const allFosterFamilies = canManageFosterFamilies
    ? await listFosterFamilies({ organizationId: organization.id, includeInactive: true })
    : [];

  const [{ entries: accountingEntries, total: accountingTotalCount }, accountingSummary] = canAccessComptabilite
    ? await Promise.all([
        listAccountingEntriesPage({ organizationId: organization.id, animalId: animal.id, page: 1 }),
        getAccountingSummary({ organizationId: organization.id, animalId: animal.id }),
      ])
    : [{ entries: [], total: 0 }, { totalIn: 0, totalOut: 0, balance: 0 }];

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
          {canManageAnimals || (isResponsibleFosterFamily && !animal.photoUrl) ? (
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
          {canManageAnimals ? (
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
          {canManageAnimals && (
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
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Historique des placements</CardTitle>
          {canManageFosterFamilies && allFosterFamilies.length > 0 && (
            <PlacementDialog
              organizationId={organization.id}
              animalId={animal.id}
              fosterFamilies={allFosterFamilies.map((f) => ({ id: f.id, firstName: f.firstName, lastName: f.lastName }))}
            />
          )}
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
                  {canManageFosterFamilies && <TableHead />}
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
                    {canManageFosterFamilies && (
                      <TableCell>
                        <div className="flex gap-1">
                          <PlacementDialog
                            organizationId={organization.id}
                            animalId={animal.id}
                            fosterFamilies={allFosterFamilies.map((f) => ({
                              id: f.id,
                              firstName: f.firstName,
                              lastName: f.lastName,
                            }))}
                            placement={placement}
                          />
                          <DeletePlacementButton
                            organizationId={organization.id}
                            animalId={animal.id}
                            placementId={placement.id}
                            familyName={`${placement.fosterFamily.firstName} ${placement.fosterFamily.lastName}`}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canAccessComptabilite && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Comptabilité</CardTitle>
            <Link
              href={`/organisations/${params.org}/comptabilite?animalId=${animal.id}`}
              className="text-sm text-primary hover:underline"
            >
              Voir dans la comptabilité
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">
              Entrées : <strong>{accountingSummary.totalIn.toFixed(2)} €</strong> — Sorties :{" "}
              <strong>{accountingSummary.totalOut.toFixed(2)} €</strong> — Solde :{" "}
              <strong>{accountingSummary.balance.toFixed(2)} €</strong>
            </p>
            {accountingEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune écriture comptable liée à cet animal.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Commentaire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountingEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell>{ACCOUNTING_TYPE_LABELS[entry.type]}</TableCell>
                      <TableCell>{ACCOUNTING_CATEGORY_LABELS[entry.category]}</TableCell>
                      <TableCell>{Number(entry.amount).toFixed(2)} €</TableCell>
                      <TableCell>{entry.comment || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {accountingTotalCount > accountingEntries.length && (
              <p className="text-sm text-muted-foreground">
                {accountingTotalCount} écritures au total —{" "}
                <Link
                  href={`/organisations/${params.org}/comptabilite?animalId=${animal.id}`}
                  className="text-primary hover:underline"
                >
                  voir toutes les écritures
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
