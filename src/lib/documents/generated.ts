/**
 * Contenu d'origine des planches créées dans SkyBoard (colonne `source`),
 * conservé pour pouvoir les modifier. Une checklist de plusieurs pages =
 * plusieurs documents reliés par `group`.
 */
import { parseRows, parseTacticalSheet, TACTICAL_LIMITS, type RtbaRow, type TacticalSheet } from "./tactical";

export type GeneratedSource =
  /** Ancienne table RAMROD seule : modifiée, elle devient une fiche tactique */
  | { kind: "ramrod"; title: string; chars: string[] }
  | { kind: "checklist"; title: string; items: string[]; group: string; part: number }
  | ({ kind: "tactical"; title: string; group: string; part: number } & TacticalSheet)
  /** Planche RTBA : slot T0 réglé en vol, heures de passage calculées par le viewer */
  | { kind: "rtba"; title: string; rows: RtbaRow[] };

export type { TacticalSheet } from "./tactical";

const MAX_TITLE = 120;
const MAX_ITEMS = 300;
const MAX_ITEM = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isString = (v: unknown): v is string => typeof v === "string";

function parseRamrod(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 10 || !value.every(isString)) return null;
  const chars = value.map((c) => Array.from(c).slice(0, 1).join(""));
  while (chars.length < 10) chars.push("");
  return chars;
}

/** Lit `source` (JSON venu de la base) ; null si ce n'est pas une planche modifiable. */
export function parseGeneratedSource(value: unknown): GeneratedSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!isString(v.title) || v.title.length > MAX_TITLE) return null;

  if (v.kind === "ramrod") {
    const chars = parseRamrod(v.chars);
    return chars ? { kind: "ramrod", title: v.title, chars } : null;
  }

  if (v.kind === "tactical") {
    if (!isString(v.group) || !UUID_RE.test(v.group)) return null;
    if (typeof v.part !== "number" || !Number.isInteger(v.part) || v.part < 1) return null;
    const sheet = parseTacticalSheet(v);
    return sheet ? { kind: "tactical", title: v.title, group: v.group, part: v.part, ...sheet } : null;
  }

  if (v.kind === "rtba") {
    const rows = parseRows(v.rows, ["wp", "offset"] as const, TACTICAL_LIMITS.rtba);
    return rows ? { kind: "rtba", title: v.title, rows } : null;
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

/** Planche en plusieurs pages (documents reliés) : identifiant du groupe. */
export function sourceGroup(source: GeneratedSource): string | null {
  return "group" in source ? source.group : null;
}
