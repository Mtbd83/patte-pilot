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
} from "lucide-react";
import { auth } from "@/lib/auth";
import { findOrganizationByIdentifier } from "@/lib/organizations";

const MODULES = [
  { href: "animaux", label: "Animaux", description: "Fiches, statuts, checklist santé.", icon: PawPrint },
  { href: "familles-accueil", label: "Familles d'accueil", description: "Coordonnées et animaux hébergés.", icon: Home },
  { href: "comptabilite", label: "Comptabilité", description: "Entrées, sorties, solde.", icon: Wallet },
  { href: "stock", label: "Stock", description: "Articles, quantités, alertes.", icon: Package },
  { href: "candidatures", label: "Candidatures d'adoption", description: "Formulaires reçus, contrats.", icon: HeartHandshake },
  { href: "membres", label: "Membres", description: "Inviter et gérer les rôles.", icon: Users },
  { href: "parametres", label: "Paramètres", description: "Profil légal de l'association.", icon: Settings },
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="mt-1 text-muted-foreground">Bienvenue sur votre espace de gestion.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module) => (
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
