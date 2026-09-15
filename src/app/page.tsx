import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  PawPrint,
  Home,
  HeartHandshake,
  Syringe,
  Stethoscope,
  Package,
  Wallet,
  Users,
  ArrowRight,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: PawPrint,
    title: "Animaux",
    description:
      "Une fiche complète par animal : statut, soins, historique, du jour de l'arrivée à l'adoption.",
  },
  {
    icon: Home,
    title: "Familles d'accueil",
    description:
      "Gérez vos familles d'accueil et leurs disponibilités — rapprochées automatiquement dès qu'elles rejoignent la plateforme.",
  },
  {
    icon: HeartHandshake,
    title: "Candidatures & adoption",
    description:
      "Formulaire public personnalisable, suivi des candidatures, certificat d'engagement et contrat d'adoption générés automatiquement.",
  },
  {
    icon: Syringe,
    title: "Campagnes de stérilisation",
    description:
      "Bons, partenaires vétérinaires et cartes publiques de signalement de chats errants avec géolocalisation.",
  },
  {
    icon: Stethoscope,
    title: "Vétérinaires partenaires",
    description: "Centralisez coordonnées et tarifs de vos vétérinaires partenaires.",
  },
  {
    icon: Package,
    title: "Stock & matériel",
    description: "Suivez votre inventaire de nourriture, médicaments et équipements en temps réel.",
  },
  {
    icon: Wallet,
    title: "Finances",
    description: "Gérez vos dons, dépenses et générez des rapports financiers clairs.",
  },
  {
    icon: Users,
    title: "Membres & bénévoles",
    description:
      "Invitations, rôles et permissions fines pour donner à chaque bénévole exactement l'accès dont il a besoin.",
  },
];

export default async function HomePage(props: {
  searchParams: Promise<{ pwa?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  const loggedIn = Boolean(session?.user?.id);
  const ctaHref = loggedIn ? "/apres-connexion" : "/connexion";

  // Launched from the installed PWA icon (manifest's start_url carries this
  // marker) — a logged-in user wants their workspace, not the marketing
  // page. A normal browser visit to "/" never has this param, so it's
  // unaffected even when logged in.
  if (searchParams.pwa && loggedIn) {
    redirect("/apres-connexion");
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pattepilot-logo.svg" alt="PattePilot" className="h-40 w-auto" />
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-6 text-lg font-medium sm:flex">
              <a href="#fonctionnalites" className="text-muted-foreground hover:text-foreground">
                Fonctionnalités
              </a>
              <Link href="/rejoindre" className="text-muted-foreground hover:text-foreground">
                Rejoindre
              </Link>
            </nav>
            <Button asChild size="lg">
              <Link href={ctaHref}>{loggedIn ? "Mon espace" : "Connexion"}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative flex min-h-[60vh] w-full items-center justify-center overflow-hidden border-b border-border sm:min-h-[85vh]">
        <Image
          src="/images/close-up-portrait-beautiful-cat.jpg"
          alt="Un chat et un chien blottis ensemble sous une couverture"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center text-white sm:px-6 sm:py-24">
          <span className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:animation-duration-700 motion-safe:fill-mode-both rounded-full bg-white/15 px-4 py-1 text-sm font-medium backdrop-blur">
            Outil dédié aux associations de protection animale
          </span>
          <h1 className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:animation-duration-700 motion-safe:delay-150 motion-safe:fill-mode-both text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Gérez votre association simplement et efficacement
          </h1>
          <p className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:animation-duration-700 motion-safe:delay-300 motion-safe:fill-mode-both max-w-xl text-balance text-white/90 sm:text-lg">
            Une plateforme tout-en-un pour suivre vos familles d&apos;accueil, vos animaux, votre
            stock et vos finances — pour vous concentrer sur l&apos;essentiel.
          </p>
          <Button
            asChild
            size="lg"
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:animation-duration-700 motion-safe:delay-500 motion-safe:fill-mode-both mt-2"
          >
            <Link href={ctaHref}>
              Accéder à mon espace <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <section id="fonctionnalites" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-stretch lg:gap-12">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-lg lg:aspect-auto">
            <Image
              src="/images/hero-dog.jpg"
              alt="Un chien recueilli par notre association"
              fill
              sizes="(min-width: 1024px) 35vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <div className="mb-10 text-center sm:mb-12 lg:text-left">
              <h2 className="text-2xl font-bold sm:text-3xl">Tout ce dont vous avez besoin</h2>
              <p className="mt-2 text-muted-foreground">
                Des modules pensés pour le quotidien de votre association.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border">
        <Image
          src="/images/hero-kitten.jpg"
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="object-cover object-[75%_35%]"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center text-white sm:px-6 sm:py-24">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Prêt à simplifier la gestion de votre association ?
          </h2>
          <p className="max-w-md text-white/90">
            Décrivez votre association, nous revenons vers vous rapidement pour la mettre en place
            sur PattePilot.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link href="/rejoindre">Rejoindre PattePilot</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pattepilot-logo.svg" alt="PattePilot" className="h-20 w-auto" />
          </div>
          <p>© {new Date().getFullYear()} — Fait avec ❤️ pour les animaux</p>
          <Link href="/rejoindre" className="underline-offset-4 hover:underline">
            Vous représentez une association ? Rejoignez PattePilot
          </Link>
        </div>
        <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-4 gap-y-1 px-4 pb-6 text-xs text-muted-foreground sm:justify-start sm:px-6">
          <Link href="/mentions-legales" className="hover:underline">
            Mentions légales
          </Link>
          <Link href="/cgu" className="hover:underline">
            CGU
          </Link>
          <Link href="/confidentialite" className="hover:underline">
            Politique de confidentialité
          </Link>
        </div>
      </footer>
    </div>
  );
}
