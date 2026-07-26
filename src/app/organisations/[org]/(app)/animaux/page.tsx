import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listAnimals } from "@/server/actions/animals";
import { listFosterFamilies } from "@/server/actions/foster-families";
import { SPECIES_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/animal-labels";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CreateAnimalDialog } from "./create-animal-dialog";

export default async function AnimauxPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/connexion?callbackUrl=/organisations/${params.org}/animaux`);

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) return null;

  const roles = await getMemberRoles(session.user.id, organization.id);
  const isAdmin = roles.includes("admin");

  const [animalsList, fosterFamilies] = await Promise.all([
    listAnimals({ organizationId: organization.id }),
    listFosterFamilies({ organizationId: organization.id }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {organization.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Animaux</h1>
      </div>

      {isAdmin && (
        <CreateAnimalDialog
          organizationId={organization.id}
          fosterFamilies={fosterFamilies.map((f) => ({
            id: f.id,
            firstName: f.firstName,
            lastName: f.lastName,
          }))}
        />
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Espèce</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Famille d&apos;accueil</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {animalsList.map((animal) => (
            <TableRow key={animal.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/organisations/${params.org}/animaux/${animal.id}`}
                  className="hover:underline"
                >
                  {animal.name}
                </Link>
              </TableCell>
              <TableCell>{SPECIES_LABELS[animal.species]}</TableCell>
              <TableCell>
                <Badge variant={STATUS_BADGE_VARIANT[animal.status]}>
                  {STATUS_LABELS[animal.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {animal.currentFosterFamily
                  ? `${animal.currentFosterFamily.firstName} ${animal.currentFosterFamily.lastName}`
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
          {animalsList.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                Aucun animal enregistré pour le moment.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
