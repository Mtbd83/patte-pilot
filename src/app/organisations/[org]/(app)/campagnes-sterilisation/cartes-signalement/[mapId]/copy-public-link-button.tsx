"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyPublicLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick}>
      {copied ? <Check /> : <Copy />} Copier le lien public
    </Button>
  );
}
