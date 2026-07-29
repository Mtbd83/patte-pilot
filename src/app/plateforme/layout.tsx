import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { isPlatformManager } from "@/lib/permissions";

/** Shared shell for the platform-manager area — gated on `users.isPlatformManager`, not any organization's own roles. */
export default async function PlateformeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/plateforme");
  }

  if (!(await isPlatformManager(session.user.id))) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Accès refusé</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Réservé aux gestionnaires de la plateforme.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pattepilot-logo.svg" alt="PattePilot" className="h-40 w-auto" />
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/plateforme" className="hover:text-primary">
              Demandes d&apos;inscription
            </Link>
            <Link href="/plateforme/associations" className="hover:text-primary">
              Associations
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
