import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listAnimals } from "@/server/actions/animals";
import { listFosterFamilies } from "@/server/actions/foster-families";
import { SPECIES_LABELS, STATUS_LABELS } from "@/lib/animal-labels";
import { CreateAnimalDialog } from "./create-animal-dialog";

export default async function AnimauxPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/animaux`);
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

  const [animalsList, fosterFamilies] = await Promise.all([
    listAnimals({ organizationId: organization.id }),
    listFosterFamilies({ organizationId: organization.id }),
  ]);

  return (
    <main style={{ maxWidth: 960, margin: "60px auto", fontFamily: "sans-serif" }}>
      <p>
        <a href={`/organisations/${params.org}`}>&larr; {organization.name}</a>
      </p>
      <h1>Animaux</h1>

      {isAdmin && (
        <CreateAnimalDialog
          organizationId={organization.id}
          fosterFamilies={fosterFamilies.map((f) => ({
            id: f.id,
            firstName: f.firstName,
            lastName: f.lastName,
          }))}
        />
      )}

      <table style={{ marginTop: 24, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "8px 4px" }}>Nom</th>
            <th style={{ padding: "8px 4px" }}>Espèce</th>
            <th style={{ padding: "8px 4px" }}>Statut</th>
            <th style={{ padding: "8px 4px" }}>Famille d&apos;accueil</th>
          </tr>
        </thead>
        <tbody>
          {animalsList.map((animal) => (
            <tr key={animal.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "8px 4px" }}>
                <a href={`/organisations/${params.org}/animaux/${animal.id}`}>{animal.name}</a>
              </td>
              <td style={{ padding: "8px 4px" }}>{SPECIES_LABELS[animal.species]}</td>
              <td style={{ padding: "8px 4px" }}>{STATUS_LABELS[animal.status]}</td>
              <td style={{ padding: "8px 4px" }}>
                {animal.currentFosterFamily
                  ? `${animal.currentFosterFamily.firstName} ${animal.currentFosterFamily.lastName}`
                  : "—"}
              </td>
            </tr>
          ))}
          {animalsList.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "16px 4px", color: "#666" }}>
                Aucun animal enregistré pour le moment.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
