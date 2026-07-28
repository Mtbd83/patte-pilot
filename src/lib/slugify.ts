/** Turns a name into a URL-safe slug suggestion (e.g. "Les Amis d'Édith" -> "les-amis-d-edith"). Editable afterwards, not guaranteed unique. */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (e.g. é -> e)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
