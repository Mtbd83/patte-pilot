"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, X, LogOut, PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavLink {
  href: string;
  label: string;
}

export function OrgNav({ orgSlug, orgName }: { orgSlug: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const base = `/organisations/${orgSlug}`;

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

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={base} className="flex items-center gap-2 font-semibold">
          <PawPrint className="size-5 text-primary" />
          <span className="truncate">{orgName}</span>
        </Link>

        <nav className="hidden items-center gap-0.5 overflow-x-auto md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:px-3",
                isActive(link.href) && "bg-accent text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 shrink-0"
            onClick={() => signOut()}
            title="Se déconnecter"
          >
            <LogOut />
          </Button>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive(link.href) && "bg-accent text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="size-4" />
            Se déconnecter
          </button>
        </nav>
      )}
    </header>
  );
}
