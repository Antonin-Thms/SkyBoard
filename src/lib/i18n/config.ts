/** Langues de l'interface. Le français reste la langue de référence. */
export const LOCALES = ["fr", "en", "de", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
/** Cookie qui mémorise le choix (un an). */
export const LOCALE_COOKIE = "skyboard-lang";

/** Nom de chaque langue, écrit dans cette langue. */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
  es: "Español",
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/**
 * Langue préférée d'après l'en-tête Accept-Language (« de-CH,de;q=0.9,en;q=0.8 »).
 * Sert quand aucun choix n'est mémorisé : première visite, ou viewer dans
 * OpenKneeboard (qui suit alors la langue de Windows).
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split("-")[0], quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.lang && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranked.find((entry) => isLocale(entry.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}
