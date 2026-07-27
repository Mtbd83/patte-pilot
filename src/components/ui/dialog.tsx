"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * A small overlay modal — distinct from the inline toggle-card "dialogs"
 * used elsewhere in the app. Needed when a form has to open on top of
 * another already-open form (e.g. creating a foster family mid-way through
 * creating an animal) without disturbing what's underneath.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-xl border border-border bg-card shadow-lg",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
