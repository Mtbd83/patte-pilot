import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listFosterFamilies } from "@/server/actions/foster-families";
import { CreateFosterFamilyDialog } from "./create-foster-family-dialog";

export default async function FamillesAccueilPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/familles-accueil`);
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

  const fosterFamilies = await listFosterFamilies({
    organizationId: organization.id,
    includeInactive: true,
  });

  return (
    <main style={{ maxWidth: 960, margin: "60px auto", fontFamily: "sans-serif" }}>
      <p>
        <a href={`/organisations/${params.org}`}>&larr; {organization.name}</a>
      </p>
      <h1>Familles d&apos;accueil</h1>

      {isAdmin && <CreateFosterFamilyDialog organizationId={organization.id} />}

      <table style={{ marginTop: 24, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "8px 4px" }}>Nom</th>
            <th style={{ padding: "8px 4px" }}>Téléphone</th>
            <th style={{ padding: "8px 4px" }}>Email</th>
            <th style={{ padding: "8px 4px" }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {fosterFamilies.map((family) => (
            <tr key={family.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "8px 4px" }}>
                <a href={`/organisations/${params.org}/familles-accueil/${family.id}`}>
                  {family.firstName} {family.lastName}
                </a>
              </td>
              <td style={{ padding: "8px 4px" }}>{family.phone || "—"}</td>
              <td style={{ padding: "8px 4px" }}>{family.email || "—"}</td>
              <td style={{ padding: "8px 4px" }}>{family.isActive ? "Active" : "Inactive"}</td>
            </tr>
          ))}
          {fosterFamilies.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "16px 4px", color: "#666" }}>
                Aucune famille d&apos;accueil enregistrée pour le moment.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
