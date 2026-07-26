import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { OrganizationProfileForm } from "./organization-profile-form";

export default async function ParametresPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/parametres`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  if (!roles.includes("admin")) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Accès refusé</h1>
        <p>Seul·e·s les administrateur·rice·s peuvent modifier les paramètres.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "60px auto", fontFamily: "sans-serif" }}>
      <p>
        <a href={`/organisations/${params.org}`}>&larr; {organization.name}</a>
      </p>
      <h1>Paramètres de l&apos;association</h1>
      <p style={{ color: "#666" }}>
        Ces informations (SIREN, coordonnées, numéro de déclaration en préfecture) apparaissent
        sur les contrats d&apos;adoption générés.
      </p>
      <OrganizationProfileForm organization={organization} />
    </main>
  );
}
