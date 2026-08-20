"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Settings, Users, PawPrint, Home, Wallet, Package, User, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/server/actions/account";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
};

function buildSteps(orgSlug: string, isAdmin: boolean): Step[] {
  const base = `/organisations/${orgSlug}`;
  const steps: Step[] = [
    {
      icon: Sparkles,
      title: "Bienvenue sur PattePilot !",
      description:
        "Votre association est prête. Ce petit tour vous présente en quelques secondes les onglets de votre espace de gestion.",
    },
  ];

  if (isAdmin) {
    steps.push(
      {
        icon: Settings,
        title: "Configurez votre association",
        description:
          "Renseignez le profil légal (SIREN, adresse), le logo, l'expéditeur des emails et le modèle de contrat d'adoption.",
        href: `${base}/parametres`,
        linkLabel: "Paramètres",
      },
      {
        icon: Users,
        title: "Invitez vos membres",
        description:
          "Envoyez une invitation par email à vos bénévoles et familles d'accueil, avec le rôle qui leur correspond : admin, bénévole ou famille d'accueil.",
        href: `${base}/membres`,
        linkLabel: "Membres",
      },
    );
  }

  steps.push(
    {
      icon: PawPrint,
      title: "Ajoutez vos animaux",
      description:
        "Créez une fiche par animal : espèce, statut, checklist santé. Les candidatures d'adoption reçues s'y rattachent automatiquement.",
      href: `${base}/animaux`,
      linkLabel: "Animaux",
    },
    {
      icon: Home,
      title: "Ajoutez vos familles d'accueil",
      description: "Enregistrez leurs coordonnées et associez-leur les animaux qu'elles hébergent.",
      href: `${base}/familles-accueil`,
      linkLabel: "Familles d'accueil",
    },
    {
      icon: isAdmin ? Wallet : Package,
      title: isAdmin ? "Gérez comptabilité et stock" : "Gérez le stock",
      description: isAdmin
        ? "Suivez vos entrées et sorties comptables, et gérez le stock d'articles (croquettes, matériel...)."
        : "Suivez le stock d'articles de l'association (croquettes, matériel...) et signalez les besoins.",
      href: isAdmin ? `${base}/comptabilite` : `${base}/stock`,
      linkLabel: isAdmin ? "Comptabilité" : "Stock",
    },
    {
      icon: User,
      title: "Gérez votre compte",
      description: "Changez votre mot de passe, retrouvez vos associations, ou supprimez votre compte.",
      href: "/mon-compte",
      linkLabel: "Mon compte",
    },
  );

  return steps;
}

/**
 * First-login guided tour of the org dashboard's tabs — auto-opens once
 * (see completeOnboarding/onboardingCompletedAt) and stays reachable
 * afterwards via the "Revoir le tutoriel" button it renders.
 */
export function OnboardingTour({
  orgSlug,
  isAdmin,
  initialOpen,
}: {
  orgSlug: string;
  isAdmin: boolean;
  initialOpen: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = buildSteps(orgSlug, isAdmin);
  // stepIndex is only ever moved within [0, steps.length) by this
  // component's own handlers below.
  const step = steps[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const Icon = step.icon;

  function close() {
    setOpen(false);
    setStepIndex(0);
    completeOnboarding().catch(() => {});
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setStepIndex(0);
          setOpen(true);
        }}
      >
        Revoir le tutoriel
      </Button>
      <Dialog open={open} onClose={close} title={step.title}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
          {step.href && (
            <Link
              href={step.href}
              onClick={close}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Aller à {step.linkLabel}
              <ArrowRight className="size-3.5" />
            </Link>
          )}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={cn("size-1.5 rounded-full", i === stepIndex ? "bg-primary" : "bg-muted")}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {!isFirst && (
                <Button variant="outline" size="sm" onClick={() => setStepIndex((i) => i - 1)}>
                  Précédent
                </Button>
              )}
              {isLast ? (
                <Button size="sm" onClick={close}>
                  Terminer
                </Button>
              ) : (
                <Button size="sm" onClick={() => setStepIndex((i) => i + 1)}>
                  Suivant
                </Button>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
