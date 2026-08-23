import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { organizationMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/role-labels";
import { PERMISSION_LABELS, PERMISSION_DESCRIPTIONS } from "@/lib/permission-labels";
import type { OrgRole, OrgPermission } from "@/db/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberRolesForm } from "./member-roles-form";

export default async function MembresPage(
  props: {
    params: Promise<{ org: string }>;
  }
) {
  const params = await props.params;
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
    with: { user: true, roles: true, permissions: true },
  });

  const roleValues: OrgRole[] = ["admin", "benevole", "famille_accueil"];
  const permissionValues: OrgPermission[] = [
    "prise_en_charge",
    "comptabilite",
    "candidature",
    "contrat",
    "gestion_famille_accueil",
  ];

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

      <details className="rounded-md border border-border">
        <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium">
          Explication des rôles et des droits
        </summary>
        <div className="flex flex-col gap-4 border-t border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Rôles</p>
            <dl className="mt-1 flex flex-col gap-1">
              {roleValues.map((role) => (
                <div key={role} className="text-sm">
                  <dt className="inline font-medium">{ROLE_LABELS[role]} — </dt>
                  <dd className="inline text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="text-sm font-medium">Droits du bénévole (cumulables)</p>
            <dl className="mt-1 flex flex-col gap-1">
              {permissionValues.map((permission) => (
                <div key={permission} className="text-sm">
                  <dt className="inline font-medium">{PERMISSION_LABELS[permission]} — </dt>
                  <dd className="inline text-muted-foreground">{PERMISSION_DESCRIPTIONS[permission]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </details>

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
                  currentPermissions={member.permissions.map((p) => p.permission)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
