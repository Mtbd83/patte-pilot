import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listVeterinarians } from "@/server/actions/veterinarians";
import { SPECIES_LABELS, SEX_LABELS } from "@/lib/animal-labels";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { VeterinarianFormDialog } from "./veterinarian-form-dialog";
import { VeterinarianTariffsDialog } from "./veterinarian-tariffs-dialog";
import { DeleteVeterinarianButton } from "./delete-veterinarian-button";
import { VetTariffsVisibilityToggle } from "./vet-tariffs-visibility-toggle";
import { VetsMap } from "./vets-map";

export default async function VeterinairesPage(
  props: {
    params: Promise<{ org: string }>;
  }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/veterinaires`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const roles = await getMemberRoles(session.user.id, organization.id);
  const isAdmin = roles.includes("admin");

  const veterinarians = await listVeterinarians({ organizationId: organization.id });

  const mapMarkers = veterinarians
    .filter((vet) => vet.latitude != null && vet.longitude != null)
    .map((vet) => ({
      id: vet.id,
      name: vet.name,
      address: vet.address,
      city: vet.city,
      latitude: vet.latitude!,
      longitude: vet.longitude!,
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
        <h1 className="mt-1 text-2xl font-semibold">Vétérinaires partenaires</h1>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <VeterinarianFormDialog organizationId={organization.id} />
          <VetTariffsVisibilityToggle
            organizationId={organization.id}
            visible={organization.vetTariffsVisibleToFosterFamilies}
          />
        </div>
      )}

      <VetsMap vets={mapMarkers} />

      {veterinarians.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Aucun vétérinaire partenaire enregistré pour le moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {veterinarians.map((vet) => (
            <Card key={vet.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{vet.name}</CardTitle>
                  <CardDescription>
                    {[vet.address, [vet.postalCode, vet.city].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(", ") || "Adresse non renseignée"}
                    {vet.phone && ` · ${vet.phone}`}
                  </CardDescription>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <VeterinarianFormDialog organizationId={organization.id} veterinarian={vet} />
                    <VeterinarianTariffsDialog
                      organizationId={organization.id}
                      veterinarianId={vet.id}
                      veterinarianName={vet.name}
                      tariffs={vet.tariffs}
                    />
                    <DeleteVeterinarianButton
                      organizationId={organization.id}
                      veterinarianId={vet.id}
                      veterinarianName={vet.name}
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {vet.notes && <p className="text-sm text-muted-foreground">{vet.notes}</p>}
                {vet.tariffs.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Acte</TableHead>
                        <TableHead>Espèce</TableHead>
                        <TableHead>Sexe</TableHead>
                        <TableHead>Prix</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vet.tariffs.map((tariff) => (
                        <TableRow key={tariff.id}>
                          <TableCell className="font-medium">{tariff.actName}</TableCell>
                          <TableCell>{tariff.species ? SPECIES_LABELS[tariff.species] : "Toutes"}</TableCell>
                          <TableCell>{tariff.sex ? SEX_LABELS[tariff.sex] : "Tous"}</TableCell>
                          <TableCell>{Number(tariff.price).toFixed(2)} €</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
