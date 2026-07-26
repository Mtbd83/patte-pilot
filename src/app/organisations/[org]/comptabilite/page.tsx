import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listAccountingEntries, getAccountingSummary } from "@/server/actions/accounting";
import { listAnimals } from "@/server/actions/animals";
import { ACCOUNTING_TYPE_LABELS, ACCOUNTING_CATEGORY_LABELS } from "@/lib/accounting-labels";
import { CreateAccountingEntryDialog } from "./create-accounting-entry-dialog";
import { DeleteEntryButton } from "./delete-entry-button";

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
  if (roles.length === 0) {
    return (
      <main style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Accès refusé</h1>
        <p>Vous n&apos;êtes pas membre de cette organisation.</p>
      </main>
    );
  }

  const isAdmin = roles.includes("admin");

  const [entries, summary, animalsList] = await Promise.all([
    listAccountingEntries({ organizationId: organization.id }),
    getAccountingSummary({ organizationId: organization.id }),
    listAnimals({ organizationId: organization.id }),
  ]);

  return (
    <main style={{ maxWidth: 960, margin: "60px auto", fontFamily: "sans-serif" }}>
      <p>
        <a href={`/organisations/${params.org}`}>&larr; {organization.name}</a>
      </p>
      <h1>Comptabilité</h1>

      <div style={{ display: "flex", gap: 24, margin: "16px 0" }}>
        <p>
          Total entrées : <strong>{summary.totalIn.toFixed(2)} €</strong>
        </p>
        <p>
          Total sorties : <strong>{summary.totalOut.toFixed(2)} €</strong>
        </p>
        <p>
          Solde : <strong>{summary.balance.toFixed(2)} €</strong>
        </p>
      </div>

      {isAdmin && (
        <CreateAccountingEntryDialog
          organizationId={organization.id}
          animals={animalsList.map((a) => ({ id: a.id, name: a.name }))}
        />
      )}

      <table style={{ marginTop: 24, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "8px 4px" }}>Date</th>
            <th style={{ padding: "8px 4px" }}>Type</th>
            <th style={{ padding: "8px 4px" }}>Catégorie</th>
            <th style={{ padding: "8px 4px" }}>Montant</th>
            <th style={{ padding: "8px 4px" }}>Animal</th>
            <th style={{ padding: "8px 4px" }}>Commentaire</th>
            {isAdmin && <th style={{ padding: "8px 4px" }} />}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "8px 4px" }}>{entry.date}</td>
              <td style={{ padding: "8px 4px" }}>{ACCOUNTING_TYPE_LABELS[entry.type]}</td>
              <td style={{ padding: "8px 4px" }}>{ACCOUNTING_CATEGORY_LABELS[entry.category]}</td>
              <td style={{ padding: "8px 4px" }}>{formatAmount(entry.amount)}</td>
              <td style={{ padding: "8px 4px" }}>{entry.animal?.name ?? "—"}</td>
              <td style={{ padding: "8px 4px" }}>{entry.comment || "—"}</td>
              {isAdmin && (
                <td style={{ padding: "8px 4px" }}>
                  <DeleteEntryButton organizationId={organization.id} entryId={entry.id} />
                </td>
              )}
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 7 : 6} style={{ padding: "16px 4px", color: "#666" }}>
                Aucune écriture enregistrée pour le moment.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
