import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getOrganizationDetailForPlatformManager } from "@/server/actions/platform";
import { ROLE_LABELS } from "@/lib/role-labels";
import { PERMISSION_LABELS } from "@/lib/permission-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ResendInvitationButton } from "./resend-invitation-button";
import { DeleteInvitationButton } from "./delete-invitation-button";

export default async function PlateformeOrganizationDetailPage(
  props: {
    params: Promise<{ organizationId: string }>;
  }
) {
  const params = await props.params;
  const { organization, members, pendingInvitations, stats } = await getOrganizationDetailForPlatformManager({
    organizationId: params.organizationId,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/plateforme/associations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Associations
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{organization.name}</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-2xl font-semibold tabular-nums">{stats.animalsCount}</span>
            <span className="text-sm text-muted-foreground">Animaux</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-2xl font-semibold tabular-nums">{stats.applicationsCount}</span>
            <span className="text-sm text-muted-foreground">Candidatures d&apos;adoption</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-2xl font-semibold tabular-nums">{stats.campaignsCount}</span>
            <span className="text-sm text-muted-foreground">Campagnes de stérilisation</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membres</CardTitle>
          <CardDescription>
            Lecture seule — la gestion des rôles et droits reste dans les Membres de l&apos;association elle-même.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun membre pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead>Droits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.roles.map((r) => (
                          <Badge key={r.id} variant="secondary">
                            {ROLE_LABELS[r.role]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.permissions.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          member.permissions.map((p) => (
                            <Badge key={p.id} variant="outline">
                              {PERMISSION_LABELS[p.permission]}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitations en cours</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInvitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune invitation en attente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead>Envoyée le</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => {
                  const isExpired = invitation.expiresAt < new Date();
                  return (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {invitation.roles.map((role) => (
                            <Badge key={role} variant="secondary">
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invitation.createdAt).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isExpired ? "destructive" : "outline"}>
                          {new Date(invitation.expiresAt).toLocaleDateString("fr-FR")}
                          {isExpired && " — expirée"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <ResendInvitationButton invitationId={invitation.id} />
                          <DeleteInvitationButton invitationId={invitation.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abonnement</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Pas encore configuré — à venir.</p>
        </CardContent>
      </Card>
    </div>
  );
}
