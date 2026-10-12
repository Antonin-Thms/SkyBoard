/**
 * Contenu d'origine des planches créées dans SkyBoard (colonne `source`),
 * conservé pour pouvoir les modifier. Une checklist de plusieurs pages =
 * plusieurs documents reliés par `group`.
 */
export type GeneratedSource =
  | { kind: "ramrod"; title: string; chars: string[] }
  | { kind: "checklist"; title: string; items: string[]; group: string; part: number };

const MAX_TITLE = 120;
const MAX_ITEMS = 300;
const MAX_ITEM = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isString = (v: unknown): v is string => typeof v === "string";

/** Lit `source` (JSON venu de la base) ; null si ce n'est pas une planche modifiable. */
export function parseGeneratedSource(value: unknown): GeneratedSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!isString(v.title) || v.title.length > MAX_TITLE) return null;

  if (v.kind === "ramrod") {
    if (!Array.isArray(v.chars) || v.chars.length > 10 || !v.chars.every(isString)) return null;
    const chars = v.chars.map((c) => Array.from(c).slice(0, 1).join(""));
    while (chars.length < 10) chars.push("");
    return { kind: "ramrod", title: v.title, chars };
  }

  if (v.kind === "checklist") {
    if (!Array.isArray(v.items) || v.items.length > MAX_ITEMS || !v.items.every(isString)) return null;
    if (!isString(v.group) || !UUID_RE.test(v.group)) return null;
    if (typeof v.part !== "number" || !Number.isInteger(v.part) || v.part < 1) return null;
    return {
      kind: "checklist",
      title: v.title,
      items: v.items.map((i) => i.slice(0, MAX_ITEM)),
      group: v.group,
      part: v.part,
    };
  }
  return null;
}
