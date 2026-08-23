import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles, getMemberPermissions } from "@/lib/permissions";
import { getAdoptionApplication } from "@/server/actions/adoption-applications";
import { listAnimals } from "@/server/actions/animals";
import { listDocuments } from "@/server/actions/documents";
import { listHelloAssoLinks } from "@/server/actions/helloasso-links";
import {
  ADOPTION_STATUS_LABELS,
  ADOPTION_STATUS_BADGE_VARIANT,
  HOUSING_ZONE_LABELS,
  HOUSING_TYPE_LABELS,
  RESIDENCY_STATUS_LABELS,
  LIVING_SITUATION_LABELS,
  ACTIVITY_LEVEL_LABELS,
  ALONE_TIME_LABELS,
} from "@/lib/adoption-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ApplicationStatusForm } from "./application-status-form";
import { SendCertificateForm } from "./send-certificate-form";
import { GenerateContractForm } from "./generate-contract-form";

const DOCUMENT_TYPE_LABELS = {
  certificat_engagement: "Certificat d'engagement",
  contrat_adoption: "Contrat d'adoption",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function CandidatureDetailPage(
  props: {
    params: Promise<{ org: string; applicationId: string }>;
  }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/connexion?callbackUrl=/organisations/${params.org}/candidatures/${params.applicationId}`,
    );
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const [roles, permissions] = await Promise.all([
    getMemberRoles(session.user.id, organization.id),
    getMemberPermissions(session.user.id, organization.id),
  ]);
  const isAdmin = roles.includes("admin");
  const canView = isAdmin || permissions.includes("candidature");
  const canSendDocuments = isAdmin || permissions.includes("contrat");
  if (!canView) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seul·e·s les administrateur·rice·s et les bénévoles avec le droit &quot;Candidature&quot;
            peuvent accéder au détail d&apos;une candidature.
          </p>
        </CardContent>
      </Card>
    );
  }

  const application = await getAdoptionApplication({
    applicationId: params.applicationId,
    organizationId: organization.id,
  });

  const [animalsList, documentsList, helloAssoLinksList] = await Promise.all([
    listAnimals({ organizationId: organization.id }),
    listDocuments({ organizationId: organization.id, adoptionApplicationId: application.id }),
    canSendDocuments ? listHelloAssoLinks({ organizationId: organization.id }) : Promise.resolve([]),
  ]);

  // Only animals still available to place: one already adopted or archived
  // shouldn't be pickable for a new certificate/contract.
  const adoptableAnimals = animalsList.filter(
    (animal) => animal.status !== "adopte" && animal.status !== "archive",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}/candidatures`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Candidatures
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {application.firstName} {application.lastName}
          </h1>
          <Badge variant={ADOPTION_STATUS_BADGE_VARIANT[application.status]}>
            {ADOPTION_STATUS_LABELS[application.status]}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coordonnées</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="Ville" value={application.city || "—"} />
            <InfoRow label="Téléphone" value={application.phone} />
            <InfoRow label="Email" value={application.email} />
            <InfoRow
              label="Âge"
              value={
                <>
                  {application.age ?? "—"}
                  {application.spouseAge ? ` (conjoint·e : ${application.spouseAge})` : ""}
                </>
              }
            />
            <InfoRow
              label="Profession"
              value={
                <>
                  {application.profession || "—"}
                  {application.spouseProfession ? ` (conjoint·e : ${application.spouseProfession})` : ""}
                </>
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logement</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="Zone" value={application.housingZone ? HOUSING_ZONE_LABELS[application.housingZone] : "—"} />
            <InfoRow label="Type" value={application.housingType ? HOUSING_TYPE_LABELS[application.housingType] : "—"} />
            {application.housingType === "appartement" ? (
              <InfoRow
                label="Superficie"
                value={application.apartmentAreaM2 ? `${application.apartmentAreaM2} m²` : "—"}
              />
            ) : (
              <>
                <InfoRow
                  label="Jardin"
                  value={
                    <>
                      {application.gardenAreaM2 ? `${application.gardenAreaM2} m²` : "—"}
                      {application.fenceHeight ? ` — clôture : ${application.fenceHeight}` : ""}
                    </>
                  }
                />
                <InfoRow label="Accès jardin / mise en liberté" value={application.gardenAccessDetails || "—"} />
              </>
            )}
            <InfoRow
              label="Statut résidence"
              value={
                <>
                  {application.residencyStatus ? RESIDENCY_STATUS_LABELS[application.residencyStatus] : "—"}
                  {application.residencyDuration ? ` — depuis ${application.residencyDuration}` : ""}
                </>
              }
            />
            <InfoRow
              label="Situation"
              value={application.livingSituation ? LIVING_SITUATION_LABELS[application.livingSituation] : "—"}
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Foyer</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow
              label="Composition"
              value={`${application.familySize ?? "—"} personne(s), dont ${application.childrenCount ?? 0} enfant(s)`}
            />
            <InfoRow label="Allergies" value={application.allergiesDetails || "Non"} />
            <InfoRow
              label="Niveau d'activité"
              value={application.activityLevel ? ACTIVITY_LEVEL_LABELS[application.activityLevel] : "—"}
            />
            <InfoRow
              label="Accord familial"
              value={
                application.familyAgrees
                  ? "Oui"
                  : `Non — ${application.familyDisagreementReason || "raison non précisée"}`
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Animaux déjà présents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {application.hasOtherAnimals ? application.otherAnimalsDetails || "Oui" : "Aucun"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organisation du quotidien</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow label="Référent" value={application.caretakerPerson || "—"} />
            <InfoRow label="Espace de sommeil" value={application.sleepingArea || "—"} />
            <InfoRow
              label="Temps seul par jour"
              value={application.aloneTimePerDay ? ALONE_TIME_LABELS[application.aloneTimePerDay] : "—"}
            />
            {application.desiredSpecies === "chien" && (
              <>
                <InfoRow label="Promenades par jour" value={application.dogWalksPerDay ?? "—"} />
                <InfoRow
                  label="Sortie entre midi et deux possible"
                  value={application.dogMiddayWalkPossible ? "Oui" : "Non"}
                />
              </>
            )}
            <InfoRow label="Weekends / vacances" value={application.vacationPlan || "—"} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Souhait d&apos;adoption</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            <InfoRow
              label="Espèce souhaitée"
              value={application.desiredSpecies ? SPECIES_LABELS[application.desiredSpecies] : "—"}
            />
            <InfoRow label="Coup de cœur" value={application.specificAnimalName || "—"} />
            <InfoRow label="Commentaire" value={application.additionalComments || "—"} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statut de la candidature</CardTitle>
        </CardHeader>
        <CardContent>
          <ApplicationStatusForm
            organizationId={organization.id}
            applicationId={application.id}
            currentStatus={application.status}
            currentReviewNotes={application.reviewNotes}
          />
        </CardContent>
      </Card>

      {canSendDocuments && (
        <Card>
          <CardHeader>
            <CardTitle>Certificat d&apos;engagement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Envoyé tel quel, sans remplissage — l&apos;adoptant·e le complète et le signe de son côté.
            </p>
            <SendCertificateForm
              organizationId={organization.id}
              applicationId={application.id}
              animals={adoptableAnimals.map((a) => ({ id: a.id, name: a.name }))}
              defaultAnimalId={application.targetAnimalId ?? ""}
              defaultEmail={application.email}
            />
          </CardContent>
        </Card>
      )}

      {canSendDocuments && (
        <Card>
          <CardHeader>
            <CardTitle>Contrat d&apos;adoption</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Généré et rempli avec les informations de l&apos;animal et de l&apos;adoptant·e.
            </p>
            <GenerateContractForm
              organizationId={organization.id}
              applicationId={application.id}
              animals={adoptableAnimals.map((a) => ({ id: a.id, name: a.name }))}
              helloAssoLinks={helloAssoLinksList.map((l) => ({ id: l.id, label: l.label, url: l.url }))}
              defaultAnimalId={application.targetAnimalId ?? ""}
              defaultEmail={application.email}
              defaultAdopterFullName={`${application.firstName} ${application.lastName}`}
              defaultAdopterCity={application.city ?? ""}
              defaultAdopterPhone1={application.phone}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents envoyés</CardTitle>
        </CardHeader>
        <CardContent>
          {documentsList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun document envoyé pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Destinataire</TableHead>
                  <TableHead>Envoyé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentsList.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>{DOCUMENT_TYPE_LABELS[document.type]}</TableCell>
                    <TableCell>{document.sentToEmail || "—"}</TableCell>
                    <TableCell>
                      {document.sentAt ? new Date(document.sentAt).toLocaleString("fr-FR") : "—"}
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
