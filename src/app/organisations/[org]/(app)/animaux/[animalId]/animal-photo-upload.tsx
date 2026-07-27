"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { uploadAnimalPhoto } from "@/server/actions/animals";
import { Button } from "@/components/ui/button";

export function AnimalPhotoUpload({
  organizationId,
  animalId,
  photoUrl,
}: {
  organizationId: string;
  animalId: string;
  photoUrl: string | null;
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
      formData.set("animalId", animalId);
      formData.set("file", file);
      await uploadAnimalPhoto(formData);
      toast.success("Photo mise à jour");
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
      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" />
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          id="animal-photo-input"
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
          {photoUrl ? "Changer la photo" : "Ajouter une photo"}
        </Button>
      </div>
    </div>
  );
}
