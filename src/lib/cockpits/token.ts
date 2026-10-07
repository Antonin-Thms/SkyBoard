/** Token viewer : 32 octets aléatoires en base64url sans padding = 43 caractères. */
const VIEWER_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isViewerToken(value: unknown): value is string {
  return typeof value === "string" && VIEWER_TOKEN_RE.test(value);
}

export interface ViewerUrlOptions {
  /** Fond noir au lieu du fond transparent par défaut */
  opaque?: boolean;
  hideStatus?: boolean;
  cursor?: boolean;
}

/** URL du viewer à coller dans l'onglet Web Dashboard d'OpenKneeboard. */
export function buildViewerUrl(origin: string, token: string, options: ViewerUrlOptions = {}): string {
  const url = new URL(`/viewer/${token}`, origin);
  if (options.opaque) url.searchParams.set("transparent", "0");
  if (options.hideStatus) url.searchParams.set("status", "0");
  if (options.cursor) url.searchParams.set("cursor", "1");
  return url.toString();
}
