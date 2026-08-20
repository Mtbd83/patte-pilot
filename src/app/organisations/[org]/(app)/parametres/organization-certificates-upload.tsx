"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { updateOrganizationCertificate } from "@/server/actions/organizations";
import { Button } from "@/components/ui/button";

function CertificateUpload({
  organizationId,
  species,
  label,
  fileUrl,
}: {
  organizationId: string;
  species: "chat" | "nac" | "chien";
  label: string;
  fileUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("organizationId", organizationId);
      formData.set("species", species);
      formData.set("file", file);
      await updateOrganizationCertificate(formData);
      toast.success("Certificat mis à jour");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
        <FileText className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-sm font-medium">{label}</span>
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline"
          >
            Voir le fichier actuel
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Aucun fichier configuré</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        id={`certificate-input-${species}`}
        onChange={handleChange}
        disabled={pending}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {fileUrl ? "Remplacer" : "Ajouter"}
      </Button>
    </div>
  );
}

export function OrganizationCertificatesUpload({
  organizationId,
  certificateFileUrlChat,
  certificateFileUrlNac,
  certificateFileUrlChien,
}: {
  organizationId: string;
  certificateFileUrlChat: string | null;
  certificateFileUrlNac: string | null;
  certificateFileUrlChien: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <CertificateUpload
        organizationId={organizationId}
        species="chat"
        label="Certificat — chat"
        fileUrl={certificateFileUrlChat}
      />
      <CertificateUpload
        organizationId={organizationId}
        species="nac"
        label="Certificat — NAC (lapin, autres)"
        fileUrl={certificateFileUrlNac}
      />
      <CertificateUpload
        organizationId={organizationId}
        species="chien"
        label="Certificat — chien"
        fileUrl={certificateFileUrlChien}
      />
    </div>
  );
}
