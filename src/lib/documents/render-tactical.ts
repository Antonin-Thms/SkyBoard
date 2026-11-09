"use client";

/**
 * Rendu de la fiche tactique (A4 portrait), dans le style des « mission
 * cards » d'escadron : bandeaux de section à gauche, en-têtes sombres,
 * grille serrée, lignes vides à remplir au crayon. Continue sur une page
 * suivante si les notes de vol (RAMROD, RTBA, notes) ne tiennent pas.
 */

import { fmt } from "@/lib/i18n/define";
import { drawRamrod, INK, newPage, PAGE, toFile, wrap } from "./generate";
import { isBlank, type Airbase, type Station, type TacticalSheet } from "./tactical";

/** Textes de la fiche (abréviations aéro communes + quelques mots traduits). */
export interface TacticalLabels {
  /** Titre des pages suivantes, gabarit avec {title} */
  continued: string;
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
  slot: string;
  waypoint: string;
}

const SIDE = 34;
const TOP = 34;
const BAND = 46;
const X0 = SIDE + BAND;
const WIDTH = PAGE.width - SIDE - X0;
const ROW = 42;
const GAP = 10;
const BOTTOM = PAGE.height - 34;

const COLORS = {
  band: "#3b3b3b",
  head: "#4a4a4a",
  label: "#d9d9d9",
  blue: "#dbe7f4",
  purple: "#e6dcf2",
  green: "#dcefd6",
  line: "#2a2a2a",
};

interface Cell {
  text?: string;
  /** Largeur, en fraction de la grille */
  w: number;
  fill?: string;
  kind?: "head" | "label" | "value" | "name";
  align?: "left" | "center";
}

/** Une ligne de cellules (texte ajusté à la largeur), haut à `y` ; `left` / `span` : partie de la grille. */
function row(ctx: CanvasRenderingContext2D, y: number, cells: Cell[], height = ROW, left = X0, span = WIDTH) {
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
      ctx.font =
        kind === "head"
          ? "700 20px sans-serif"
          : kind === "label"
            ? "700 22px sans-serif"
            : kind === "name"
              ? "500 24px sans-serif"
              : "700 26px sans-serif";
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
function band(ctx: CanvasRenderingContext2D, y: number, height: number, text: string) {
  ctx.fillStyle = COLORS.band;
  ctx.fillRect(SIDE, y, BAND - 4, height);
  ctx.save();
  ctx.translate(SIDE + (BAND - 4) / 2, y + height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toLocaleUpperCase(), 0, 1, height - 12);
  ctx.restore();
}

export async function renderTactical(title: string, s: TacticalSheet, l: TacticalLabels): Promise<File[]> {
  const pages: HTMLCanvasElement[] = [];
  let page = newPage();
  let y = TOP;

  const ensure = (height: number) => {
    if (y + height <= BOTTOM) return;
    pages.push(page.canvas);
    page = newPage();
    const { ctx } = page;
    ctx.fillStyle = INK;
    ctx.font = "600 40px sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(fmt(l.continued, { title }), SIDE, TOP + 36, PAGE.width - 2 * SIDE);
    ctx.fillRect(SIDE, TOP + 56, PAGE.width - 2 * SIDE, 3);
    y = TOP + 84;
  };

  /** Section : bandeau + lignes (hauteur connue d'avance, pas coupée entre deux pages). */
  const section = (name: string | null, rows: Cell[][]) => {
    const height = rows.length * ROW;
    ensure(height);
    const { ctx } = page;
    if (name) band(ctx, y, height, name);
    rows.forEach((cells, i) => row(ctx, y + i * ROW, cells));
    y += height + GAP;
  };

  // Une section entièrement vide n'apparaît pas sur la planche.
  // 1. Mission
  const h = s.header;
  if (!isBlank(h)) section("Mission", [
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
    [
      { text: l.weather, w: 0.13, kind: "label" },
      { text: h.weather, w: 0.51 },
      { text: l.time, w: 0.13, kind: "label" },
      { text: h.time, w: 0.23, align: "center" },
    ],
  ]);

  // 2. Terrains
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
  if (!isBlank(s.airbases.dep, s.airbases.arr, s.airbases.alt)) section(l.sectionAirbase, [
    ["", l.base, "TCN", "VHF", "UHF", "ELEV.", l.runway, "ILS"].map((text, i) => ({ text, w: AB[i], kind: "head" as const })),
    airbaseRow(l.roles[0], s.airbases.dep, COLORS.blue),
    airbaseRow(l.roles[1], s.airbases.arr, COLORS.blue),
    airbaseRow(l.roles[2], s.airbases.alt, COLORS.green),
  ]);

  // 3. Patrouille
  const FL = [0.05, 0.18, 0.1, 0.08, 0.08, 0.09, 0.12, 0.3];
  if (!isBlank(...s.flight)) section(l.sectionFlight, [
    ["#", l.pilot, l.helmet, "TCN", "LSR", "STN", "TAIL #", l.notes].map((text, i) => ({ text, w: FL[i], kind: "head" as const })),
    ...s.flight.map((m, i): Cell[] => [
      { text: String(i + 1), w: FL[0], kind: "label" },
      { text: m.pilot, w: FL[1] },
      { text: m.helmet, w: FL[2], align: "center" },
      { text: m.tacan, w: FL[3], align: "center" },
      { text: m.laser, w: FL[4], align: "center" },
      { text: m.stn, w: FL[5], align: "center" },
      { text: m.tail, w: FL[6], align: "center" },
      { text: m.notes, w: FL[7], kind: "name" },
    ]),
  ]);

  // 4. Emports
  const lo = s.loadout;
  if (!isBlank(lo)) section(l.sectionLoadout, [
    [{ text: l.configuration, w: 1, kind: "head" }],
    ...(
      [
        ["A/A", lo.aa],
        ["A/G", lo.ag],
        ["POD", lo.pod],
        ["TANKS", lo.tanks],
      ] as const
    ).map(([label, value]): Cell[] => [
      { text: label, w: 0.12, kind: "label" },
      { text: value, w: 0.88, align: "center" },
    ]),
  ]);

  // 5. Radios : COM1 (PRI) et COM2 (AUX) côte à côte
  const CM = [0.08, 0.16, 0.26];
  const comCells = (st: Station, fill: string): Cell[] => [
    { text: st.code, w: CM[0], kind: "label", fill },
    { text: st.freq, w: CM[1], align: "center" },
    { text: st.name, w: CM[2], align: "center" },
  ];
  // Autant de lignes que la plus longue des deux colonnes.
  const comRows = Math.max(s.com1.length, s.com2.length);
  const blankStation: Station = { code: "", name: "", freq: "" };
  if (!isBlank(...s.com1, ...s.com2)) section(l.sectionCom, [
    [
      { text: l.com1, w: 0.5, kind: "head" },
      { text: l.com2, w: 0.5, kind: "head" },
    ],
    [l.channel, l.freq, l.name, l.channel, l.freq, l.name].map((text, i) => ({
      text,
      w: CM[i % 3],
      kind: "label" as const,
    })),
    ...Array.from({ length: comRows }, (_, i): Cell[] => [
      ...comCells(s.com1[i] ?? blankStation, COLORS.blue),
      ...comCells(s.com2[i] ?? blankStation, COLORS.green),
    ]),
  ]);

  // 6. Objectifs
  const TG = [0.05, 0.17, 0.36, 0.12, 0.3];
  if (!isBlank(...s.targets)) section(l.sectionTargets, [
    ["N°", l.type, l.coords, l.alt, l.threats].map((text, i) => ({ text, w: TG[i], kind: "head" as const })),
    ...s.targets.map((t, i): Cell[] => [
      { text: String(i + 1), w: TG[0], kind: "label" },
      { text: t.type, w: TG[1] },
      { text: t.coords, w: TG[2], align: "center" },
      { text: t.alt, w: TG[3], align: "center" },
      { text: t.notes, w: TG[4], kind: "name" },
    ]),
  ]);

  // 7. Support : ravitailleurs, AWACS, GCI…
  const SP = [0.07, 0.15, 0.15, 0.13, 0.1, 0.08, 0.1, 0.22];
  if (!isBlank(...s.support)) section(l.sectionSupport, [
    [l.role, l.acType, "CALLSIGN", "UHF", "VHF", "TCN", "ALT", l.notes].map((text, i) => ({ text, w: SP[i], kind: "head" as const })),
    ...s.support.map((u): Cell[] => [
      { text: u.role, w: SP[0], kind: "label", fill: COLORS.purple },
      { text: u.type, w: SP[1], fill: COLORS.purple, align: "center" },
      { text: u.callsign, w: SP[2], fill: COLORS.purple, align: "center" },
      { text: u.uhf, w: SP[3], align: "center" },
      { text: u.vhf, w: SP[4], align: "center" },
      { text: u.tacan, w: SP[5], align: "center" },
      { text: u.alt, w: SP[6], align: "center" },
      { text: u.notes, w: SP[7], kind: "name" },
    ]),
  ]);

  // 8. Notes de vol : RTBA et notes côte à côte, puis RAMROD (chaque bloc seulement s'il est rempli).
  const half = (WIDTH - GAP) / 2;
  const RT = [0.4, 0.26, 0.34];
  const rtbaHeight = s.rtba.length ? (s.rtba.length + 2) * ROW : 0;
  const notesWidth = s.rtba.length ? half : WIDTH;
  page.ctx.font = "500 26px sans-serif";
  const lines = s.notes
    ? s.notes.split(/\r?\n/).flatMap((line) => (line.trim() ? wrap(page.ctx, line, notesWidth - 24) : [""]))
    : [];
  const lineHeight = 34;
  const notesHeight = lines.length ? lines.length * lineHeight + 16 : 0;
  const topRowHeight = Math.max(rtbaHeight, notesHeight);
  const ramrodHeight = s.ramrod.some(Boolean) ? 60 + 96 : 0;

  const drawRtba = (ctx: CanvasRenderingContext2D, top: number, width: number) => {
    row(ctx, top, [{ text: l.slot, w: 0.4, kind: "label" }, { text: "", w: 0.6 }], ROW, X0, width);
    row(
      ctx,
      top + ROW,
      ["RTBA · " + l.waypoint, "T+", "TOT"].map((text, i) => ({ text, w: RT[i], kind: "head" as const })),
      ROW,
      X0,
      width,
    );
    s.rtba.forEach((r, i) =>
      row(
        ctx,
        top + (i + 2) * ROW,
        [
          { text: r.wp, w: RT[0] },
          { text: r.offset, w: RT[1], align: "center" },
          { text: "", w: RT[2] },
        ],
        ROW,
        X0,
        width,
      ),
    );
  };
  const drawNotes = (ctx: CanvasRenderingContext2D, top: number, left: number, width: number, height: number) => {
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, width, height);
    ctx.fillStyle = INK;
    ctx.font = "500 26px sans-serif";
    ctx.textBaseline = "alphabetic";
    lines.forEach((line, i) => ctx.fillText(line, left + 12, top + 8 + (i + 1) * lineHeight - 8));
  };

  const blocks: { height: number; draw: (ctx: CanvasRenderingContext2D, top: number) => void }[] = [];
  if (topRowHeight) {
    blocks.push({
      height: topRowHeight,
      draw: (ctx, top) => {
        if (s.rtba.length) drawRtba(ctx, top, lines.length ? half : WIDTH);
        if (lines.length) {
          const left = s.rtba.length ? X0 + half + GAP : X0;
          drawNotes(ctx, top, left, notesWidth, topRowHeight);
        }
      },
    });
  }
  if (ramrodHeight) {
    blocks.push({ height: ramrodHeight, draw: (ctx, top) => void drawRamrod(ctx, top, s.ramrod, X0, WIDTH, 60, 96) });
  }
  // Un seul bandeau par page pour l'ensemble des blocs posés dessus.
  let bandTop = -1;
  const closeBand = () => {
    if (bandTop >= 0) band(page.ctx, bandTop, y - GAP - bandTop, l.sectionFlightNotes);
    bandTop = -1;
  };
  for (const block of blocks) {
    if (y + block.height > BOTTOM) {
      closeBand();
      ensure(block.height);
    }
    if (bandTop < 0) bandTop = y;
    block.draw(page.ctx, y);
    y += block.height + GAP;
  }
  closeBand();

  pages.push(page.canvas);
  return Promise.all(
    pages.map((canvas, i) => toFile(canvas, pages.length > 1 ? `${title} (${i + 1}-${pages.length})` : title)),
  );
}
