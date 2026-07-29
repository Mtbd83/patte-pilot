import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listAccountingEntries, getAccountingSummary } from "@/server/actions/accounting";
import { listAnimals } from "@/server/actions/animals";
import { ACCOUNTING_TYPE_LABELS, ACCOUNTING_CATEGORY_LABELS } from "@/lib/accounting-labels";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CreateAccountingEntryDialog } from "./create-accounting-entry-dialog";
import { DeleteEntryButton } from "./delete-entry-button";
import { AccountingType } from "@/db/schema";

function formatAmount(amount: string) {
  return `${Number(amount).toFixed(2)} €`;
}

export default async function ComptabilitePage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/comptabilite`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  if (!roles.includes("admin")) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seul·e·s les administrateur·rice·s peuvent accéder à la comptabilité.
          </p>
        </CardContent>
      </Card>
    );
  }
  
 const ACCOUNTING_TYPE_LABELS_COLOR: Record<AccountingType, string> = {
    entree: "bg-emerald-50 dark:bg-emerald-500/10",
    sortie: "bg-red-50 dark:bg-red-500/10",
  };

  const [entries, summary, animalsList] = await Promise.all([
    listAccountingEntries({ organizationId: organization.id }),
    getAccountingSummary({ organizationId: organization.id }),
    listAnimals({ organizationId: organization.id }),
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
        <h1 className="mt-1 text-2xl font-semibold">Comptabilité</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total entrées</p>
            <p className="mt-1 text-xl font-semibold">{summary.totalIn.toFixed(2)} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total sorties</p>
            <p className="mt-1 text-xl font-semibold">{summary.totalOut.toFixed(2)} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Solde</p>
            <p className="mt-1 text-xl font-semibold">{summary.balance.toFixed(2)} €</p>
          </CardContent>
        </Card>
      </div>

      <CreateAccountingEntryDialog
        organizationId={organization.id}
        animals={animalsList.map((a) => ({ id: a.id, name: a.name }))}
      />

      <Card>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune écriture enregistrée pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Animal</TableHead>
                  <TableHead>Commentaire</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} className={ACCOUNTING_TYPE_LABELS_COLOR[entry.type]} >
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{ACCOUNTING_TYPE_LABELS[entry.type]}</TableCell>
                    <TableCell>{ACCOUNTING_CATEGORY_LABELS[entry.category]}</TableCell>
                    <TableCell>{formatAmount(entry.amount)}</TableCell>
                    <TableCell>{entry.animal?.name ?? "—"}</TableCell>
                    <TableCell>{entry.comment || "—"}</TableCell>
                    <TableCell>
                      <DeleteEntryButton organizationId={organization.id} entryId={entry.id} />
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
