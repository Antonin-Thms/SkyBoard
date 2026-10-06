/** N'accepte qu'un chemin interne ("/x"), jamais "//hote" ni une URL absolue. */
export function safeRedirectPath(value: unknown, fallback = "/documents"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
