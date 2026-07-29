import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { organizationMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberRolesForm } from "./member-roles-form";

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
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seul·e·s les administrateur·rice·s peuvent gérer les membres.
          </p>
        </CardContent>
      </Card>
    );
  }

  const members = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.organizationId, organization.id),
    with: { user: true, roles: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {organization.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Membres</h1>
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
                <MemberRolesForm
                  organizationId={organization.id}
                  memberId={member.id}
                  currentRoles={member.roles.map((r) => r.role)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
