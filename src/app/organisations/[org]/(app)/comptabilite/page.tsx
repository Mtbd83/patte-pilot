import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import {
  listAccountingEntriesPage,
  listAccountingEntryYears,
  getAccountingSummary,
} from "@/server/actions/accounting";
import { listAnimals } from "@/server/actions/animals";
import { ACCOUNTING_TYPE_LABELS, ACCOUNTING_CATEGORY_LABELS } from "@/lib/accounting-labels";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CreateAccountingEntryDialog } from "./create-accounting-entry-dialog";
import { EditAccountingEntryDialog } from "./edit-accounting-entry-dialog";
import { DeleteEntryButton } from "./delete-entry-button";
import { AccountingFilters, type PeriodMode } from "./accounting-filters";
import { AccountingType, AccountingCategory } from "@/db/schema";

function formatAmount(amount: string) {
  return `${Number(amount).toFixed(2)} €`;
}

const ACCOUNTING_TYPE_ROW_COLOR: Record<AccountingType, string> = {
  entree: "bg-emerald-50 dark:bg-emerald-500/10",
  sortie: "bg-red-50 dark:bg-red-500/10",
};

const CATEGORY_VALUES = new Set(Object.keys(ACCOUNTING_CATEGORY_LABELS));
const PERIOD_MODES = new Set<PeriodMode>(["year", "month", "custom"]);

/** Last day of the given year/month, as a zero-padded "YYYY-MM-DD" date string. */
function monthRange(year: string, month: string) {
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay).padStart(2, "0")}` };
}

export default async function ComptabilitePage({
  params,
  searchParams,
}: {
  params: { org: string };
  searchParams: {
    periodMode?: string;
    year?: string;
    month?: string;
    dateFrom?: string;
    dateTo?: string;
    category?: string;
    animalId?: string;
    page?: string;
  };
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

  const periodMode: PeriodMode = PERIOD_MODES.has(searchParams.periodMode as PeriodMode)
    ? (searchParams.periodMode as PeriodMode)
    : "all";
  const year = searchParams.year ?? "";
  const month = searchParams.month ?? "";
  const category =
    searchParams.category && CATEGORY_VALUES.has(searchParams.category)
      ? (searchParams.category as AccountingCategory)
      : undefined;
  const animalId = searchParams.animalId || undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  if (periodMode === "year" && year) {
    dateFrom = `${year}-01-01`;
    dateTo = `${year}-12-31`;
  } else if (periodMode === "month" && year && month) {
    ({ from: dateFrom, to: dateTo } = monthRange(year, month));
  } else if (periodMode === "custom") {
    dateFrom = searchParams.dateFrom || undefined;
    dateTo = searchParams.dateTo || undefined;
  }

  const [{ entries, total, totalPages }, years, summary, animalsList] = await Promise.all([
    listAccountingEntriesPage({
      organizationId: organization.id,
      category,
      animalId,
      dateFrom,
      dateTo,
      page,
    }),
    listAccountingEntryYears({ organizationId: organization.id }),
    getAccountingSummary({ organizationId: organization.id, category, animalId, dateFrom, dateTo }),
    listAnimals({ organizationId: organization.id }),
  ]);

  const hasFilters = Boolean(category || animalId || dateFrom || dateTo);

  const animalOptions = animalsList.map((a) => ({ id: a.id, name: a.name }));

  function pageHref(targetPage: number) {
    const query = new URLSearchParams();
    if (periodMode !== "all") query.set("periodMode", periodMode);
    if (year) query.set("year", year);
    if (month) query.set("month", month);
    if (searchParams.dateFrom) query.set("dateFrom", searchParams.dateFrom);
    if (searchParams.dateTo) query.set("dateTo", searchParams.dateTo);
    if (category) query.set("category", category);
    if (animalId) query.set("animalId", animalId);
    if (targetPage > 1) query.set("page", String(targetPage));
    const queryString = query.toString();
    return `/organisations/${organization!.slug}/comptabilite${queryString ? `?${queryString}` : ""}`;
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
        <h1 className="mt-1 text-2xl font-semibold">Comptabilité</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total entrées{hasFilters && " (filtré)"}</p>
            <p className="mt-1 text-xl font-semibold">{summary.totalIn.toFixed(2)} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Total sorties{hasFilters && " (filtré)"}</p>
            <p className="mt-1 text-xl font-semibold">{summary.totalOut.toFixed(2)} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">Solde{hasFilters && " (filtré)"}</p>
            <p className="mt-1 text-xl font-semibold">{summary.balance.toFixed(2)} €</p>
          </CardContent>
        </Card>
      </div>

      <CreateAccountingEntryDialog organizationId={organization.id} animals={animalOptions} />

      <AccountingFilters
        periodMode={periodMode}
        year={year}
        month={month}
        dateFrom={searchParams.dateFrom ?? ""}
        dateTo={searchParams.dateTo ?? ""}
        category={category ?? ""}
        animalId={animalId ?? ""}
        years={years}
        animals={animalOptions}
      />

      <Card>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune écriture pour ces filtres.</p>
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
                  <TableRow key={entry.id} className={ACCOUNTING_TYPE_ROW_COLOR[entry.type]}>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{ACCOUNTING_TYPE_LABELS[entry.type]}</TableCell>
                    <TableCell>{ACCOUNTING_CATEGORY_LABELS[entry.category]}</TableCell>
                    <TableCell>{formatAmount(entry.amount)}</TableCell>
                    <TableCell>{entry.animal?.name ?? "—"}</TableCell>
                    <TableCell>{entry.comment || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <EditAccountingEntryDialog
                          organizationId={organization.id}
                          entry={entry}
                          animals={animalOptions}
                        />
                        <DeleteEntryButton organizationId={organization.id} entryId={entry.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
            Page {page} / {totalPages} — {total} écriture{total > 1 ? "s" : ""}
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
