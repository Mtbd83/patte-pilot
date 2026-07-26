import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listInventoryItems } from "@/server/actions/inventory";
import { INVENTORY_CATEGORY_LABELS, INVENTORY_STATUS_LABELS } from "@/lib/inventory-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { CreateInventoryItemDialog } from "./create-inventory-item-dialog";
import { InventoryItemRow } from "./inventory-item-row";

export default async function StockPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/stock`);
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
  const items = await listInventoryItems({ organizationId: organization.id });

  return (
    <main style={{ maxWidth: 1100, margin: "60px auto", fontFamily: "sans-serif" }}>
      <p>
        <a href={`/organisations/${params.org}`}>&larr; {organization.name}</a>
      </p>
      <h1>Stock</h1>

      {isAdmin && <CreateInventoryItemDialog organizationId={organization.id} />}

      <table style={{ marginTop: 24, width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "8px 4px" }}>Article</th>
            <th style={{ padding: "8px 4px" }}>Catégorie</th>
            <th style={{ padding: "8px 4px" }}>Type d&apos;animal</th>
            <th style={{ padding: "8px 4px" }}>Quantité</th>
            <th style={{ padding: "8px 4px" }}>Stock min.</th>
            <th style={{ padding: "8px 4px" }}>Prix unit.</th>
            <th style={{ padding: "8px 4px" }}>Expiration</th>
            <th style={{ padding: "8px 4px" }}>Statut</th>
            {isAdmin && <th style={{ padding: "8px 4px" }} />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) =>
            isAdmin ? (
              <InventoryItemRow key={item.id} organizationId={organization.id} item={item} />
            ) : (
              <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 4px" }}>{item.articleName}</td>
                <td style={{ padding: "8px 4px" }}>{INVENTORY_CATEGORY_LABELS[item.category]}</td>
                <td style={{ padding: "8px 4px" }}>
                  {item.animalSpecies ? SPECIES_LABELS[item.animalSpecies] : "Tous"}
                </td>
                <td style={{ padding: "8px 4px" }}>{item.quantity}</td>
                <td style={{ padding: "8px 4px" }}>{item.minQuantity}</td>
                <td style={{ padding: "8px 4px" }}>
                  {item.unitPrice ? `${Number(item.unitPrice).toFixed(2)} €` : "—"}
                </td>
                <td style={{ padding: "8px 4px" }}>{item.expirationDate || "—"}</td>
                <td style={{ padding: "8px 4px" }}>{INVENTORY_STATUS_LABELS[item.status]}</td>
              </tr>
            ),
          )}
          {items.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 9 : 8} style={{ padding: "16px 4px", color: "#666" }}>
                Aucun article en stock pour le moment.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
