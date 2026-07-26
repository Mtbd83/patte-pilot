import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { fosterFamilies } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { SPECIES_LABELS, STATUS_LABELS } from "@/lib/animal-labels";
import { FosterFamilyEditForm } from "./foster-family-edit-form";
import { DeactivateFosterFamilyButton } from "./deactivate-foster-family-button";

export default async function FosterFamilyDetailPage({
  params,
}: {
  params: { org: string; fosterFamilyId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/connexion?callbackUrl=/organisations/${params.org}/familles-accueil/${params.fosterFamilyId}`,
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

  const fosterFamily = await db.query.fosterFamilies.findFirst({
    where: and(
      eq(fosterFamilies.id, params.fosterFamilyId),
      eq(fosterFamilies.organizationId, organization.id),
    ),
    with: {
      animalsHosted: true,
      placements: {
        with: { animal: true },
        orderBy: (placement) => desc(placement.startedAt),
      },
    },
  });
  if (!fosterFamily) notFound();

  const isAdmin = roles.includes("admin");
  const otherAnimals = [
    fosterFamily.hasCats && "Chats",
    fosterFamily.hasDogs && "Chiens",
    fosterFamily.hasRabbits && "Lapins",
  ].filter(Boolean) as string[];

  return (
    <main style={{ maxWidth: 720, margin: "60px auto", fontFamily: "sans-serif" }}>
      <p>
        <a href={`/organisations/${params.org}/familles-accueil`}>&larr; Familles d&apos;accueil</a>
      </p>
      <h1>
        {fosterFamily.firstName} {fosterFamily.lastName}
      </h1>
      <p>{fosterFamily.isActive ? "Active" : "Inactive"}</p>

      <section style={{ marginTop: 24 }}>
        <h2>Coordonnées</h2>
        {isAdmin ? (
          <FosterFamilyEditForm organizationId={organization.id} fosterFamily={fosterFamily} />
        ) : (
          <dl>
            <dt>Adresse</dt>
            <dd>{fosterFamily.address || "—"}</dd>
            <dt>Téléphone</dt>
            <dd>{fosterFamily.phone || "—"}</dd>
            <dt>Email</dt>
            <dd>{fosterFamily.email || "—"}</dd>
            <dt>Autres animaux au foyer</dt>
            <dd>{otherAnimals.length > 0 ? otherAnimals.join(", ") : "Aucun"}</dd>
          </dl>
        )}
      </section>

      {isAdmin && fosterFamily.isActive && (
        <section style={{ marginTop: 32 }}>
          <h2>Désactivation</h2>
          <DeactivateFosterFamilyButton
            organizationId={organization.id}
            fosterFamilyId={fosterFamily.id}
          />
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <h2>Animaux actuellement hébergés</h2>
        {fosterFamily.animalsHosted.length === 0 ? (
          <p style={{ color: "#666" }}>Aucun animal hébergé actuellement.</p>
        ) : (
          <ul>
            {fosterFamily.animalsHosted.map((animal) => (
              <li key={animal.id}>
                <a href={`/organisations/${params.org}/animaux/${animal.id}`}>{animal.name}</a> —{" "}
                {SPECIES_LABELS[animal.species]} — {STATUS_LABELS[animal.status]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Historique des placements</h2>
        {fosterFamily.placements.length === 0 ? (
          <p style={{ color: "#666" }}>Aucun placement enregistré.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: "8px 4px" }}>Animal</th>
                <th style={{ padding: "8px 4px" }}>Début</th>
                <th style={{ padding: "8px 4px" }}>Fin</th>
              </tr>
            </thead>
            <tbody>
              {fosterFamily.placements.map((placement) => (
                <tr key={placement.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px 4px" }}>
                    <a href={`/organisations/${params.org}/animaux/${placement.animal.id}`}>
                      {placement.animal.name}
                    </a>
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
