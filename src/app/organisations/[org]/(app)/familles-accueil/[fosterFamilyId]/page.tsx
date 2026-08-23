import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/db";
import { fosterFamilies, organizationMembers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles, getMemberPermissions } from "@/lib/permissions";
import { SPECIES_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/animal-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FosterFamilyEditForm } from "./foster-family-edit-form";
import { DeactivateFosterFamilyButton } from "./deactivate-foster-family-button";
import { ReactivateFosterFamilyButton } from "./reactivate-foster-family-button";

export default async function FosterFamilyDetailPage(
  props: {
    params: Promise<{ org: string; fosterFamilyId: string }>;
  }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/connexion?callbackUrl=/organisations/${params.org}/familles-accueil/${params.fosterFamilyId}`,
    );
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const [roles, permissions] = await Promise.all([
    getMemberRoles(session.user.id, organization.id),
    getMemberPermissions(session.user.id, organization.id),
  ]);
  const canManageFosterFamilies = roles.includes("admin") || permissions.includes("gestion_famille_accueil");
  if (!canManageFosterFamilies) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seul·e·s les administrateur·rice·s ou les bénévoles avec le droit &quot;Gestion famille d&apos;accueil&quot;
            peuvent accéder au détail d&apos;une famille d&apos;accueil.
          </p>
        </CardContent>
      </Card>
    );
  }

  const [fosterFamily, orgMembers] = await Promise.all([
    db.query.fosterFamilies.findFirst({
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
    }),
    db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, organization.id),
      with: { user: true, roles: true },
    }),
  ]);
  if (!fosterFamily) notFound();

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
          href={`/organisations/${params.org}/familles-accueil`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Familles d&apos;accueil
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {fosterFamily.firstName} {fosterFamily.lastName}
          </h1>
          <Badge variant={fosterFamily.isActive ? "success" : "secondary"}>
            {fosterFamily.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coordonnées</CardTitle>
        </CardHeader>
        <CardContent>
          <FosterFamilyEditForm
            organizationId={organization.id}
            fosterFamily={fosterFamily}
            linkableUsers={linkableUsers}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{fosterFamily.isActive ? "Désactivation" : "Réactivation"}</CardTitle>
        </CardHeader>
        <CardContent>
          {fosterFamily.isActive ? (
            <DeactivateFosterFamilyButton
              organizationId={organization.id}
              fosterFamilyId={fosterFamily.id}
            />
          ) : (
            <ReactivateFosterFamilyButton
              organizationId={organization.id}
              fosterFamilyId={fosterFamily.id}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Animaux actuellement hébergés</CardTitle>
        </CardHeader>
        <CardContent>
          {fosterFamily.animalsHosted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun animal hébergé actuellement.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {fosterFamily.animalsHosted.map((animal) => (
                <li key={animal.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link
                    href={`/organisations/${params.org}/animaux/${animal.id}`}
                    className="font-medium hover:underline"
                  >
                    {animal.name}
                  </Link>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {SPECIES_LABELS[animal.species]}
                    <Badge variant={STATUS_BADGE_VARIANT[animal.status]}>{STATUS_LABELS[animal.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des placements</CardTitle>
        </CardHeader>
        <CardContent>
          {fosterFamily.placements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun placement enregistré.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Animal</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fosterFamily.placements.map((placement) => (
                  <TableRow key={placement.id}>
                    <TableCell>
                      <Link
                        href={`/organisations/${params.org}/animaux/${placement.animal.id}`}
                        className="-mx-3 -my-2.5 block px-3 py-2.5 hover:underline"
                      >
                        {placement.animal.name}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(placement.startedAt).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      {placement.endedAt
                        ? new Date(placement.endedAt).toLocaleDateString("fr-FR")
                        : "En cours"}
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
