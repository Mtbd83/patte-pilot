import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { getAdoptionApplication } from "@/server/actions/adoption-applications";
import { listAnimals } from "@/server/actions/animals";
import { listDocuments } from "@/server/actions/documents";
import {
  ADOPTION_STATUS_LABELS,
  HOUSING_ZONE_LABELS,
  HOUSING_TYPE_LABELS,
  RESIDENCY_STATUS_LABELS,
  LIVING_SITUATION_LABELS,
} from "@/lib/adoption-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { ApplicationStatusForm } from "./application-status-form";
import { SendCertificateForm } from "./send-certificate-form";
import { GenerateContractForm } from "./generate-contract-form";

const DOCUMENT_TYPE_LABELS = {
  certificat_engagement: "Certificat d'engagement",
  contrat_adoption: "Contrat d'adoption",
};

export default async function CandidatureDetailPage({
  params,
}: {
  params: { org: string; applicationId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/connexion?callbackUrl=/organisations/${params.org}/candidatures/${params.applicationId}`,
    );
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  if (roles.length === 0) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Accès refusé</h1>
        <p>Vous n&apos;êtes pas membre de cette organisation.</p>
      </main>
    );
  }

  const isAdmin = roles.includes("admin");

  const application = await getAdoptionApplication({
    applicationId: params.applicationId,
    organizationId: organization.id,
  });

  const [animalsList, documentsList] = await Promise.all([
    isAdmin ? listAnimals({ organizationId: organization.id }) : Promise.resolve([]),
    listDocuments({ organizationId: organization.id, adoptionApplicationId: application.id }),
  ]);

  return (
    <main style={{ maxWidth: 800, margin: "60px auto", fontFamily: "sans-serif" }}>
      <p>
        <a href={`/organisations/${params.org}/candidatures`}>&larr; Candidatures</a>
      </p>
      <h1>
        {application.firstName} {application.lastName}
      </h1>
      <p>Statut : {ADOPTION_STATUS_LABELS[application.status]}</p>

      <section style={{ marginTop: 24 }}>
        <h2>Coordonnées</h2>
        <dl>
          <dt>Ville</dt>
          <dd>{application.city || "—"}</dd>
          <dt>Téléphone</dt>
          <dd>{application.phone}</dd>
          <dt>Email</dt>
          <dd>{application.email}</dd>
          <dt>Âge</dt>
          <dd>
            {application.age ?? "—"}
            {application.spouseAge ? ` (conjoint·e : ${application.spouseAge})` : ""}
          </dd>
          <dt>Profession</dt>
          <dd>
            {application.profession || "—"}
            {application.spouseProfession ? ` (conjoint·e : ${application.spouseProfession})` : ""}
          </dd>
        </dl>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Logement</h2>
        <dl>
          <dt>Zone</dt>
          <dd>{application.housingZone ? HOUSING_ZONE_LABELS[application.housingZone] : "—"}</dd>
          <dt>Type</dt>
          <dd>{application.housingType ? HOUSING_TYPE_LABELS[application.housingType] : "—"}</dd>
          <dt>Jardin</dt>
          <dd>
            {application.gardenAreaM2 ? `${application.gardenAreaM2} m²` : "—"}
            {application.fenceHeight ? ` — clôture : ${application.fenceHeight}` : ""}
          </dd>
          <dt>Accès jardin / mise en liberté</dt>
          <dd>{application.gardenAccessDetails || "—"}</dd>
          <dt>Statut résidence</dt>
          <dd>
            {application.residencyStatus ? RESIDENCY_STATUS_LABELS[application.residencyStatus] : "—"}
            {application.residencyDuration ? ` — depuis ${application.residencyDuration}` : ""}
          </dd>
          <dt>Situation</dt>
          <dd>
            {application.livingSituation ? LIVING_SITUATION_LABELS[application.livingSituation] : "—"}
          </dd>
        </dl>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Foyer</h2>
        <dl>
          <dt>Composition</dt>
          <dd>
            {application.familySize ?? "—"} personne(s), dont {application.childrenCount ?? 0}{" "}
            enfant(s)
          </dd>
          <dt>Allergies</dt>
          <dd>{application.hasAllergies ? "Oui" : "Non"}</dd>
          <dt>Niveau d&apos;activité</dt>
          <dd>{application.activityLevel || "—"}</dd>
          <dt>Accord familial</dt>
          <dd>
            {application.familyAgrees ? "Oui" : `Non — ${application.familyDisagreementReason || "raison non précisée"}`}
          </dd>
        </dl>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Animaux déjà présents</h2>
        <p>{application.hasOtherAnimals ? application.otherAnimalsDetails || "Oui" : "Aucun"}</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Organisation du quotidien</h2>
        <dl>
          <dt>Référent</dt>
          <dd>{application.caretakerPerson || "—"}</dd>
          <dt>Espace de sommeil</dt>
          <dd>{application.sleepingArea || "—"}</dd>
          <dt>Temps seul par jour</dt>
          <dd>{application.aloneTimePerDay || "—"}</dd>
          {application.desiredSpecies === "chien" && (
            <>
              <dt>Promenades par jour</dt>
              <dd>{application.dogWalksPerDay ?? "—"}</dd>
              <dt>Sortie entre midi et deux possible</dt>
              <dd>{application.dogMiddayWalkPossible ? "Oui" : "Non"}</dd>
            </>
          )}
          <dt>Weekends / vacances</dt>
          <dd>{application.vacationPlan || "—"}</dd>
        </dl>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Souhait d&apos;adoption</h2>
        <dl>
          <dt>Espèce souhaitée</dt>
          <dd>{application.desiredSpecies ? SPECIES_LABELS[application.desiredSpecies] : "—"}</dd>
          <dt>Coup de cœur</dt>
          <dd>{application.specificAnimalName || "—"}</dd>
          <dt>Commentaire</dt>
          <dd>{application.additionalComments || "—"}</dd>
        </dl>
      </section>

      {isAdmin && (
        <section style={{ marginTop: 32 }}>
          <h2>Statut de la candidature</h2>
          <ApplicationStatusForm
            organizationId={organization.id}
            applicationId={application.id}
            currentStatus={application.status}
            currentReviewNotes={application.reviewNotes}
          />
        </section>
      )}

      {isAdmin && (
        <section style={{ marginTop: 32 }}>
          <h2>Certificat d&apos;engagement</h2>
          <p style={{ color: "#666", fontSize: 14 }}>
            Envoyé tel quel, sans remplissage — l&apos;adoptant·e le complète et le signe de son
            côté.
          </p>
          <SendCertificateForm
            organizationId={organization.id}
            applicationId={application.id}
            animals={animalsList.map((a) => ({ id: a.id, name: a.name }))}
            defaultAnimalId={application.targetAnimalId ?? ""}
            defaultEmail={application.email}
          />
        </section>
      )}

      {isAdmin && (
        <section style={{ marginTop: 32 }}>
          <h2>Contrat d&apos;adoption</h2>
          <p style={{ color: "#666", fontSize: 14 }}>
            Généré et rempli avec les informations de l&apos;animal et de l&apos;adoptant·e.
          </p>
          <GenerateContractForm
            organizationId={organization.id}
            applicationId={application.id}
            animals={animalsList.map((a) => ({ id: a.id, name: a.name }))}
            defaultAnimalId={application.targetAnimalId ?? ""}
            defaultEmail={application.email}
            defaultAdopterFullName={`${application.firstName} ${application.lastName}`}
            defaultAdopterCity={application.city ?? ""}
            defaultAdopterPhone1={application.phone}
          />
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <h2>Documents envoyés</h2>
        {documentsList.length === 0 ? (
          <p style={{ color: "#666" }}>Aucun document envoyé pour le moment.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: "8px 4px" }}>Type</th>
                <th style={{ padding: "8px 4px" }}>Destinataire</th>
                <th style={{ padding: "8px 4px" }}>Envoyé le</th>
              </tr>
            </thead>
            <tbody>
              {documentsList.map((document) => (
                <tr key={document.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px 4px" }}>{DOCUMENT_TYPE_LABELS[document.type]}</td>
                  <td style={{ padding: "8px 4px" }}>{document.sentToEmail || "—"}</td>
                  <td style={{ padding: "8px 4px" }}>
                    {document.sentAt ? new Date(document.sentAt).toLocaleString("fr-FR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
