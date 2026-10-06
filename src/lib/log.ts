/**
 * Journal d'erreurs côté serveur (visible dans les logs Vercel). Les tokens
 * de viewer (43 caractères base64url) sont masqués s'ils apparaissent.
 */
export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const redact = (s: string) => s.replace(/[A-Za-z0-9_-]{43}/g, "[token]");
  console.error(
    JSON.stringify({
      level: "error",
      context,
      message: redact(message),
      ...(extra ? { extra: JSON.parse(redact(JSON.stringify(extra))) } : {}),
    }),
  );
}
