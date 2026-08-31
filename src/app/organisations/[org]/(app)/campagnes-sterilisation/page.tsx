import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles, getMemberPermissions } from "@/lib/permissions";
import { listSterilizationCampaigns } from "@/server/actions/sterilization-campaigns";
import { listReportingMaps } from "@/server/actions/sterilization-reports";
import { listVeterinarians } from "@/server/actions/veterinarians";
import { STERILIZATION_PARTNER_LABELS } from "@/lib/sterilization-labels";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CampaignFormDialog } from "./campaign-form-dialog";
import { ReportingMapFormDialog } from "./reporting-map-form-dialog";
import { DeleteReportingMapButton } from "./delete-reporting-map-button";

export default async function CampagnesSterilisationPage(
  props: {
    params: Promise<{ org: string }>;
  }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/connexion?callbackUrl=/organisations/${params.org}/campagnes-sterilisation`);
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const [roles, permissions] = await Promise.all([
    getMemberRoles(session.user.id, organization.id),
    getMemberPermissions(session.user.id, organization.id),
  ]);
  const isAdmin = roles.includes("admin");
  const canAccess = isAdmin || permissions.includes("campagne_sterilisation");
  if (!canAccess) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seul·e·s les administrateur·rice·s ou les bénévoles avec le droit &quot;Campagne
            stérilisation&quot; peuvent accéder aux campagnes de stérilisation.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!organization.sterilizationCampaignModuleEnabled) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <CardHeader>
          <CardTitle>Module désactivé</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Activez le module &quot;Campagne de stérilisation Chat Libre&quot; depuis les Paramètres pour y
            accéder.
          </p>
        </CardContent>
      </Card>
    );
  }

  const [campaigns, veterinarians, reportingMaps] = await Promise.all([
    listSterilizationCampaigns({ organizationId: organization.id }),
    isAdmin ? listVeterinarians({ organizationId: organization.id }) : Promise.resolve([]),
    listReportingMaps({ organizationId: organization.id }),
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
        <h1 className="mt-1 text-2xl font-semibold">Campagnes de stérilisation</h1>
      </div>

      {isAdmin && (
        <CampaignFormDialog
          organizationId={organization.id}
          veterinarians={veterinarians.map((v) => ({ id: v.id, name: v.name, address: v.address, phone: v.phone }))}
        />
      )}

      <Card>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Aucune campagne enregistrée pour le moment."
                : "Vous n'êtes assigné·e à aucune campagne pour le moment."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ville</TableHead>
                  <TableHead>Partenaire</TableHead>
                  <TableHead>Vétérinaire</TableHead>
                  <TableHead>Bons utilisés/total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/organisations/${params.org}/campagnes-sterilisation/${campaign.id}`}
                        className="-mx-3 -my-2.5 block px-3 py-2.5 hover:underline"
                      >
                        {campaign.city}
                      </Link>
                    </TableCell>
                    <TableCell>{STERILIZATION_PARTNER_LABELS[campaign.partner]}</TableCell>
                    <TableCell className="text-muted-foreground">{campaign.vetName}</TableCell>
                    <TableCell>
                      {campaign.vouchers.length} / {campaign.voucherQuotaTotal}
                      {campaign.voucherQuotaMale != null && campaign.voucherQuotaFemale != null
                        ? ` (${campaign.voucherQuotaMale} M / ${campaign.voucherQuotaFemale} F)`
                        : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold">Cartes de signalement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Une carte publique par ville, indépendante des campagnes, pour que les gens signalent un chat errant.
        </p>
      </div>

      {isAdmin && <ReportingMapFormDialog organizationId={organization.id} />}

      <Card>
        <CardContent>
          {reportingMaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune carte de signalement créée pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ville</TableHead>
                  <TableHead>Signalements</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportingMaps.map((map) => (
                  <TableRow key={map.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/organisations/${params.org}/campagnes-sterilisation/cartes-signalement/${map.id}`}
                        className="-mx-3 -my-2.5 block px-3 py-2.5 hover:underline"
                      >
                        {map.city}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{map.reports.length}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DeleteReportingMapButton organizationId={organization.id} mapId={map.id} city={map.city} />
                      </TableCell>
                    )}
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
