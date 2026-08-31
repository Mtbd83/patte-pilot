import { supabase, UPLOADS_BUCKET } from "@/lib/supabase";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Allowlist of upload destinations — checked before any Supabase call, on
 * top of whatever admin-only guard the caller already did. The "uploads"
 * bucket has no per-organization storage-level isolation (see
 * src/lib/supabase.ts), so this is the one thing standing between a bug
 * upstream and an arbitrary/cross-organization write.
 */
const ALLOWED_PATH_PATTERNS = [
  new RegExp(`^logos/${UUID}$`),
  new RegExp(`^animaux/${UUID}$`),
  new RegExp(`^documents/${UUID}/certificat-(chat|nac|chien)$`),
  new RegExp(`^documents/${UUID}/contrat$`),
  new RegExp(`^campagnes-sterilisation/${UUID}$`),
  new RegExp(`^signalements/${UUID}$`),
];

export class UploadError extends Error {}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type.split("/")[1] ?? "jpg";
}

async function uploadFile(
  file: File,
  path: string,
  {
    allowedTypes,
    maxSize,
    wrongTypeMessage,
    tooLargeMessage,
  }: { allowedTypes: string[]; maxSize: number; wrongTypeMessage: string; tooLargeMessage: string },
): Promise<string> {
  if (!ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
    throw new UploadError("Destination de téléversement invalide.");
  }
  if (!allowedTypes.includes(file.type)) {
    throw new UploadError(wrongTypeMessage);
  }
  if (file.size > maxSize) {
    throw new UploadError(tooLargeMessage);
  }

  const fullPath = `${path}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(fullPath, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new UploadError(`Échec de l'envoi du fichier : ${error.message}`);

  const { data } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(fullPath);
  // Cache-bust: re-uploading overwrites the same path, so the URL itself
  // wouldn't change without this — browsers/CDN would keep serving the old
  // cached file.
  return `${data.publicUrl}?v=${Date.now()}`;
}

/**
 * Validates and uploads an image to the shared "uploads" Supabase Storage
 * bucket, returning its public URL. `path` is the destination without
 * extension (e.g. `animaux/<animalId>`) and must match
 * `ALLOWED_PATH_PATTERNS`; the file's own extension is appended, and any
 * existing file at that exact path+extension is overwritten.
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  return uploadFile(file, path, {
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxSize: 5 * 1024 * 1024,
    wrongTypeMessage: "Format d'image non supporté (JPEG, PNG, WEBP ou GIF uniquement).",
    tooLargeMessage: "L'image dépasse la taille maximale autorisée (5 Mo).",
  });
}

/** Same as uploadImage, for PDF documents (e.g. an organization's own engagement certificate). */
export async function uploadDocument(file: File, path: string): Promise<string> {
  return uploadFile(file, path, {
    allowedTypes: ["application/pdf"],
    maxSize: 10 * 1024 * 1024,
    wrongTypeMessage: "Format de fichier non supporté (PDF uniquement).",
    tooLargeMessage: "Le fichier dépasse la taille maximale autorisée (10 Mo).",
  });
}
