"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Sparkles, Settings, Users, PawPrint, Home, Wallet, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/server/actions/account";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

// Purely explanatory — deliberately no "go to this tab" links. A step that
// navigates away unmounts this dialog entirely, and the tour is lost with
// no way back to where you were (reported after a first version had them).
function buildSteps(isAdmin: boolean): Step[] {
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
          "Dans l'onglet Paramètres : profil légal (SIREN, adresse), logo, expéditeur des emails et modèle de contrat d'adoption.",
      },
      {
        icon: Users,
        title: "Invitez vos membres",
        description:
          "Dans l'onglet Membres : invitez vos bénévoles et familles d'accueil par email, avec le rôle qui leur correspond — admin, bénévole ou famille d'accueil.",
      },
    );
  }

  steps.push(
    {
      icon: PawPrint,
      title: "Ajoutez vos animaux",
      description:
        "Dans l'onglet Animaux : créez une fiche par animal (espèce, statut, checklist santé). Les candidatures d'adoption reçues s'y rattachent automatiquement.",
    },
    {
      icon: Home,
      title: "Ajoutez vos familles d'accueil",
      description:
        "Dans l'onglet Familles d'accueil : enregistrez leurs coordonnées et associez-leur les animaux qu'elles hébergent.",
    },
    {
      icon: isAdmin ? Wallet : Package,
      title: isAdmin ? "Gérez comptabilité et stock" : "Gérez le stock",
      description: isAdmin
        ? "Dans les onglets Comptabilité et Stock : suivez vos entrées/sorties comptables et le stock d'articles (croquettes, matériel...)."
        : "Dans l'onglet Stock : suivez les articles de l'association (croquettes, matériel...) et signalez vos besoins.",
    },
    {
      icon: User,
      title: "Gérez votre compte",
      description:
        "Depuis \"Mon compte\" : changez votre mot de passe, retrouvez vos associations, ou supprimez votre compte.",
    },
  );

  return steps;
}

export type OnboardingTourHandle = { open: () => void };

/**
 * First-login guided tour of the org's tabs. Mounted once in OrgSidebar (so
 * it auto-opens no matter which page a first-time visitor lands on, not
 * just the dashboard) — has no trigger of its own; OrgSidebar's "Revoir le
 * tutoriel" entry opens it via this ref, since that's the one spot reachable
 * identically from the mobile drawer and the desktop sidebar.
 */
export const OnboardingTour = forwardRef<OnboardingTourHandle, { isAdmin: boolean; initialOpen: boolean }>(
  function OnboardingTour({ isAdmin, initialOpen }, ref) {
    const [open, setOpen] = useState(initialOpen);
    const [stepIndex, setStepIndex] = useState(0);
    const steps = buildSteps(isAdmin);
    // stepIndex is only ever moved within [0, steps.length) by this
    // component's own handlers below.
    const step = steps[stepIndex]!;
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === steps.length - 1;
    const Icon = step.icon;

    useImperativeHandle(ref, () => ({
      open: () => {
        setStepIndex(0);
        setOpen(true);
      },
    }));

    function close() {
      setOpen(false);
      setStepIndex(0);
      completeOnboarding().catch(() => {});
    }

    return (
      <Dialog open={open} onClose={close} title={step.title}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
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
    );
  },
);
