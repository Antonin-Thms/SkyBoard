/**
 * Contenu d'origine des planches créées dans SkyBoard (colonne `source`),
 * conservé pour pouvoir les modifier. Une checklist de plusieurs pages =
 * plusieurs documents reliés par `group`.
 */
export type GeneratedSource =
  /** Ancienne table RAMROD seule : modifiée, elle devient une fiche tactique */
  | { kind: "ramrod"; title: string; chars: string[] }
  | { kind: "checklist"; title: string; items: string[]; group: string; part: number }
  | ({ kind: "tactical"; title: string; group: string; part: number } & TacticalData);

/** Ligne de navigation : porte-avions, terrain, tanker… */
export type NavaidRow = {
  name: string;
  tacan: string;
  ils: string;
  freq: string;
};
export type FrequencyRow = {
  name: string;
  freq: string;
};
/** Passage RTBA : waypoint et temps depuis le slot (T+, ex. « 1:35 ») */
export type RtbaRow = {
  wp: string;
  offset: string;
};
/** Code laser attribué (bombe, station) */
export type LaserCodeRow = {
  name: string;
  code: string;
};

/** Contenu d'une fiche tactique (chaque section est facultative). */
export type TacticalData = {
  /** 10 cases, une par chiffre 0 à 9 (vides : rien d'affiché) */
  ramrod: string[];
  navaids: NavaidRow[];
  rtba: RtbaRow[];
  freqs: FrequencyRow[];
  codes: LaserCodeRow[];
  notes: string;
};

/** Limites de saisie d'une fiche tactique. */
export const TACTICAL_LIMITS = { navaids: 12, rtba: 16, freqs: 20, codes: 16, field: 40, notes: 2000 } as const;

const MAX_TITLE = 120;
const MAX_ITEMS = 300;
const MAX_ITEM = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isString = (v: unknown): v is string => typeof v === "string";

/** Tableau d'objets aux champs texte bornés ; null si la forme ne convient pas. */
function parseRows<K extends string>(value: unknown, keys: readonly K[], max: number): Record<K, string>[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const rows: Record<K, string>[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = {} as Record<K, string>;
    for (const k of keys) {
      const v = (item as Record<string, unknown>)[k];
      if (v !== undefined && !isString(v)) return null;
      row[k] = (v ?? "").slice(0, TACTICAL_LIMITS.field);
    }
    rows.push(row);
  }
  return rows;
}

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
    const ramrod = parseRamrod(v.ramrod);
    const navaids = parseRows(v.navaids, ["name", "tacan", "ils", "freq"] as const, TACTICAL_LIMITS.navaids);
    // RTBA : absent des fiches créées avant son ajout.
    const rtba = parseRows(v.rtba ?? [], ["wp", "offset"] as const, TACTICAL_LIMITS.rtba);
    const freqs = parseRows(v.freqs, ["name", "freq"] as const, TACTICAL_LIMITS.freqs);
    const codes = parseRows(v.codes, ["name", "code"] as const, TACTICAL_LIMITS.codes);
    if (!ramrod || !navaids || !rtba || !freqs || !codes || !isString(v.notes)) return null;
    return {
      kind: "tactical",
      title: v.title,
      group: v.group,
      part: v.part,
      ramrod,
      navaids,
      rtba,
      freqs,
      codes,
      notes: v.notes.slice(0, TACTICAL_LIMITS.notes),
    };
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

/** Fiche tactique vide (ou reprise d'une ancienne table RAMROD). */
export function emptyTactical(ramrod: string[] = []): TacticalData {
  return {
    ramrod: Array.from({ length: 10 }, (_, i) => ramrod[i] ?? ""),
    navaids: [],
    rtba: [],
    freqs: [],
    codes: [],
    notes: "",
  };
}

/** Retire les lignes vides et les espaces superflus avant le rendu / l'enregistrement. */
export function cleanTactical(data: TacticalData): TacticalData {
  const trimRow = <T extends object>(row: T): T =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v).trim()])) as T;
  const filled = <T extends object>(rows: T[]) =>
    rows.map(trimRow).filter((row) => Object.values(row).some((v) => v !== ""));
  return {
    ramrod: data.ramrod.map((c) => c.trim()),
    navaids: filled(data.navaids).slice(0, TACTICAL_LIMITS.navaids),
    rtba: filled(data.rtba).slice(0, TACTICAL_LIMITS.rtba),
    freqs: filled(data.freqs).slice(0, TACTICAL_LIMITS.freqs),
    codes: filled(data.codes).slice(0, TACTICAL_LIMITS.codes),
    notes: data.notes.trim().slice(0, TACTICAL_LIMITS.notes),
  };
}

/** Planche en plusieurs pages (documents reliés) : identifiant du groupe. */
export function sourceGroup(source: GeneratedSource): string | null {
  return "group" in source ? source.group : null;
}
