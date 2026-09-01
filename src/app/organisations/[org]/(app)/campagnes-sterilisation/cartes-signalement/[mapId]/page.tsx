import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles, getMemberPermissions } from "@/lib/permissions";
import { getReportingMapDetail } from "@/server/actions/sterilization-reports";
import { SEX_LABELS } from "@/lib/animal-labels";
import {
  STERILIZATION_NEED_LABELS,
  REPORT_FINDER_STATUS_LABELS,
  REPORT_MANAGEMENT_STATUS_MAP_COLORS,
} from "@/lib/report-labels";
import type { ReportManagementStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ReportingMapView } from "@/components/reporting-map-view";
import { ReportStatusSelect } from "./report-status-select";
import { PhotoThumbnail } from "@/components/photo-thumbnail";
import { LinkifiedText } from "@/components/linkified-text";
import { DeleteReportButton } from "./delete-report-button";
import { DeleteCommentButton } from "./delete-comment-button";
import { CopyPublicLinkButton } from "./copy-public-link-button";
import { DeleteReportingMapButton } from "../../delete-reporting-map-button";

type ReportWithComments = Awaited<ReturnType<typeof getReportingMapDetail>>["reports"][number];

/** Same colored-circle-with-number look as the map's own pins, so a report can be matched between the two at a glance. */
function ReportNumberBadge({ index, status }: { index: number; status: ReportManagementStatus }) {
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: REPORT_MANAGEMENT_STATUS_MAP_COLORS[status] }}
    >
      {index + 1}
    </span>
  );
}

/** Shared between the mobile card and the desktop table cell, so the two views can't drift apart. */
function ReportComments({
  report,
  organizationId,
}: {
  report: ReportWithComments;
  organizationId: string;
}) {
  if (report.comments.length === 0) {
    return <span className="text-muted-foreground">Aucun commentaire</span>;
  }
  return (
    <details>
      <summary className="cursor-pointer text-sm">
        {report.comments.length} commentaire{report.comments.length > 1 ? "s" : ""}
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {report.comments.map((comment) => (
          <li key={comment.id} className="flex items-start justify-between gap-2 text-sm">
            <div>
              <span className="font-medium">{comment.authorName}</span> —{" "}
              <LinkifiedText text={comment.text} />
            </div>
            <DeleteCommentButton organizationId={organizationId} commentId={comment.id} />
          </li>
        ))}
      </ul>
    </details>
  );
}

export default async function CarteSignalementDetailPage(
  props: {
    params: Promise<{ org: string; mapId: string }>;
  }
) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/connexion?callbackUrl=/organisations/${params.org}/campagnes-sterilisation/cartes-signalement/${params.mapId}`,
    );
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
            stérilisation&quot; peuvent accéder aux cartes de signalement.
          </p>
        </CardContent>
      </Card>
    );
  }

  const map = await getReportingMapDetail({ mapId: params.mapId, organizationId: organization.id });
  const publicPath = `/organisations/${params.org}/signalement/${map.publicToken}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/organisations/${params.org}/campagnes-sterilisation`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Campagnes de stérilisation
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Signalements — {map.city}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <CopyPublicLinkButton path={publicPath} />
        <Link href={publicPath} target="_blank" className="text-sm text-muted-foreground hover:underline">
          {publicPath}
        </Link>
        {isAdmin && (
          <DeleteReportingMapButton
            organizationId={organization.id}
            mapId={map.id}
            city={map.city}
            redirectTo={`/organisations/${params.org}/campagnes-sterilisation`}
          />
        )}
      </div>

      <ReportingMapView
        reports={map.reports.map((r) => ({
          id: r.id,
          latitude: r.latitude,
          longitude: r.longitude,
          managementStatus: r.managementStatus,
        }))}
        boundary={map.boundary}
      />

      {map.reports.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Aucun signalement pour cette carte pour le moment.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: one card per report, everything stacked and visible at once —
              the table below would otherwise force a tiny screen down to just
              photo + genre, with the rest only reachable by horizontal scroll. */}
          <div className="flex flex-col gap-4 sm:hidden">
            {map.reports.map((report, index) => (
              <Card key={report.id}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <ReportNumberBadge index={index} status={report.managementStatus} />
                    <PhotoThumbnail photoUrl={report.photoUrl} alt="Photo du signalement" />
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      <Badge>{SEX_LABELS[report.sex]}</Badge>
                      <Badge>{STERILIZATION_NEED_LABELS[report.needsSterilization]}</Badge>
                      <Badge>{REPORT_FINDER_STATUS_LABELS[report.finderStatus]}</Badge>
                    </div>
                  </div>

                  {report.description && (
                    <p className="text-sm text-muted-foreground">
                      <LinkifiedText text={report.description} />
                    </p>
                  )}

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Statut (association)</span>
                    <ReportStatusSelect
                      organizationId={organization.id}
                      reportId={report.id}
                      currentStatus={report.managementStatus}
                    />
                  </div>

                  <ReportComments report={report} organizationId={organization.id} />

                  <div className="flex justify-end border-t border-border pt-2">
                    <DeleteReportButton organizationId={organization.id} reportId={report.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: the same data as a table. */}
          <Card className="hidden sm:block">
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Photo</TableHead>
                    <TableHead>Genre</TableHead>
                    <TableHead>Stérilisation</TableHead>
                    <TableHead>Statut (déclarant)</TableHead>
                    <TableHead>Commentaire du déclarant</TableHead>
                    <TableHead>Statut (association)</TableHead>
                    <TableHead>Commentaires</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {map.reports.map((report, index) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <ReportNumberBadge index={index} status={report.managementStatus} />
                      </TableCell>
                      <TableCell>
                        <PhotoThumbnail photoUrl={report.photoUrl} alt="Photo du signalement" />
                      </TableCell>
                      <TableCell>{SEX_LABELS[report.sex]}</TableCell>
                      <TableCell>{STERILIZATION_NEED_LABELS[report.needsSterilization]}</TableCell>
                      <TableCell>
                        <Badge>{REPORT_FINDER_STATUS_LABELS[report.finderStatus]}</Badge>
                      </TableCell>
                      <TableCell className="max-w-64">
                        {report.description ? (
                          <LinkifiedText text={report.description} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ReportStatusSelect
                          organizationId={organization.id}
                          reportId={report.id}
                          currentStatus={report.managementStatus}
                        />
                      </TableCell>
                      <TableCell>
                        <ReportComments report={report} organizationId={organization.id} />
                      </TableCell>
                      <TableCell>
                        <DeleteReportButton organizationId={organization.id} reportId={report.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
