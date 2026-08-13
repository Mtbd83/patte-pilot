import Link from "next/link";
import { connection } from "next/server";

const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "Conditions Générales d'Utilisation" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
];

/**
 * Shared chrome for the platform's public legal pages (mentions légales,
 * CGU, confidentialité) — not per-organization, PattePilot's own as editor
 * of the software.
 *
 * Forces dynamic rendering for the whole group — required for the CSP
 * nonce (see src/proxy.ts) to actually reach these pages' scripts: a
 * statically-prerendered page has no per-request nonce to embed, so the
 * browser blocks every script tag (including the app shell's own, e.g. the
 * toaster/service worker registration in the root layout).
 */
export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pattepilot-logo.svg" alt="PattePilot" className="h-10 w-auto" />
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 text-sm leading-relaxed text-foreground [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_section]:flex [&_section]:flex-col [&_section]:gap-2">
          {children}
        </div>

        <nav className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
