import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listAnimalsPage } from "@/server/actions/animals";
import { listFosterFamilies } from "@/server/actions/foster-families";
import { SPECIES_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/animal-labels";
import { isBoosterOwed, boosterDueDate, statusNextAction } from "@/lib/animal-care";
import type { AnimalStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CreateAnimalDialog } from "./create-animal-dialog";
import { AnimalStatusFilter } from "./animal-status-filter";

const STATUS_VALUES = new Set(Object.keys(STATUS_LABELS));

export default async function AnimauxPage({
  params,
  searchParams,
}: {
  params: { org: string };
  searchParams: { status?: string; page?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/connexion?callbackUrl=/organisations/${params.org}/animaux`);

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) return null;

  const roles = await getMemberRoles(session.user.id, organization.id);
  const isAdmin = roles.includes("admin");

  const status =
    searchParams.status && STATUS_VALUES.has(searchParams.status)
      ? (searchParams.status as AnimalStatus)
      : undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [{ animals: animalsList, total, totalPages }, fosterFamilies] = await Promise.all([
    listAnimalsPage({ organizationId: organization.id, status, page }),
    listFosterFamilies({ organizationId: organization.id }),
  ]);

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return `/organisations/${organization!.slug}/animaux${query ? `?${query}` : ""}`;
  }

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

      <div className="flex flex-wrap items-center gap-3">
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
        <AnimalStatusFilter currentStatus={status ?? ""} />
        <span className="text-sm text-muted-foreground">
          {total} animal{total > 1 ? "aux" : ""}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Espèce</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Famille d&apos;accueil</TableHead>
            <TableHead>Prochaine action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {animalsList.map((animal) => {
            const boosterOwed = animal.healthChecklist ? isBoosterOwed(animal.healthChecklist, animal.status) : false;
            const dueDate = boosterOwed ? boosterDueDate(animal.healthChecklist!) : null;
            const nextAction = statusNextAction(animal);

            return (
              <TableRow key={animal.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/organisations/${params.org}/animaux/${animal.id}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    {animal.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={animal.photoUrl}
                        alt=""
                        className="size-8 shrink-0 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <span className="size-8 shrink-0 rounded-full border border-border bg-muted" />
                    )}
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
                <TableCell>
                  <div className="flex flex-col gap-0.5 text-sm">
                    {boosterOwed && (
                      <span className="font-medium text-destructive">
                        Rappel à faire{dueDate ? ` (${new Date(dueDate).toLocaleDateString("fr-FR")})` : ""}
                      </span>
                    )}
                    {nextAction && <span>{nextAction.label}</span>}
                    {!boosterOwed && !nextAction && <span className="text-muted-foreground">—</span>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {animalsList.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Aucun animal enregistré pour le moment.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? (
              <Link href={pageHref(page - 1)}>
                <ChevronLeft /> Précédent
              </Link>
            ) : (
              <span>
                <ChevronLeft /> Précédent
              </span>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)}>
                Suivant <ChevronRight />
              </Link>
            ) : (
              <span>
                Suivant <ChevronRight />
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
