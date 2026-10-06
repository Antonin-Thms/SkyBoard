const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Nettoie un nom saisi : espaces normalisés, longueur bornée. Null si vide. */
export function cleanName(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  if (!name) return null;
  return name.slice(0, maxLength);
}
