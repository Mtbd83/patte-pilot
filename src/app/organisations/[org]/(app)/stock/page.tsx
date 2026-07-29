import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listInventoryItems } from "@/server/actions/inventory";
import { listSupplyRequestsForAdmin } from "@/server/actions/supply-requests";
import { INVENTORY_CATEGORY_LABELS, INVENTORY_STATUS_LABELS, INVENTORY_STATUS_BADGE_VARIANT } from "@/lib/inventory-labels";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CreateInventoryItemDialog } from "./create-inventory-item-dialog";
import { InventoryItemRow } from "./inventory-item-row";
import { SupplyRequestsSection } from "./supply-requests-section";

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
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Vous n&apos;êtes pas membre de cette organisation.</p>
        </CardContent>
      </Card>
    );
  }

  const isAdmin = roles.includes("admin");
  const [items, supplyRequests] = await Promise.all([
    listInventoryItems({ organizationId: organization.id }),
    isAdmin ? listSupplyRequestsForAdmin({ organizationId: organization.id }) : Promise.resolve([]),
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
        <h1 className="mt-1 text-2xl font-semibold">Stock</h1>
      </div>

      {isAdmin && <SupplyRequestsSection organizationId={organization.id} requests={supplyRequests} />}

      {isAdmin && <CreateInventoryItemDialog organizationId={organization.id} />}

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun article en stock pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Type d&apos;animal</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Stock min.</TableHead>
                  <TableHead>Prix unit.</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Statut</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) =>
                  isAdmin ? (
                    <InventoryItemRow key={item.id} organizationId={organization.id} item={item} />
                  ) : (
                    <TableRow key={item.id}>
                      <TableCell>{item.articleName}</TableCell>
                      <TableCell>{INVENTORY_CATEGORY_LABELS[item.category]}</TableCell>
                      <TableCell>{item.animalSpecies ? SPECIES_LABELS[item.animalSpecies] : "Tous"}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.minQuantity}</TableCell>
                      <TableCell>{item.unitPrice ? `${Number(item.unitPrice).toFixed(2)} €` : "—"}</TableCell>
                      <TableCell>{item.expirationDate || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={INVENTORY_STATUS_BADGE_VARIANT[item.status]}>
                          {INVENTORY_STATUS_LABELS[item.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
