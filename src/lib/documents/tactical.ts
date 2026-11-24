/**
 * Fiche tactique (« mission card » d'escadron), au format de la fiche Excel
 * de l'escadron : DATA, AIRFIELDS, FLIGHT, LOADOUT (configuration, carburant,
 * spec), RADIO (UHF / VHF, notes COM, SPIN), WAYPOINTS (notes, menaces),
 * PACKAGE, SUPPORT, ADMIN (bullseye, RAMROD), RTBA et GAMEPLAN.
 * Terrains, stations radio et support se choisissent dans des listes
 * enregistrées (voir `TacticalRefs`), puis restent modifiables.
 */

// --- Listes enregistrées (« Gérer mes listes ») ---------------------------

/** Terrain de la liste (colonnes de l'import Excel / MANEX). */
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
/** Appareil de soutien de la liste : ravitailleur, AWACS, GCI… */
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

// --- Fiche --------------------------------------------------------------

/** Terrain de la fiche (DEP / ARR / ALT). */
export type Airfield = {
  name: string;
  runway: string;
  tacan: string;
  wpt: string;
  freq: string;
  elev: string;
  procedure: string;
  ils: string;
};
export type FlightMember = {
  crew: string;
  type: string;
  helmet: string;
  tacan: string;
  sqwk: string;
  sanctuary: string;
  laser: string;
  serial: string;
  livery: string;
};
export type Waypoint = {
  n: string;
  name: string;
  coords: string;
  alt: string;
};
export type PackageMember = {
  callsign: string;
  type: string;
  com: string;
  leader: string;
  stn: string;
  tacan: string;
  alt: string;
  task: string;
};
/** Ligne SUPPORT de la fiche. */
export type SupportRow = {
  role: string;
  type: string;
  callsign: string;
  com: string;
  wpt: string;
  tacan: string;
  alt: string;
  notes: string;
};
/** Passage RTBA : waypoint et temps depuis le waypoint précédent (T+) */
export type RtbaRow = {
  wp: string;
  offset: string;
};

export type TacticalSheet = {
  version: 3;
  data: { callsign: string; task: string; date: string; time: string; area: string; server: string; package: string; weather: string };
  airfields: { dep: Airfield; arr: Airfield; alt: Airfield };
  flight: FlightMember[];
  loadout: { aa: string; tanks: string; ecm: string; ag: string; pods: string; chfl: string; notes: string };
  fuel: { total: string; target: string; joker: string; bingo: string; altn: string };
  spec: { rotSpd: string; alow: string; msl: string; stn: string };
  uhf: Station[];
  vhf: Station[];
  comNotes: string;
  spin: string;
  waypoints: Waypoint[];
  wptNotes: string;
  threatNotes: string;
  package: PackageMember[];
  support: SupportRow[];
  bullseye: { name: string; lat: string; lon: string; wpt: string };
  /** 10 cases, une par chiffre 0 à 9 */
  ramrod: string[];
  rtba: RtbaRow[];
  gameplan: string;
};

/** Lignes par défaut (lignes vides à remplir) ; listes extensibles jusqu'à `TACTICAL_LIMITS`. */
export const TACTICAL_ROWS = { flight: 4, com: 4, waypoints: 4, package: 2, support: 2 } as const;
export const TACTICAL_LIMITS = {
  rtba: 16,
  com: 12,
  waypoints: 12,
  package: 10,
  support: 12,
  field: 40,
  text: 1000,
  notes: 2000,
  refs: 300,
} as const;

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
export const AIRFIELD_KEYS = ["name", "runway", "tacan", "wpt", "freq", "elev", "procedure", "ils"] as const;
export const FLIGHT_KEYS = ["crew", "type", "helmet", "tacan", "sqwk", "sanctuary", "laser", "serial", "livery"] as const;
export const WAYPOINT_KEYS = ["n", "name", "coords", "alt"] as const;
export const PACKAGE_KEYS = ["callsign", "type", "com", "leader", "stn", "tacan", "alt", "task"] as const;
export const SUPPORT_ROW_KEYS = ["role", "type", "callsign", "com", "wpt", "tacan", "alt", "notes"] as const;
const DATA_KEYS = ["callsign", "task", "date", "time", "area", "server", "package", "weather"] as const;
const LOADOUT_KEYS = ["aa", "tanks", "ecm", "ag", "pods", "chfl", "notes"] as const;
const FUEL_KEYS = ["total", "target", "joker", "bingo", "altn"] as const;
const SPEC_KEYS = ["rotSpd", "alow", "msl", "stn"] as const;
const BULLSEYE_KEYS = ["name", "lat", "lon", "wpt"] as const;

const isString = (v: unknown): v is string => typeof v === "string";
const blank = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>;

export const emptyAirbase = (): Airbase => blank(AIRBASE_KEYS);
export const emptyStation = (): Station => blank(STATION_KEYS);
export const emptySupport = (): SupportUnit => blank(SUPPORT_KEYS);
export const emptyAirfield = (): Airfield => blank(AIRFIELD_KEYS);
export const emptySupportRow = (): SupportRow => blank(SUPPORT_ROW_KEYS);
export const emptyPackageMember = (): PackageMember => blank(PACKAGE_KEYS);
export const emptyWaypoint = (): Waypoint => blank(WAYPOINT_KEYS);

/** Terrain de la liste → ligne de la fiche (fréquence : UHF, sinon VHF). */
export function airfieldFromRef(a: Airbase): Airfield {
  return { ...emptyAirfield(), name: a.name, runway: a.runway, tacan: a.tacan, freq: a.uhf || a.vhf, elev: a.elev, ils: a.ils };
}

/** Appareil de la liste → ligne SUPPORT (fréquence : UHF, sinon VHF). */
export function supportFromRef(u: SupportUnit): SupportRow {
  return { ...emptySupportRow(), role: u.role, type: u.type, callsign: u.callsign, com: u.uhf || u.vhf, tacan: u.tacan, alt: u.alt, notes: u.notes };
}

export function emptyTacticalSheet(ramrod: string[] = []): TacticalSheet {
  return {
    version: 3,
    data: blank(DATA_KEYS),
    airfields: { dep: emptyAirfield(), arr: emptyAirfield(), alt: emptyAirfield() },
    flight: Array.from({ length: TACTICAL_ROWS.flight }, () => blank(FLIGHT_KEYS)),
    loadout: blank(LOADOUT_KEYS),
    fuel: blank(FUEL_KEYS),
    spec: blank(SPEC_KEYS),
    uhf: Array.from({ length: TACTICAL_ROWS.com }, emptyStation),
    vhf: Array.from({ length: TACTICAL_ROWS.com }, emptyStation),
    comNotes: "",
    spin: "",
    waypoints: Array.from({ length: TACTICAL_ROWS.waypoints }, emptyWaypoint),
    wptNotes: "",
    threatNotes: "",
    package: Array.from({ length: TACTICAL_ROWS.package }, emptyPackageMember),
    support: Array.from({ length: TACTICAL_ROWS.support }, emptySupportRow),
    bullseye: blank(BULLSEYE_KEYS),
    ramrod: Array.from({ length: 10 }, (_, i) => ramrod[i] ?? ""),
    rtba: [],
    gameplan: "",
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

/** Texte libre borné ; null si ce n'est pas du texte. */
function parseText(value: unknown, max: number = TACTICAL_LIMITS.text): string | null {
  if (value === undefined) return "";
  return isString(value) ? value.slice(0, max) : null;
}

const joinLines = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join("\n");

/**
 * Fiche tactique lue depuis la base. Les fiches des versions précédentes
 * sont converties (champs sans équivalent recopiés dans les notes).
 */
export function parseTacticalSheet(v: Record<string, unknown>): TacticalSheet | null {
  const ramrod = parseRamrod(v.ramrod);
  const rtba = parseRows(v.rtba, ["wp", "offset"] as const, TACTICAL_LIMITS.rtba);
  if (!ramrod || !rtba) return null;
  return v.version === 3 ? parseV3(v, ramrod, rtba) : parseLegacy(v, ramrod, rtba);
}

function parseV3(v: Record<string, unknown>, ramrod: string[], rtba: RtbaRow[]): TacticalSheet | null {
  const airfields = v.airfields as Record<string, unknown> | undefined;
  const parts = {
    data: parseRecord(v.data, DATA_KEYS),
    dep: parseRecord(airfields?.dep, AIRFIELD_KEYS),
    arr: parseRecord(airfields?.arr, AIRFIELD_KEYS),
    alt: parseRecord(airfields?.alt, AIRFIELD_KEYS),
    flight: parseRows(v.flight, FLIGHT_KEYS, TACTICAL_ROWS.flight),
    loadout: parseRecord(v.loadout, LOADOUT_KEYS),
    fuel: parseRecord(v.fuel, FUEL_KEYS),
    spec: parseRecord(v.spec, SPEC_KEYS),
    uhf: parseRows(v.uhf, STATION_KEYS, TACTICAL_LIMITS.com),
    vhf: parseRows(v.vhf, STATION_KEYS, TACTICAL_LIMITS.com),
    waypoints: parseRows(v.waypoints, WAYPOINT_KEYS, TACTICAL_LIMITS.waypoints),
    package: parseRows(v.package, PACKAGE_KEYS, TACTICAL_LIMITS.package),
    support: parseRows(v.support, SUPPORT_ROW_KEYS, TACTICAL_LIMITS.support),
    bullseye: parseRecord(v.bullseye, BULLSEYE_KEYS),
    comNotes: parseText(v.comNotes),
    spin: parseText(v.spin),
    wptNotes: parseText(v.wptNotes),
    threatNotes: parseText(v.threatNotes),
    gameplan: parseText(v.gameplan, TACTICAL_LIMITS.notes),
  };
  if (Object.values(parts).some((p) => p === null)) return null;
  const p = parts as { [K in keyof typeof parts]: NonNullable<(typeof parts)[K]> };
  const flight = [...p.flight];
  while (flight.length < TACTICAL_ROWS.flight) flight.push(blank(FLIGHT_KEYS));
  return {
    version: 3,
    data: p.data,
    airfields: { dep: p.dep, arr: p.arr, alt: p.alt },
    flight,
    loadout: p.loadout,
    fuel: p.fuel,
    spec: p.spec,
    uhf: p.uhf,
    vhf: p.vhf,
    comNotes: p.comNotes,
    spin: p.spin,
    waypoints: p.waypoints,
    wptNotes: p.wptNotes,
    threatNotes: p.threatNotes,
    package: p.package,
    support: p.support,
    bullseye: p.bullseye,
    ramrod,
    rtba,
    gameplan: p.gameplan,
  };
}

/** Fiches des versions 1 (navigation / fréquences / codes) et 2 (mission card simple). */
function parseLegacy(v: Record<string, unknown>, ramrod: string[], rtba: RtbaRow[]): TacticalSheet | null {
  const notes = parseText(v.notes, TACTICAL_LIMITS.notes);
  if (notes === null) return null;
  const sheet = emptyTacticalSheet(ramrod);
  sheet.rtba = rtba;

  if (!("header" in v)) {
    const legacy = [
      ...(parseRows(v.navaids, ["name", "tacan", "ils", "freq"] as const, 50) ?? []).map((r) =>
        [r.name, r.tacan && `TCN ${r.tacan}`, r.ils && `ILS ${r.ils}`, r.freq].filter(Boolean).join(" · "),
      ),
      ...(parseRows(v.freqs, ["name", "freq"] as const, 50) ?? []).map((r) => [r.name, r.freq].filter(Boolean).join(" · ")),
      ...(parseRows(v.codes, ["name", "code"] as const, 50) ?? []).map((r) => [r.name, r.code].filter(Boolean).join(" · ")),
    ];
    sheet.gameplan = joinLines(...legacy, notes).slice(0, TACTICAL_LIMITS.notes);
    return sheet;
  }

  // Version 2
  const header = parseRecord(v.header, ["callsign", "pri", "aux", "mission", "weather", "time"] as const);
  const v2Base = ["name", "tacan", "vhf", "uhf", "elev", "runway", "ils"] as const;
  const bases = v.airbases as Record<string, unknown> | undefined;
  const dep = parseRecord(bases?.dep, v2Base);
  const arr = parseRecord(bases?.arr, v2Base);
  const alt = parseRecord(bases?.alt, v2Base);
  const flight = parseRows(v.flight, ["pilot", "helmet", "tacan", "laser", "stn", "tail", "notes"] as const, TACTICAL_ROWS.flight);
  const loadout = parseRecord(v.loadout, ["aa", "ag", "pod", "tanks"] as const);
  const com1 = parseRows(v.com1, STATION_KEYS, TACTICAL_LIMITS.com);
  const com2 = parseRows(v.com2, STATION_KEYS, TACTICAL_LIMITS.com);
  const targets = parseRows(v.targets, ["type", "coords", "alt", "notes"] as const, TACTICAL_LIMITS.waypoints);
  const support = parseRows(v.support, SUPPORT_KEYS, TACTICAL_LIMITS.support);
  if (!header || !dep || !arr || !alt || !flight || !loadout || !com1 || !com2 || !targets || !support) return null;

  sheet.data = { ...sheet.data, callsign: header.callsign, task: header.mission, time: header.time, weather: header.weather };
  sheet.airfields = { dep: airfieldFromRef(dep), arr: airfieldFromRef(arr), alt: airfieldFromRef(alt) };
  sheet.flight = flight.map((m) => ({ ...blank(FLIGHT_KEYS), crew: m.pilot, helmet: m.helmet, tacan: m.tacan, laser: m.laser, serial: m.tail }));
  while (sheet.flight.length < TACTICAL_ROWS.flight) sheet.flight.push(blank(FLIGHT_KEYS));
  sheet.loadout = { ...sheet.loadout, aa: loadout.aa, ag: loadout.ag, pods: loadout.pod, tanks: loadout.tanks };
  sheet.uhf = com1;
  sheet.vhf = com2;
  sheet.comNotes = joinLines(header.pri && `PRI ${header.pri}`, header.aux && `AUX ${header.aux}`);
  sheet.waypoints = targets.map((t, i) => ({ n: t.type || t.coords ? String(i + 1) : "", name: t.type, coords: t.coords, alt: t.alt }));
  sheet.wptNotes = joinLines(...targets.map((t) => t.notes));
  sheet.support = support.map(supportFromRef);
  sheet.gameplan = notes;
  return sheet;
}

/** Espaces superflus retirés, lignes RTBA vides supprimées (avant rendu / enregistrement). */
export function cleanTacticalSheet(s: TacticalSheet): TacticalSheet {
  const trim = <T extends Record<string, string>>(row: T): T =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v.trim()])) as T;
  return {
    version: 3,
    data: trim(s.data),
    airfields: { dep: trim(s.airfields.dep), arr: trim(s.airfields.arr), alt: trim(s.airfields.alt) },
    flight: withWingmenTacan(s.flight.map(trim)),
    loadout: trim(s.loadout),
    fuel: trim(s.fuel),
    spec: trim(s.spec),
    uhf: s.uhf.map(trim),
    vhf: s.vhf.map(trim),
    comNotes: s.comNotes.trim(),
    spin: s.spin.trim(),
    waypoints: s.waypoints.map(trim),
    wptNotes: s.wptNotes.trim(),
    threatNotes: s.threatNotes.trim(),
    package: s.package.map(trim),
    support: s.support.map(trim),
    bullseye: trim(s.bullseye),
    ramrod: s.ramrod.map((c) => c.trim()),
    rtba: s.rtba.map(trim).filter((r) => r.wp || r.offset),
    gameplan: s.gameplan.trim(),
  };
}

/** Listes enregistrées : terrains, stations radio et support de l'escadron. */
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
