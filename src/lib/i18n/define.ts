import type { Locale } from "./config";

/** Même arborescence que le français, mais avec des chaînes quelconques. */
export type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

/**
 * Déclare les textes d'un espace de noms dans toutes les langues.
 * Le français sert de modèle : une clé manquante ou en trop dans une autre
 * langue est une erreur de compilation.
 */
export function defineMessages<const T extends object>(messages: { fr: T } & Record<Exclude<Locale, "fr">, Shape<T>>) {
  return messages as Record<Locale, Shape<T>>;
}

/** Remplace les {variables} : fmt("{n} documents", { n: 3 }). */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
