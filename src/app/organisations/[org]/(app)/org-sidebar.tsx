"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, X, LogOut, PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MOBILE_BREAKPOINT = 768;

/**
 * Whether the mobile (drawer) nav should render instead of the desktop
 * sidebar. Both variants show the same org name/logo text, so mounting them
 * both at once (even with one CSS-hidden) leaves two identically-named
 * landmarks in the DOM — confusing for assistive tech and for anything that
 * looks elements up by accessible name. Tracking the breakpoint in JS keeps
 * exactly one mounted at a time; `undefined` during the first render (before
 * we know the viewport) intentionally renders nothing rather than guessing.
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

interface NavLink {
  href: string;
  label: string;
}

export function OrgSidebar({
  orgSlug,
  orgName,
  logoUrl,
}: {
  orgSlug: string;
  orgName: string;
  logoUrl: string | null;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const base = `/organisations/${orgSlug}`;

  function BrandIcon() {
    return logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className="size-5 shrink-0 rounded object-cover" />
    ) : (
      <PawPrint className="size-5 text-primary" />
    );
  }

  const links: NavLink[] = [
    { href: base, label: "Tableau de bord" },
    { href: `${base}/animaux`, label: "Animaux" },
    { href: `${base}/familles-accueil`, label: "Familles d'accueil" },
    { href: `${base}/comptabilite`, label: "Comptabilité" },
    { href: `${base}/stock`, label: "Stock" },
    { href: `${base}/candidatures`, label: "Candidatures" },
    { href: `${base}/membres`, label: "Membres" },
    { href: `${base}/parametres`, label: "Paramètres" },
  ];

  function isActive(href: string) {
    return href === base ? pathname === base : pathname.startsWith(href);
  }

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive(link.href) && "bg-accent text-foreground",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    );
  }

  function SignOutButton() {
    return (
      <div className="border-t border-border p-3">
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="size-4" />
          Se déconnecter
        </button>
      </div>
    );
  }

  if (isMobile === undefined) return null;

  if (isMobile) {
    return (
      <>
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
          <Link href={base} className="flex items-center gap-2 font-semibold">
            <BrandIcon />
            <span className="truncate">{orgName}</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </header>

        {open && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col bg-background shadow-lg">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <Link
                  href={base}
                  className="flex items-center gap-2 font-semibold"
                  onClick={() => setOpen(false)}
                >
                  <BrandIcon />
                  <span className="truncate">{orgName}</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fermer le menu">
                  <X />
                </Button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
              <SignOutButton />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col border-r border-border">
      <Link href={base} className="flex h-14 items-center gap-2 border-b border-border px-4 font-semibold">
        <BrandIcon />
        <span className="truncate">{orgName}</span>
      </Link>
      <NavLinks />
      <SignOutButton />
    </aside>
  );
}
