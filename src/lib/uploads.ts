import { supabase, UPLOADS_BUCKET } from "@/lib/supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class UploadError extends Error {}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] ?? "jpg";
}

/**
 * Validates and uploads an image to the shared "uploads" Supabase Storage
 * bucket (public, anon-writable — see src/lib/supabase.ts), returning its
 * public URL. `path` is the destination without extension (e.g.
 * `animaux/<animalId>`); the file's own extension is appended, and any
 * existing file at that exact path+extension is overwritten.
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new UploadError("Format d'image non supporté (JPEG, PNG, WEBP ou GIF uniquement).");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError("L'image dépasse la taille maximale autorisée (5 Mo).");
  }

  const fullPath = `${path}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(fullPath, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new UploadError(`Échec de l'envoi de l'image : ${error.message}`);

  const { data } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(fullPath);
  // Cache-bust: re-uploading overwrites the same path, so the URL itself
  // wouldn't change without this — browsers/CDN would keep serving the old
  // cached image.
  return `${data.publicUrl}?v=${Date.now()}`;
}
