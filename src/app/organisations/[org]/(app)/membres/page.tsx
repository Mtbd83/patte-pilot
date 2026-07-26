import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { organizationMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { InviteMemberDialog } from "./invite-member-dialog";

export default async function MembresPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/connexion?callbackUrl=/organisations/${params.org}/membres`);

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) return null;

  const roles = await getMemberRoles(session.user.id, organization.id);
  if (!roles.includes("admin")) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="text-lg font-semibold">Accès refusé</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seul·e·s les administrateur·rice·s peuvent gérer les membres.
        </p>
      </div>
    );
  }

  const members = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.organizationId, organization.id),
    with: { user: true, roles: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Membres</h1>
        <p className="mt-1 text-muted-foreground">{organization.name}</p>
      </div>

      <InviteMemberDialog organizationId={organization.id} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Rôles</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">{member.user.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {member.roles.length > 0 ? (
                    member.roles.map((r) => (
                      <Badge key={r.id} variant="secondary">
                        {r.role}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Aucun rôle</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
