import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PawPrint,
  Home,
  Wallet,
  Package,
  HeartHandshake,
  Users,
  Settings,
  ArrowRight,
  Syringe,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";
import { getMemberRoles } from "@/lib/permissions";
import { listAnimalsWithBoosterDue, listAnimals } from "@/server/actions/animals";
import { listMySupplyRequests } from "@/server/actions/supply-requests";
import { SupplyRequestWidget } from "./supply-request-widget";
import { boosterDueDate, isBoosterDueWithin, isBoosterOverdue } from "@/lib/animal-care";
import { STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/lib/animal-labels";
import { ROLE_LABELS } from "@/lib/role-labels";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MODULES = [
  { href: "animaux", label: "Animaux", description: "Fiches, statuts, checklist santé.", icon: PawPrint },
  { href: "familles-accueil", label: "Familles d'accueil", description: "Coordonnées et animaux hébergés.", icon: Home },
  { href: "comptabilite", label: "Comptabilité", description: "Entrées, sorties, solde.", icon: Wallet, adminOnly: true },
  { href: "stock", label: "Stock", description: "Articles, quantités, alertes.", icon: Package },
  { href: "candidatures", label: "Candidatures d'adoption", description: "Formulaires reçus, contrats.", icon: HeartHandshake },
  { href: "membres", label: "Membres", description: "Inviter et gérer les rôles.", icon: Users, adminOnly: true },
  { href: "parametres", label: "Paramètres", description: "Profil légal de l'association.", icon: Settings, adminOnly: true },
];

export default async function OrganizationPage({
  params,
}: {
  params: { org: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/connexion?callbackUrl=/organisations/${params.org}`);

  const organization = await findOrganizationByIdentifier(params.org);
  if (!organization) return null;

  const roles = await getMemberRoles(session.user.id, organization.id);
  const isAdmin = roles.includes("admin");
  const isBenevole = roles.includes("benevole");
  const isFamilleAccueil = roles.includes("famille_accueil");
  const visibleModules = MODULES.filter((module) => !module.adminOnly || isAdmin);
  // The org-wide reminders card overlaps with "Mes animaux" for someone who's
  // only a famille d'accueil — admins/bénévoles need the full-org view, she
  // already gets hers (and only hers) in the card above.
  const showOrgWideReminders = isAdmin || isBenevole;

  const [animalsWithBoosterDue, myAnimals, mySupplyRequests] = await Promise.all([
    showOrgWideReminders
      ? listAnimalsWithBoosterDue({ organizationId: organization.id, withinDays: 14 })
      : Promise.resolve([]),
    isFamilleAccueil ? listAnimals({ organizationId: organization.id }) : Promise.resolve([]),
    isFamilleAccueil ? listMySupplyRequests({ organizationId: organization.id }) : Promise.resolve([]),
  ]);

  const myOwnAnimals = myAnimals.filter(
    (animal) => animal.currentFosterFamily?.linkedUserId === session.user!.id,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground">Bienvenue sur votre espace de gestion —</p>
          {roles.map((role) => (
            <Badge key={role} variant="secondary">
              {ROLE_LABELS[role]}
            </Badge>
          ))}
        </div>
      </div>

      {isFamilleAccueil && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PawPrint className="size-4 text-primary" />
              Mes animaux
            </CardTitle>
            <CardDescription>
              Les animaux actuellement chez vous — cliquez sur un animal pour remplir sa checklist santé.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {myOwnAnimals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun animal chez vous pour le moment.</p>
            ) : (
              myOwnAnimals.map((animal) => {
                const owed = animal.healthChecklist ? isBoosterDueWithin(animal.healthChecklist, 14, animal.status) : false;
                const due = animal.healthChecklist ? boosterDueDate(animal.healthChecklist) : null;
                const overdue = animal.healthChecklist ? isBoosterOverdue(animal.healthChecklist, animal.status) : false;
                return (
                  <Link
                    key={animal.id}
                    href={`/organisations/${params.org}/animaux/${animal.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{animal.name}</span>
                      <Badge variant={STATUS_BADGE_VARIANT[animal.status]}>{STATUS_LABELS[animal.status]}</Badge>
                    </span>
                    {owed && (
                      <Badge variant={overdue ? "destructive" : "warning"}>
                        Rappel à faire{due ? ` (${new Date(due).toLocaleDateString("fr-FR")})` : ""}
                        {overdue ? " — dépassé" : ""}
                      </Badge>
                    )}
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {isFamilleAccueil && (
        <SupplyRequestWidget organizationId={organization.id} requests={mySupplyRequests} />
      )}

      {animalsWithBoosterDue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Syringe className="size-4 text-destructive" />
              Rappels à faire dans les 2 semaines
            </CardTitle>
            <CardDescription>
              Primo-vaccination faite, rappel pas encore enregistré, échéance proche ou dépassée.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {animalsWithBoosterDue.map((animal) => {
              const due = boosterDueDate(animal.healthChecklist!);
              const overdue = isBoosterOverdue(animal.healthChecklist!, animal.status);
              return (
                <Link
                  key={animal.id}
                  href={`/organisations/${params.org}/animaux/${animal.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  <span className="font-medium">{animal.name}</span>
                  <Badge variant={overdue ? "destructive" : "warning"}>
                    {due ? new Date(due).toLocaleDateString("fr-FR") : ""}
                    {overdue ? " — dépassé" : ""}
                  </Badge>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleModules.map((module) => (
          <Link
            key={module.href}
            href={`/organisations/${params.org}/${module.href}`}
            className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/50"
          >
            <module.icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">{module.label}</h2>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{module.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
