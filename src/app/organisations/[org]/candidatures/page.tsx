import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listAdoptionApplications } from "@/server/actions/adoption-applications";
import { ADOPTION_STATUS_LABELS } from "@/lib/adoption-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";

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
      <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Accès refusé</h1>
        <p>Vous n&apos;êtes pas membre de cette organisation.</p>
      </main>
    );
  }

  const applications = await listAdoptionApplications({ organizationId: organization.id });
  const publicFormPath = `/organisations/${params.org}/adopter`;

  return (
    <main style={{ maxWidth: 1000, margin: "60px auto", fontFamily: "sans-serif" }}>
      <p>
        <a href={`/organisations/${params.org}`}>&larr; {organization.name}</a>
      </p>
      <h1>Candidatures d&apos;adoption</h1>
      <p>
        Formulaire public à partager : <a href={publicFormPath}>{publicFormPath}</a>
      </p>

      <table style={{ marginTop: 24, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "8px 4px" }}>Nom</th>
            <th style={{ padding: "8px 4px" }}>Ville</th>
            <th style={{ padding: "8px 4px" }}>Email</th>
            <th style={{ padding: "8px 4px" }}>Animal souhaité</th>
            <th style={{ padding: "8px 4px" }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "8px 4px" }}>
                <a href={`/organisations/${params.org}/candidatures/${application.id}`}>
                  {application.firstName} {application.lastName}
                </a>
              </td>
              <td style={{ padding: "8px 4px" }}>{application.city || "—"}</td>
              <td style={{ padding: "8px 4px" }}>{application.email}</td>
              <td style={{ padding: "8px 4px" }}>
                {application.desiredSpecies ? SPECIES_LABELS[application.desiredSpecies] : "—"}
                {application.specificAnimalName ? ` (${application.specificAnimalName})` : ""}
              </td>
              <td style={{ padding: "8px 4px" }}>{ADOPTION_STATUS_LABELS[application.status]}</td>
            </tr>
          ))}
          {applications.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: "16px 4px", color: "#666" }}>
                Aucune candidature reçue pour le moment.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
