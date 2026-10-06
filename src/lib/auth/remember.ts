/**
 * « Se souvenir de moi ». Coché (par défaut) : cookies de session Supabase
 * persistants (400 jours, rafraîchis automatiquement). Décoché : cookies de
 * session navigateur, effacés à sa fermeture.
 *
 * @supabase/ssr impose une durée aux cookies qu'il écrit : on retire donc
 * maxAge / expires au moment de l'écriture quand l'option est décochée.
 */
export const REMEMBER_COOKIE = "skyboard-remember";

/** Valeur du cookie quand l'utilisateur NE veut PAS rester connecté. */
export const FORGET_VALUE = "0";

export function shouldRemember(cookieValue: string | undefined | null): boolean {
  return cookieValue !== FORGET_VALUE;
}

interface CookieLifetime {
  maxAge?: number;
  expires?: Date;
}

/** Adapte les options d'un cookie d'auth à la préférence (les suppressions, maxAge 0, sont gardées). */
export function applyRememberPolicy<T extends CookieLifetime>(options: T | undefined, remember: boolean): T | undefined {
  if (remember || !options) return options;
  const isDeletion = options.maxAge !== undefined && options.maxAge <= 0;
  if (isDeletion) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
