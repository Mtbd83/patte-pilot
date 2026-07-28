import { listOrganizationsForPlatformManager } from "@/server/actions/platform";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import { CreateOrganizationDialog } from "./create-organization-dialog";
import { OrganizationRow } from "./organization-row";

export default async function PlateformeAssociationsPage() {
  const organizations = await listOrganizationsForPlatformManager();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Associations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {organizations.length} association{organizations.length > 1 ? "s" : ""} sur la plateforme.
          </p>
        </div>
        <CreateOrganizationDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les associations</CardTitle>
          <CardDescription>
            Modifier ne change que le nom/l&apos;URL — le reste (email, légal, certificats...) reste géré par
            l&apos;association elle-même dans ses propres Paramètres.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((organization) => (
                <OrganizationRow key={organization.id} organization={organization} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
