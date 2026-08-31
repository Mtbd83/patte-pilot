"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";

/** The table's thumbnail is deliberately tiny (fits a row) — click it to see the photo full-size. */
export function ReportPhotoThumbnail({ photoUrl }: { photoUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="Photo du signalement" className="size-full object-cover" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Photo du signalement" className="max-w-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="Photo du signalement" className="w-full rounded-lg object-contain" />
      </Dialog>
    </>
  );
}
