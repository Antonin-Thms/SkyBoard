/**
 * Fiche tactique (style « mission card » d'escadron) : en-tête de mission,
 * terrains (départ, arrivée, déroutement), patrouille, emports, COM1 / COM2,
 * objectifs, RAMROD, RTBA et notes. Terrains et stations COM se choisissent
 * dans des listes enregistrées (voir `TacticalRefs`), puis restent modifiables.
 */

/** Terrain : choisi dans la liste, valeurs recopiées dans la fiche. */
export type Airbase = {
  name: string;
  tacan: string;
  vhf: string;
  uhf: string;
  elev: string;
  runway: string;
  ils: string;
};
/** Station radio : canal (U12…), nom (ETAD TWR…), fréquence. */
export type Station = {
  code: string;
  name: string;
  freq: string;
};
/** Appareil de soutien : ravitailleur, AWACS, GCI… */
export type SupportUnit = {
  role: string;
  type: string;
  callsign: string;
  uhf: string;
  vhf: string;
  tacan: string;
  alt: string;
  notes: string;
};
export type FlightMember = {
  pilot: string;
  helmet: string;
  tacan: string;
  laser: string;
  stn: string;
  tail: string;
  notes: string;
};
export type Target = {
  type: string;
  coords: string;
  alt: string;
  notes: string;
};
/** Passage RTBA : waypoint et temps depuis le slot (T+) */
export type RtbaRow = {
  wp: string;
  offset: string;
};

export type TacticalSheet = {
  header: { callsign: string; pri: string; aux: string; mission: string; weather: string; time: string };
  airbases: { dep: Airbase; arr: Airbase; alt: Airbase };
  flight: FlightMember[];
  loadout: { aa: string; ag: string; pod: string; tanks: string };
  com1: Station[];
  com2: Station[];
  targets: Target[];
  support: SupportUnit[];
  /** 10 cases, une par chiffre 0 à 9 */
  ramrod: string[];
  rtba: RtbaRow[];
  notes: string;
};

/**
 * Lignes de la fiche : 4 par défaut (lignes vides à remplir au crayon) ;
 * radios et objectifs peuvent en avoir plus (jusqu'à `max`).
 */
export const TACTICAL_ROWS = { flight: 4, com: 4, targets: 4, support: 2 } as const;
export const TACTICAL_LIMITS = { rtba: 16, com: 12, targets: 12, support: 12, field: 40, notes: 2000, refs: 300 } as const;

/** Casques proposés pour la patrouille. */
export const HELMETS = ["HMCS", "NVG"] as const;

/**
 * TACAN air-air des ailiers : canal du leader + 63, même bande
 * (61Y → 124Y). Au-delà de 63, on retire 63 (70X → 7X). Vide si le canal
 * du leader n'est pas valide (1 à 126, X ou Y).
 */
export function wingmanTacan(leader: string): string {
  const m = /^\s*(\d{1,3})\s*([XY])\s*$/i.exec(leader);
  if (!m) return "";
  const channel = Number(m[1]);
  if (channel < 1 || channel > 126) return "";
  return `${channel <= 63 ? channel + 63 : channel - 63}${m[2].toUpperCase()}`;
}

/** TACAN des ailiers recalculés depuis celui du leader (lignes de patrouille remplies seulement). */
export function withWingmenTacan(flight: FlightMember[]): FlightMember[] {
  const tacan = wingmanTacan(flight[0]?.tacan ?? "");
  return flight.map((m, i) => {
    if (i === 0) return m;
    const used = Object.entries(m).some(([k, v]) => k !== "tacan" && v.trim());
    return { ...m, tacan: used ? tacan : "" };
  });
}

/** Une section est vide si aucune de ses cases n'est remplie (elle n'apparaît pas sur la planche). */
export const isBlank = (...rows: Record<string, string>[]) => rows.every((row) => Object.values(row).every((v) => !v.trim()));

export const AIRBASE_KEYS = ["name", "tacan", "vhf", "uhf", "elev", "runway", "ils"] as const;
export const STATION_KEYS = ["code", "name", "freq"] as const;
export const SUPPORT_KEYS = ["role", "type", "callsign", "uhf", "vhf", "tacan", "alt", "notes"] as const;
const FLIGHT_KEYS = ["pilot", "helmet", "tacan", "laser", "stn", "tail", "notes"] as const;
const TARGET_KEYS = ["type", "coords", "alt", "notes"] as const;
const HEADER_KEYS = ["callsign", "pri", "aux", "mission", "weather", "time"] as const;
const LOADOUT_KEYS = ["aa", "ag", "pod", "tanks"] as const;

const isString = (v: unknown): v is string => typeof v === "string";
const blank = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>;

export const emptyAirbase = (): Airbase => blank(AIRBASE_KEYS);
export const emptyStation = (): Station => blank(STATION_KEYS);
export const emptySupport = (): SupportUnit => blank(SUPPORT_KEYS);

export function emptyTacticalSheet(ramrod: string[] = []): TacticalSheet {
  return {
    header: blank(HEADER_KEYS),
    airbases: { dep: emptyAirbase(), arr: emptyAirbase(), alt: emptyAirbase() },
    flight: Array.from({ length: TACTICAL_ROWS.flight }, () => blank(FLIGHT_KEYS)),
    loadout: blank(LOADOUT_KEYS),
    com1: Array.from({ length: TACTICAL_ROWS.com }, emptyStation),
    com2: Array.from({ length: TACTICAL_ROWS.com }, emptyStation),
    targets: Array.from({ length: TACTICAL_ROWS.targets }, () => blank(TARGET_KEYS)),
    support: Array.from({ length: TACTICAL_ROWS.support }, emptySupport),
    ramrod: Array.from({ length: 10 }, (_, i) => ramrod[i] ?? ""),
    rtba: [],
    notes: "",
  };
}

/** Objet aux champs texte (bornés) ; null si la forme ne convient pas. */
function parseRecord<K extends string>(value: unknown, keys: readonly K[]): Record<K, string> | null {
  if (value === undefined) return blank(keys);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = {} as Record<K, string>;
  for (const k of keys) {
    const v = (value as Record<string, unknown>)[k];
    if (v !== undefined && !isString(v)) return null;
    out[k] = (v ?? "").slice(0, TACTICAL_LIMITS.field);
  }
  return out;
}

/** Tableau de longueur fixe `size` (complété par des lignes vides). */
function parseFixedRows<K extends string>(value: unknown, keys: readonly K[], size: number): Record<K, string>[] | null {
  if (value === undefined) value = [];
  if (!Array.isArray(value) || value.length > size) return null;
  const rows: Record<K, string>[] = [];
  for (const item of value) {
    const row = parseRecord(item, keys);
    if (!row) return null;
    rows.push(row);
  }
  while (rows.length < size) rows.push(blank(keys));
  return rows;
}

export function parseRows<K extends string>(value: unknown, keys: readonly K[], max: number): Record<K, string>[] | null {
  if (value === undefined) value = [];
  if (!Array.isArray(value) || value.length > max) return null;
  const rows: Record<K, string>[] = [];
  for (const item of value) {
    const row = parseRecord(item, keys);
    if (!row) return null;
    rows.push(row);
  }
  return rows;
}

function parseRamrod(value: unknown): string[] | null {
  if (value === undefined) value = [];
  if (!Array.isArray(value) || value.length > 10 || !value.every(isString)) return null;
  const chars = value.map((c) => Array.from(c).slice(0, 1).join(""));
  while (chars.length < 10) chars.push("");
  return chars;
}

/**
 * Fiche tactique lue depuis la base. Une fiche de la première version
 * (navigation, fréquences, codes laser) est convertie : ces lignes passent
 * dans les notes, RAMROD et RTBA sont repris tels quels.
 */
export function parseTacticalSheet(v: Record<string, unknown>): TacticalSheet | null {
  const ramrod = parseRamrod(v.ramrod);
  const rtba = parseRows(v.rtba, ["wp", "offset"] as const, TACTICAL_LIMITS.rtba);
  if (!ramrod || !rtba) return null;
  if (v.notes !== undefined && !isString(v.notes)) return null;
  const notes = (v.notes ?? "").slice(0, TACTICAL_LIMITS.notes);

  if (!("header" in v)) {
    const legacy = [
      ...(parseRows(v.navaids, ["name", "tacan", "ils", "freq"] as const, 50) ?? []).map((r) =>
        [r.name, r.tacan && `TCN ${r.tacan}`, r.ils && `ILS ${r.ils}`, r.freq].filter(Boolean).join(" · "),
      ),
      ...(parseRows(v.freqs, ["name", "freq"] as const, 50) ?? []).map((r) => [r.name, r.freq].filter(Boolean).join(" · ")),
      ...(parseRows(v.codes, ["name", "code"] as const, 50) ?? []).map((r) => [r.name, r.code].filter(Boolean).join(" · ")),
    ];
    const sheet = emptyTacticalSheet(ramrod);
    sheet.rtba = rtba;
    sheet.notes = [...legacy, notes].filter(Boolean).join("\n").slice(0, TACTICAL_LIMITS.notes);
    return sheet;
  }

  const header = parseRecord(v.header, HEADER_KEYS);
  const loadout = parseRecord(v.loadout, LOADOUT_KEYS);
  const airbases = v.airbases as Record<string, unknown> | undefined;
  const dep = parseRecord(airbases?.dep, AIRBASE_KEYS);
  const arr = parseRecord(airbases?.arr, AIRBASE_KEYS);
  const alt = parseRecord(airbases?.alt, AIRBASE_KEYS);
  const flight = parseFixedRows(v.flight, FLIGHT_KEYS, TACTICAL_ROWS.flight);
  const com1 = parseRows(v.com1, STATION_KEYS, TACTICAL_LIMITS.com);
  const com2 = parseRows(v.com2, STATION_KEYS, TACTICAL_LIMITS.com);
  const targets = parseRows(v.targets, TARGET_KEYS, TACTICAL_LIMITS.targets);
  // Support : absent des fiches créées avant son ajout.
  const support = parseRows(v.support, SUPPORT_KEYS, TACTICAL_LIMITS.support);
  if (!header || !loadout || !dep || !arr || !alt || !flight || !com1 || !com2 || !targets || !support) return null;
  return { header, airbases: { dep, arr, alt }, flight, loadout, com1, com2, targets, support, ramrod, rtba, notes };
}

/** Espaces superflus retirés, lignes RTBA vides supprimées (avant rendu / enregistrement). */
export function cleanTacticalSheet(s: TacticalSheet): TacticalSheet {
  const trim = <T extends Record<string, string>>(row: T): T =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v.trim()])) as T;
  return {
    header: trim(s.header),
    airbases: { dep: trim(s.airbases.dep), arr: trim(s.airbases.arr), alt: trim(s.airbases.alt) },
    flight: withWingmenTacan(s.flight.map(trim)),
    loadout: trim(s.loadout),
    com1: s.com1.map(trim),
    com2: s.com2.map(trim),
    targets: s.targets.map(trim),
    support: s.support.map(trim),
    ramrod: s.ramrod.map((c) => c.trim()),
    rtba: s.rtba.map(trim).filter((r) => r.wp || r.offset),
    notes: s.notes.trim(),
  };
}

/** Listes enregistrées : terrains et stations radio de l'escadron. */
export type TacticalRefs = { airbases: Airbase[]; stations: Station[]; support: SupportUnit[] };

/**
 * Lignes collées depuis Excel (tabulations), ou séparées par « ; ».
 * Colonnes dans l'ordre de `keys` ; lignes vides ignorées.
 */
export function parsePastedRows<K extends string>(text: string, keys: readonly K[]): Record<K, string>[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(line.includes("\t") ? "\t" : ";").map((c) => c.trim()))
    .filter((cells) => cells.some(Boolean))
    .slice(0, TACTICAL_LIMITS.refs)
    .map((cells) => Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").slice(0, TACTICAL_LIMITS.field)])) as Record<K, string>);
}
