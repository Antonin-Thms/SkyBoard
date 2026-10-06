// Variables publiques : référencées littéralement pour que Next.js les inline
// dans le bundle client.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  }
  return value;
}

export function supabaseUrl(): string {
  return normalizeSupabaseUrl(
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  );
}

/**
 * Ne garde que l'origine (https://xxxx.supabase.co) : tolère une URL copiée
 * avec un chemin (/rest/v1/), un slash final ou des guillemets.
 */
export function normalizeSupabaseUrl(value: string): string {
  const cleaned = value.trim().replace(/^["']|["']$/g, "");
  try {
    return new URL(cleaned).origin;
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL invalide : "${cleaned}" (attendu : https://<id-projet>.supabase.co)`,
    );
  }
}

export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/**
 * Variables requises absentes (noms seulement, jamais les valeurs).
 * Sert à afficher un diagnostic clair plutôt qu'une erreur 500 muette.
 */
export function missingServerEnv(): string[] {
  const vars: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    VIEWER_CHANNEL_SECRET: process.env.VIEWER_CHANNEL_SECRET,
  };
  return Object.entries(vars)
    .filter(([, v]) => !v)
    .map(([k]) => k);
}
