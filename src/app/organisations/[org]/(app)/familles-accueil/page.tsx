import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { organizationMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listFosterFamilies } from "@/server/actions/foster-families";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CreateFosterFamilyDialog } from "./create-foster-family-dialog";

export default async function FamillesAccueilPage(
  props: {
    params: Promise<{ org: string }>;
  }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/familles-accueil`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  const isAdmin = roles.includes("admin");

  const fosterFamilies = await listFosterFamilies({
    organizationId: organization.id,
    includeInactive: true,
  });

  const orgMembers = isAdmin
    ? await db.query.organizationMembers.findMany({
        where: eq(organizationMembers.organizationId, organization.id),
        with: { user: true, roles: true },
      })
    : [];
  const linkableUsers = orgMembers
    .filter((member) => member.roles.some((role) => role.role === "famille_accueil"))
    .map((member) => ({
      id: member.user.id,
      label:
        member.user.firstName || member.user.lastName
          ? `${member.user.firstName ?? ""} ${member.user.lastName ?? ""}`.trim()
          : member.user.email,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {organization.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Familles d&apos;accueil</h1>
      </div>

      {isAdmin && (
        <CreateFosterFamilyDialog organizationId={organization.id} linkableUsers={linkableUsers} />
      )}

      <Card>
        <CardContent>
          {fosterFamilies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune famille d&apos;accueil enregistrée pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fosterFamilies.map((family) => (
                  <TableRow key={family.id}>
                    <TableCell className="font-medium">
                      {isAdmin ? (
                        <Link
                          href={`/organisations/${params.org}/familles-accueil/${family.id}`}
                          className="hover:underline"
                        >
                          {family.firstName} {family.lastName}
                        </Link>
                      ) : (
                        `${family.firstName} ${family.lastName}`
                      )}
                    </TableCell>
                    <TableCell>{family.phone || "—"}</TableCell>
                    <TableCell>{family.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={family.isActive ? "success" : "secondary"}>
                        {family.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
