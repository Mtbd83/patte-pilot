import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";

export default async function OrganizationPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}`);
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

  return (
    <main style={{ maxWidth: 720, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>{organization.name}</h1>
      <p>Bienvenue sur votre espace de gestion.</p>
      <nav style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <a href={`/organisations/${params.org}/animaux`}>Animaux</a>
        <a href={`/organisations/${params.org}/familles-accueil`}>Familles d&apos;accueil</a>
        <a href={`/organisations/${params.org}/comptabilite`}>Comptabilité</a>
        <a href={`/organisations/${params.org}/stock`}>Stock</a>
        <a href={`/organisations/${params.org}/candidatures`}>Candidatures d&apos;adoption</a>
        <a href={`/organisations/${params.org}/membres`}>Gérer les membres</a>
        <a href={`/organisations/${params.org}/parametres`}>Paramètres</a>
      </nav>
    </main>
  );
}
