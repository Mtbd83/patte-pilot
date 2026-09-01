"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";

/** A small clickable thumbnail (fits a table row) that opens the same photo full-size in a dialog. */
export function PhotoThumbnail({
  photoUrl,
  alt,
  className = "size-12",
}: {
  photoUrl: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${className} shrink-0 overflow-hidden rounded-md border border-border bg-muted`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={alt} className="size-full object-cover" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={alt} className="max-w-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={alt} className="w-full rounded-lg object-contain" />
      </Dialog>
    </>
  );
}
