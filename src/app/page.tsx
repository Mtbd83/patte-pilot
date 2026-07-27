import Link from "next/link";
import { PawPrint, Home, Package, HeartHandshake, Wallet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Home,
    title: "Familles d'accueil",
    description:
      "Gérez vos familles d'accueil, suivez leurs disponibilités et les animaux qui leur sont confiés.",
  },
  {
    icon: Package,
    title: "Stock & matériel",
    description: "Suivez votre inventaire de nourriture, médicaments et équipements en temps réel.",
  },
  {
    icon: HeartHandshake,
    title: "Prise en charge & adoption",
    description:
      "Enregistrez chaque animal de l'arrivée à l'adoption, avec formulaire public et contrats générés.",
  },
  {
    icon: Wallet,
    title: "Finances",
    description: "Gérez vos dons, dépenses et générez des rapports financiers clairs.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <PawPrint className="size-5 text-primary" />
            PattePilot
          </div>
          <Button asChild size="sm">
            <Link href="/connexion">Connexion</Link>
          </Button>
        </div>
      </header>

      <section className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="rounded-full bg-secondary px-4 py-1 text-sm font-medium text-secondary-foreground">
            Outil dédié aux associations de protection animale
          </span>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Gérez votre association simplement et efficacement
          </h1>
          <p className="max-w-xl text-balance text-muted-foreground sm:text-lg">
            Une plateforme tout-en-un pour suivre vos familles d&apos;accueil, vos animaux, votre
            stock et vos finances — pour vous concentrer sur l&apos;essentiel.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link href="/connexion">
              Accéder à mon espace <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 text-center sm:mb-16">
          <h2 className="text-2xl font-bold sm:text-3xl">Tout ce dont vous avez besoin</h2>
          <p className="mt-2 text-muted-foreground">
            Des modules pensés pour le quotidien de votre association.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <feature.icon className="size-6 text-primary" />
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-secondary/50">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Prêt à simplifier la gestion de votre association ?
          </h2>
          <p className="max-w-md text-muted-foreground">
            Connectez-vous dès maintenant et retrouvez toutes vos informations en un seul endroit.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link href="/connexion">Se connecter</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <PawPrint className="size-4" />
            <span className="font-semibold text-foreground">PattePilot</span>
          </div>
          <p>© {new Date().getFullYear()} — Fait avec ❤️ pour les animaux</p>
        </div>
      </footer>
    </div>
  );
}
