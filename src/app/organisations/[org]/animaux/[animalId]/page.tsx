import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { animals } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listFosterFamilies } from "@/server/actions/foster-families";
import { SPECIES_LABELS, SEX_LABELS, STATUS_LABELS } from "@/lib/animal-labels";
import { AnimalEditForm } from "./animal-edit-form";
import { HealthChecklistForm } from "./health-checklist-form";
import { StatusForm } from "./status-form";

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

  const fosterFamilies = isAdmin
    ? await listFosterFamilies({ organizationId: organization.id })
    : [];

  return (
    <main style={{ maxWidth: 720, margin: "60px auto", fontFamily: "sans-serif" }}>
      <p>
        <a href={`/organisations/${params.org}/animaux`}>&larr; Animaux</a>
      </p>
      <h1>{animal.name}</h1>

      <section style={{ marginTop: 24 }}>
        <h2>Informations générales</h2>
        {isAdmin ? (
          <AnimalEditForm organizationId={organization.id} animal={animal} />
        ) : (
          <dl>
            <dt>Espèce</dt>
            <dd>{SPECIES_LABELS[animal.species]}</dd>
            <dt>Sexe</dt>
            <dd>{SEX_LABELS[animal.sex]}</dd>
            <dt>Race</dt>
            <dd>{animal.breed || "—"}</dd>
            <dt>Pelage</dt>
            <dd>{animal.coat || "—"}</dd>
            <dt>N° ICAD</dt>
            <dd>{animal.icadNumber || "—"}</dd>
            <dt>Date de naissance</dt>
            <dd>{animal.birthDate || "—"}</dd>
            <dt>Date de prise en charge</dt>
            <dd>{animal.intakeDate}</dd>
            <dt>Description</dt>
            <dd>{animal.description || "—"}</dd>
          </dl>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Statut &amp; famille d&apos;accueil</h2>
        <p>
          Statut actuel : <strong>{STATUS_LABELS[animal.status]}</strong>
          {animal.currentFosterFamily && (
            <>
              {" — "}
              {animal.currentFosterFamily.firstName} {animal.currentFosterFamily.lastName}
            </>
          )}
        </p>
        {animal.adoptionDate && <p>Adopté le {animal.adoptionDate}</p>}
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
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Checklist santé</h2>
        {animal.healthChecklist &&
          (isAdmin ? (
            <HealthChecklistForm
              organizationId={organization.id}
              animalId={animal.id}
              checklist={animal.healthChecklist}
            />
          ) : (
            <dl>
              <dt>Primo vaccin</dt>
              <dd>
                {animal.healthChecklist.firstVaccineDone ? "Fait" : "Non fait"}
                {animal.healthChecklist.firstVaccineDate &&
                  ` (${animal.healthChecklist.firstVaccineDate})`}
              </dd>
              <dt>Stérilisation</dt>
              <dd>
                {animal.healthChecklist.sterilizationDone ? "Fait" : "Non fait"}
                {animal.healthChecklist.sterilizationDate &&
                  ` (${animal.healthChecklist.sterilizationDate})`}
              </dd>
              <dt>Rappel</dt>
              <dd>
                {animal.healthChecklist.boosterDone ? "Fait" : "Non fait"}
                {animal.healthChecklist.boosterDate && ` (${animal.healthChecklist.boosterDate})`}
              </dd>
            </dl>
          ))}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Historique des placements</h2>
        {animal.placements.length === 0 ? (
          <p style={{ color: "#666" }}>Aucun placement enregistré.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: "8px 4px" }}>Famille d&apos;accueil</th>
                <th style={{ padding: "8px 4px" }}>Début</th>
                <th style={{ padding: "8px 4px" }}>Fin</th>
              </tr>
            </thead>
            <tbody>
              {animal.placements.map((placement) => (
                <tr key={placement.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px 4px" }}>
                    {placement.fosterFamily.firstName} {placement.fosterFamily.lastName}
                  </td>
                  <td style={{ padding: "8px 4px" }}>
                    {new Date(placement.startedAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td style={{ padding: "8px 4px" }}>
                    {placement.endedAt
                      ? new Date(placement.endedAt).toLocaleDateString("fr-FR")
                      : "En cours"}
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
