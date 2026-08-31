import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles, getMemberPermissions, ForbiddenError } from "@/lib/permissions";
import {
  getSterilizationCampaign,
  listAssignableCampaignVolunteers,
  listCampaignVolunteers,
} from "@/server/actions/sterilization-campaigns";
import { listVeterinarians } from "@/server/actions/veterinarians";
import { STERILIZATION_PARTNER_LABELS, VOUCHER_SEX_LABELS } from "@/lib/sterilization-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CampaignFormDialog } from "../campaign-form-dialog";
import { VoucherFormDialog } from "./voucher-form-dialog";
import { DeleteVoucherButton } from "./delete-voucher-button";
import { CampaignVolunteersForm } from "./campaign-volunteers-form";

export default async function CampagneSterilisationDetailPage(
  props: {
    params: Promise<{ org: string; campaignId: string }>;
  }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/connexion?callbackUrl=/organisations/${params.org}/campagnes-sterilisation/${params.campaignId}`,
    );
  }

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) notFound();

  const [roles, permissions] = await Promise.all([
    getMemberRoles(session.user.id, organization.id),
    getMemberPermissions(session.user.id, organization.id),
  ]);
  const isAdmin = roles.includes("admin");
  const hasCampaignPermission = isAdmin || permissions.includes("campagne_sterilisation");
  if (!hasCampaignPermission || !organization.sterilizationCampaignModuleEnabled) {
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

  let campaign;
  try {
    campaign = await getSterilizationCampaign({ campaignId: params.campaignId, organizationId: organization.id });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return (
        <Card className="mx-auto mt-16 max-w-md">
          <CardHeader>
            <CardTitle>Accès refusé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Vous n&apos;êtes pas assigné·e à cette campagne — demandez à un·e admin de vous y ajouter.
            </p>
          </CardContent>
        </Card>
      );
    }
    throw err;
  }

  const [veterinarians, assignableVolunteers, campaignVolunteers] = await Promise.all([
    isAdmin ? listVeterinarians({ organizationId: organization.id }) : Promise.resolve([]),
    isAdmin
      ? listAssignableCampaignVolunteers({ organizationId: organization.id })
      : Promise.resolve([]),
    isAdmin
      ? listCampaignVolunteers({ campaignId: campaign.id, organizationId: organization.id })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}/campagnes-sterilisation`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Campagnes de stérilisation
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{campaign.city}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{STERILIZATION_PARTNER_LABELS[campaign.partner]}</CardTitle>
            <CardDescription>
              {[campaign.vetName, campaign.vetAddress, campaign.vetPhone].filter(Boolean).join(" · ")}
            </CardDescription>
          </div>
          {isAdmin && (
            <CampaignFormDialog
              organizationId={organization.id}
              veterinarians={veterinarians.map((v) => ({ id: v.id, name: v.name, address: v.address, phone: v.phone }))}
              campaign={campaign}
            />
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {campaign.vouchers.length} / {campaign.voucherQuotaTotal} bons utilisés
            {campaign.voucherQuotaMale != null && campaign.voucherQuotaFemale != null
              ? ` (dont ${campaign.voucherQuotaMale} mâles, ${campaign.voucherQuotaFemale} femelles prévus)`
              : ""}
          </p>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Bénévoles ayant accès à cette campagne</CardTitle>
            <CardDescription>
              Seul·e·s les bénévoles cochés ici (parmi celles et ceux ayant le droit &quot;Campagne
              stérilisation&quot;) peuvent voir et remplir les bons de cette campagne.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignVolunteersForm
              organizationId={organization.id}
              campaignId={campaign.id}
              assignableVolunteers={assignableVolunteers}
              assignedMemberIds={campaignVolunteers.map((v) => v.memberId)}
            />
          </CardContent>
        </Card>
      )}

      <VoucherFormDialog organizationId={organization.id} campaignId={campaign.id} />

      <Card>
        <CardContent>
          {campaign.vouchers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun bon enregistré pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
                  <TableHead>N° de bon</TableHead>
                  <TableHead>N° d&apos;identification</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.vouchers.map((voucher) => (
                  <TableRow key={voucher.id}>
                    <TableCell>
                      {voucher.photoUrl ? (
                        <div className="size-10 overflow-hidden rounded-md border border-border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={voucher.photoUrl} alt="" className="size-full object-cover" />
                        </div>
                      ) : (
                        <span className="size-10 block rounded-md border border-dashed border-border" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{voucher.voucherNumber}</TableCell>
                    <TableCell>{voucher.identificationNumber}</TableCell>
                    <TableCell>{new Date(voucher.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      <Badge variant={voucher.sex === "male" ? "info" : "secondary"}>
                        {voucher.sex === "male" || voucher.sex === "femelle"
                          ? VOUCHER_SEX_LABELS[voucher.sex]
                          : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <VoucherFormDialog
                          organizationId={organization.id}
                          campaignId={campaign.id}
                          voucher={voucher}
                        />
                        <DeleteVoucherButton
                          organizationId={organization.id}
                          voucherId={voucher.id}
                          voucherNumber={voucher.voucherNumber}
                        />
                      </div>
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
