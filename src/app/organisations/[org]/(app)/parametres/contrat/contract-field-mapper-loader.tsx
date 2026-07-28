"use client";

import dynamic from "next/dynamic";

// pdfjs-dist's browser build references DOMMatrix (browser-only), which
// doesn't exist during Next's server-side render of client components —
// `ssr: false` skips that entirely so it only ever loads in the browser.
export const ContractFieldMapper = dynamic(
  () => import("./contract-field-mapper").then((mod) => mod.ContractFieldMapper),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground">Chargement de l&apos;outil…</p>,
  },
);
