import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { organizationMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { InviteMemberDialog } from "./invite-member-dialog";

export default async function MembresPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/membres`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  if (!roles.includes("admin")) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Accès refusé</h1>
        <p>Seul·e·s les administrateur·rice·s peuvent gérer les membres.</p>
      </main>
    );
  }

  const members = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.organizationId, organization.id),
    with: { user: true, roles: true },
  });

  return (
    <main style={{ maxWidth: 720, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Membres de {organization.name}</h1>
      <InviteMemberDialog organizationId={organization.id} />
      <ul style={{ marginTop: 24, listStyle: "none", padding: 0 }}>
        {members.map((member) => (
          <li key={member.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
            {member.user.email} — {member.roles.map((r) => r.role).join(", ") || "aucun rôle"}
          </li>
        ))}
      </ul>
    </main>
  );
}
