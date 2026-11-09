"use client";

/**
 * Rendu de la fiche tactique (A4 portrait), dans le style des « mission
 * cards » d'escadron : bandeaux de section à gauche, en-têtes sombres,
 * grille serrée. Seules les lignes remplies sont affichées, et la fiche tient
 * toujours sur une seule page : tout est mis à l'échelle (réduit si le
 * contenu est long, un peu agrandi s'il est court, pour la lecture en VR).
 */

import type { Dictionary } from "@/lib/i18n/dictionary";
import { drawRamrod, INK, newPage, PAGE, toFile, wrap } from "./generate";
import { isBlank, type Airbase, type Station, type TacticalSheet } from "./tactical";

/** Textes de la fiche (abréviations aéro communes + quelques mots traduits). */
export interface TacticalLabels {
  weather: string;
  time: string;
  sectionAirbase: string;
  base: string;
  runway: string;
  roles: [dep: string, arr: string, alt: string];
  sectionFlight: string;
  pilot: string;
  helmet: string;
  notes: string;
  sectionLoadout: string;
  configuration: string;
  sectionCom: string;
  com1: string;
  com2: string;
  channel: string;
  freq: string;
  name: string;
  sectionTargets: string;
  type: string;
  coords: string;
  alt: string;
  threats: string;
  sectionSupport: string;
  role: string;
  acType: string;
  sectionFlightNotes: string;
  waypoint: string;
}

/** Textes de la fiche, depuis le dictionnaire de la langue de l'interface. */
export function tacticalLabels(t: Dictionary["documents"]["create"]): TacticalLabels {
  return {
    weather: t.weather,
    time: t.timeZ,
    sectionAirbase: t.sectionAirbase,
    base: t.colBase,
    runway: t.colRunway,
    roles: ["DEP", "ARR", "ALTN"],
    sectionFlight: t.sectionFlight,
    pilot: t.colPilot,
    helmet: t.colHelmet,
    notes: t.colNotes,
    sectionLoadout: t.sectionLoadout,
    configuration: t.configuration,
    sectionCom: t.sectionCom,
    com1: "COM1 (PRI)",
    com2: "COM2 (AUX)",
    channel: t.colChannel,
    freq: t.colFreq,
    name: t.colName,
    sectionTargets: t.sectionTargets,
    type: t.colType,
    coords: t.colCoords,
    alt: t.colAlt,
    threats: t.colThreats,
    sectionSupport: t.sectionSupport,
    role: t.colRole,
    acType: t.colAcType,
    sectionFlightNotes: t.sectionFlightNotes,
    waypoint: t.colWaypoint,
  };
}

const SIDE = 34;
const TOP = 34;
const BAND = 46;
const X0 = SIDE + BAND;
const WIDTH = PAGE.width - SIDE - X0;
const BOTTOM = PAGE.height - 34;
/** Hauteur d'une ligne et écart entre sections, à l'échelle 1. */
const ROW = 42;
const GAP = 10;
/** Échelle maximale (fiche courte) et minimale (au-delà, le texte devient illisible). */
const MAX_SCALE = 1.3;
const MIN_SCALE = 0.45;

const COLORS = {
  band: "#3b3b3b",
  head: "#4a4a4a",
  label: "#d9d9d9",
  blue: "#cfe0f3",
  purple: "#e2d6f2",
  green: "#d3ebc8",
  amber: "#f6d58e",
  line: "#2a2a2a",
};

/**
 * Couleur d'une station radio, d'après son nom (comme le COMPLAN du MANEX) :
 * garde, contrôle, ravitailleurs / AWACS, porte-avions, GCI, JTAC,
 * fréquences d'escadron ; les autres (TACTICAL…) restent blanches.
 */
const STATION_COLORS: [RegExp, string][] = [
  [/garde|guard/i, "#ecc5e6"],
  [/jtac/i, "#f2b3a6"],
  [/particuli|escadron|squadron/i, "#fbe3a0"],
  [/nanny|airboss|marshall|lso|cvn/i, "#d9cdf0"],
  [/loneship|crc|gci/i, "#c6e5b8"],
  [/twr|tower|radar|app|gnd|atis/i, "#bcd5ee"],
  [/shell|texaco|arco|magic|awacs|darkstar|wizard|overlord/i, "#d6e6f7"],
];
export function stationColor(name: string): string | undefined {
  return STATION_COLORS.find(([re]) => re.test(name))?.[1];
}

interface Cell {
  text?: string;
  /** Largeur, en fraction de la grille */
  w: number;
  fill?: string;
  kind?: "head" | "label" | "value" | "name";
  align?: "left" | "center";
}

/** Une ligne de cellules (texte ajusté à la largeur), haut à `y` ; `left` / `span` : partie de la grille. */
function row(ctx: CanvasRenderingContext2D, y: number, cells: Cell[], k: number, left = X0, span = WIDTH) {
  const height = ROW * k;
  let x = left;
  for (const cell of cells) {
    const w = cell.w * span;
    const kind = cell.kind ?? "value";
    const fill = cell.fill ?? (kind === "head" ? COLORS.head : kind === "label" ? COLORS.label : "#ffffff");
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, height);
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, height);
    if (cell.text) {
      ctx.fillStyle = kind === "head" ? "#ffffff" : INK;
      const [weight, size] =
        kind === "head" ? [700, 20] : kind === "label" ? [700, 22] : kind === "name" ? [500, 24] : [700, 26];
      ctx.font = `${weight} ${Math.round(size * k)}px sans-serif`;
      ctx.textBaseline = "middle";
      const align = cell.align ?? (kind === "head" || kind === "label" ? "center" : "left");
      ctx.textAlign = align;
      const tx = align === "center" ? x + w / 2 : x + 10;
      ctx.fillText(cell.text, tx, y + height / 2 + 1, w - 16);
    }
    x += w;
  }
  ctx.textAlign = "left";
}

/** Bandeau vertical de section (texte tourné), à gauche de la grille. */
function band(ctx: CanvasRenderingContext2D, y: number, height: number, text: string, k: number) {
  ctx.fillStyle = COLORS.band;
  ctx.fillRect(SIDE, y, BAND - 4, height);
  ctx.save();
  ctx.translate(SIDE + (BAND - 4) / 2, y + height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(Math.min(20, 20 * k))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toLocaleUpperCase(), 0, 1, height - 12);
  ctx.restore();
}

/** Bloc posé sur la page : hauteur à l'échelle k, et son dessin. */
interface Block {
  name: string;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, top: number) => void;
}

const filled = (r: Record<string, string>) => !isBlank(r);

/** Sections de la fiche à l'échelle k (sections et lignes vides omises). */
function layout(ctx: CanvasRenderingContext2D, s: TacticalSheet, l: TacticalLabels, k: number): Block[] {
  const blocks: Block[] = [];
  const rowsBlock = (name: string, rows: Cell[][]) =>
    blocks.push({
      name,
      height: rows.length * ROW * k,
      draw: (c, top) => rows.forEach((cells, i) => row(c, top + i * ROW * k, cells, k)),
    });

  // 1. Mission (ligne météo / heure seulement si l'une est remplie)
  const h = s.header;
  if (filled(h)) {
    const rows: Cell[][] = [
      [
        { text: "CALLSIGN", w: 0.3, kind: "head" },
        { text: "PRI", w: 0.17, kind: "head" },
        { text: "AUX", w: 0.17, kind: "head" },
        { text: "MISSION", w: 0.36, kind: "head" },
      ],
      [
        { text: h.callsign, w: 0.3, align: "center" },
        { text: h.pri, w: 0.17, align: "center" },
        { text: h.aux, w: 0.17, align: "center" },
        { text: h.mission, w: 0.36, align: "center" },
      ],
    ];
    if (h.weather || h.time) {
      rows.push([
        { text: l.weather, w: 0.13, kind: "label" },
        { text: h.weather, w: 0.51 },
        { text: l.time, w: 0.13, kind: "label" },
        { text: h.time, w: 0.23, align: "center" },
      ]);
    }
    rowsBlock("Mission", rows);
  }

  // 2. Terrains : seulement les lignes DEP / ARR / ALTN remplies
  const AB = [0.08, 0.17, 0.1, 0.12, 0.12, 0.1, 0.12, 0.19];
  const airbaseRow = (role: string, a: Airbase, fill: string): Cell[] => [
    { text: role, w: AB[0], kind: "label", fill },
    { text: a.name, w: AB[1], fill, align: "center" },
    { text: a.tacan, w: AB[2], fill, align: "center" },
    { text: a.vhf, w: AB[3], fill, align: "center" },
    { text: a.uhf, w: AB[4], fill, align: "center" },
    { text: a.elev, w: AB[5], fill, align: "center" },
    { text: a.runway, w: AB[6], fill, align: "center" },
    { text: a.ils, w: AB[7], fill, align: "center" },
  ];
  const bases = (
    [
      [l.roles[0], s.airbases.dep, COLORS.blue],
      [l.roles[1], s.airbases.arr, COLORS.blue],
      [l.roles[2], s.airbases.alt, COLORS.green],
    ] as const
  ).filter(([, a]) => filled(a));
  if (bases.length) {
    rowsBlock(l.sectionAirbase, [
      ["", l.base, "TCN", "VHF", "UHF", "ELEV.", l.runway, "ILS"].map((text, i) => ({ text, w: AB[i], kind: "head" as const })),
      ...bases.map(([role, a, fill]) => airbaseRow(role, a, fill)),
    ]);
  }

  // 3. Patrouille : lignes remplies (numéro d'origine conservé)
  const FL = [0.05, 0.18, 0.1, 0.08, 0.08, 0.09, 0.12, 0.3];
  const flight = s.flight.map((m, i) => ({ m, n: i + 1 })).filter(({ m }) => filled(m));
  if (flight.length) {
    rowsBlock(l.sectionFlight, [
      ["#", l.pilot, l.helmet, "TCN", "LSR", "STN", "TAIL #", l.notes].map((text, i) => ({ text, w: FL[i], kind: "head" as const })),
      ...flight.map(({ m, n }): Cell[] => [
        { text: String(n), w: FL[0], kind: "label" },
        { text: m.pilot, w: FL[1] },
        { text: m.helmet, w: FL[2], align: "center" },
        { text: m.tacan, w: FL[3], align: "center" },
        { text: m.laser, w: FL[4], align: "center" },
        { text: m.stn, w: FL[5], align: "center" },
        { text: m.tail, w: FL[6], align: "center" },
        { text: m.notes, w: FL[7], kind: "name" },
      ]),
    ]);
  }

  // 4. Emports : lignes remplies, deux par rangée
  const lo = s.loadout;
  const loads = (
    [
      ["A/A", lo.aa],
      ["A/G", lo.ag],
      ["POD", lo.pod],
      ["TANKS", lo.tanks],
    ] as const
  ).filter(([, v]) => v);
  if (loads.length) {
    const pairs: Cell[][] = [];
    for (let i = 0; i < loads.length; i += 2) {
      const cells: Cell[] = [];
      for (const [label, value] of loads.slice(i, i + 2)) {
        cells.push({ text: label, w: 0.1, kind: "label" }, { text: value, w: 0.4, align: "center" });
      }
      if (cells.length === 2) cells.push({ text: "", w: 0.5 });
      pairs.push(cells);
    }
    rowsBlock(l.sectionLoadout, [[{ text: l.configuration, w: 1, kind: "head" }], ...pairs]);
  }

  // 5. Radios : COM1 (PRI) et COM2 (AUX) côte à côte, lignes remplies
  const CM = [0.08, 0.16, 0.26];
  const blankStation: Station = { code: "", name: "", freq: "" };
  // Ligne colorée selon la station ; canal toujours teinté (bleu COM1, vert COM2).
  const comCells = (st: Station, base: string): Cell[] => {
    const fill = stationColor(st.name);
    return [
      { text: st.code, w: CM[0], kind: "label", fill: fill ?? base },
      { text: st.freq, w: CM[1], align: "center", fill },
      { text: st.name, w: CM[2], align: "center", fill },
    ];
  };
  const com1 = s.com1.filter(filled);
  const com2 = s.com2.filter(filled);
  const comRows = Math.max(com1.length, com2.length);
  if (comRows) {
    rowsBlock(l.sectionCom, [
      [
        { text: l.com1, w: 0.5, kind: "head" },
        { text: l.com2, w: 0.5, kind: "head" },
      ],
      [l.channel, l.freq, l.name, l.channel, l.freq, l.name].map((text, i) => ({ text, w: CM[i % 3], kind: "label" as const })),
      ...Array.from({ length: comRows }, (_, i): Cell[] => [
        ...comCells(com1[i] ?? blankStation, COLORS.blue),
        ...comCells(com2[i] ?? blankStation, COLORS.green),
      ]),
    ]);
  }

  // 6. Objectifs
  const TG = [0.05, 0.17, 0.36, 0.12, 0.3];
  const targets = s.targets.filter(filled);
  if (targets.length) {
    rowsBlock(l.sectionTargets, [
      ["N°", l.type, l.coords, l.alt, l.threats].map((text, i) => ({ text, w: TG[i], kind: "head" as const })),
      ...targets.map((t, i): Cell[] => [
        { text: String(i + 1), w: TG[0], kind: "label" },
        { text: t.type, w: TG[1] },
        { text: t.coords, w: TG[2], align: "center" },
        { text: t.alt, w: TG[3], align: "center" },
        { text: t.notes, w: TG[4], kind: "name" },
      ]),
    ]);
  }

  // 7. Support : ravitailleurs, AWACS, GCI…
  const SP = [0.07, 0.15, 0.15, 0.13, 0.1, 0.08, 0.1, 0.22];
  const support = s.support.filter(filled);
  if (support.length) {
    rowsBlock(l.sectionSupport, [
      [l.role, l.acType, "CALLSIGN", "UHF", "VHF", "TCN", "ALT", l.notes].map((text, i) => ({ text, w: SP[i], kind: "head" as const })),
      ...support.map((u): Cell[] => [
        { text: u.role, w: SP[0], kind: "label", fill: COLORS.purple },
        { text: u.type, w: SP[1], fill: COLORS.purple, align: "center" },
        { text: u.callsign, w: SP[2], fill: COLORS.purple, align: "center" },
        { text: u.uhf, w: SP[3], align: "center", fill: "#f1ebf9" },
        { text: u.vhf, w: SP[4], align: "center", fill: "#f1ebf9" },
        { text: u.tacan, w: SP[5], align: "center", fill: "#f1ebf9" },
        { text: u.alt, w: SP[6], align: "center", fill: "#f1ebf9" },
        { text: u.notes, w: SP[7], kind: "name", fill: "#f1ebf9" },
      ]),
    ]);
  }

  // 8. Notes de vol : RTBA et notes côte à côte, puis RAMROD (même bandeau)
  const half = (WIDTH - GAP) / 2;
  const RT = [0.4, 0.26, 0.34];
  const notesWidth = s.rtba.length ? half : WIDTH;
  const notesFont = `500 ${Math.round(26 * k)}px sans-serif`;
  ctx.font = notesFont;
  const lines = s.notes
    ? s.notes.split(/\r?\n/).flatMap((line) => (line.trim() ? wrap(ctx, line, notesWidth - 24) : [""]))
    : [];
  const lineHeight = 34 * k;
  const rtbaHeight = s.rtba.length ? (s.rtba.length + 1) * ROW * k : 0;
  const notesHeight = lines.length ? lines.length * lineHeight + 16 * k : 0;
  const topHeight = Math.max(rtbaHeight, notesHeight);
  if (topHeight) {
    blocks.push({
      name: l.sectionFlightNotes,
      height: topHeight,
      draw: (c, top) => {
        if (s.rtba.length) {
          const width = lines.length ? half : WIDTH;
          row(c, top, ["RTBA · " + l.waypoint, "T+", "TOT"].map((text, i) => ({ text, w: RT[i], kind: "head" as const })), k, X0, width);
          s.rtba.forEach((r, i) =>
            row(
              c,
              top + (i + 1) * ROW * k,
              [
                { text: r.wp, w: RT[0], fill: "#fdf1d6" },
                { text: r.offset, w: RT[1], align: "center", fill: "#fdf1d6" },
                { text: "", w: RT[2] },
              ],
              k,
              X0,
              width,
            ),
          );
        }
        if (lines.length) {
          const left = s.rtba.length ? X0 + half + GAP : X0;
          c.strokeStyle = COLORS.line;
          c.lineWidth = 2;
          c.strokeRect(left, top, notesWidth, topHeight);
          c.fillStyle = INK;
          c.font = notesFont;
          c.textBaseline = "alphabetic";
          lines.forEach((line, i) => c.fillText(line, left + 12, top + (i + 1) * lineHeight));
        }
      },
    });
  }
  if (s.ramrod.some(Boolean)) {
    blocks.push({
      name: l.sectionFlightNotes,
      height: (60 + 96) * k,
      draw: (c, top) => void drawRamrod(c, top, s.ramrod, X0, WIDTH, 60 * k, 96 * k, "dark"),
    });
  }
  return blocks;
}

const totalHeight = (blocks: Block[]) => blocks.reduce((sum, b) => sum + b.height, 0) + GAP * Math.max(0, blocks.length - 1);

export async function renderTactical(
  title: string,
  s: TacticalSheet,
  l: TacticalLabels,
  /** Résolution (1 = 150 dpi, 2 = 300 dpi) */
  scale = 1,
): Promise<File[]> {
  const { canvas, ctx } = newPage(scale);
  const available = BOTTOM - TOP;

  // Échelle : la plus grande (≤ MAX_SCALE) qui fait tout tenir sur la page.
  let k = MAX_SCALE;
  let blocks = layout(ctx, s, l, k);
  for (let i = 0; i < 6 && totalHeight(blocks) > available && k > MIN_SCALE; i++) {
    k = Math.max(MIN_SCALE, k * (available / totalHeight(blocks)) * 0.995);
    blocks = layout(ctx, s, l, k);
  }

  // Blocs consécutifs d'une même section (notes de vol) : un seul bandeau.
  let y = TOP;
  let bandTop = y;
  blocks.forEach((block, i) => {
    block.draw(ctx, y);
    const next = blocks[i + 1];
    if (!next || next.name !== block.name) {
      band(ctx, bandTop, y + block.height - bandTop, block.name, k);
      bandTop = y + block.height + GAP;
    }
    y += block.height + GAP;
  });

  return [await toFile(canvas, title)];
}
