"use client";

/**
 * Rendu de la fiche tactique (A4 portrait), au format de la fiche Excel de
 * l'escadron : bandeaux de section à gauche, en-têtes gris foncé, lignes
 * colorées (DEP bleu, ARR rose, ALT vert, numéros de patrouille, carburant,
 * THREAT NOTES rouge…). Seules les sections et lignes remplies sont
 * affichées, et la fiche tient toujours sur une seule page : tout est mis à
 * l'échelle (réduit si le contenu est long, agrandi s'il est court).
 */

import { INK, newPage, PAGE, toFile, wrap } from "./generate";
import {
  emptyPackageMember,
  emptySupportRow,
  isBlank,
  type Airfield,
  type Station,
  type TacticalSheet,
} from "./tactical";

const SIDE = 30;
const TOP = 30;
const BAND = 44;
const X0 = SIDE + BAND;
const WIDTH = PAGE.width - SIDE - X0;
const BOTTOM = PAGE.height - 30;
/** Hauteur d'une ligne et écart entre sections, à l'échelle 1. */
const ROW = 40;
const GAP = 8;
/** Échelle maximale (fiche courte) et minimale (au-delà, le texte devient illisible). */
const MAX_SCALE = 1.3;
const MIN_SCALE = 0.45;

/** Couleurs de la fiche Excel de l'escadron. */
const C = {
  band: "#404040",
  head: "#404040",
  label: "#d9d9d9",
  zebra: "#efefef",
  line: "#262626",
  dep: "#dce6f1",
  arr: "#f2dcdb",
  alt: "#d8e4bc",
  fuelTotal: "#d8e4bc",
  fuelTarget: "#fff2cc",
  joker: "#fcd5b4",
  bingo: "#f2c4c4",
  threat: "#ff0000",
  red: "#c00000",
  blue: "#0070c0",
  flight: ["#92d050", "#ffc000", "#00b0f0", "#b1a0c7"],
};

interface Cell {
  text?: string;
  /** Largeur, en fraction de la grille */
  w: number;
  fill?: string;
  /** Couleur du texte */
  color?: string;
  kind?: "head" | "label" | "value" | "name";
  align?: "left" | "center";
}

/** Police d'une cellule (graisse, taille à l'échelle 1). */
const FONT: Record<NonNullable<Cell["kind"]>, [number, number]> = {
  head: [700, 19],
  label: [700, 20],
  name: [500, 22],
  value: [700, 23],
};
const PAD = 14;

/** Largeur du texte d'une cellule à sa taille nominale (échelle k). */
function measure(ctx: CanvasRenderingContext2D, text: string | undefined, kind: Cell["kind"], k: number): number {
  if (!text) return 0;
  const [weight, size] = FONT[kind ?? "value"];
  ctx.font = `${weight} ${Math.round(size * k)}px sans-serif`;
  return ctx.measureText(text).width;
}

/**
 * Texte d'une cellule sans jamais l'écraser : taille nominale si ça tient,
 * sinon sur deux lignes si la cellule est assez haute, sinon police réduite.
 */
function cellText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: NonNullable<Cell["kind"]>,
  k: number,
  align: "left" | "center",
) {
  const [weight, base] = FONT[kind];
  const room = w - PAD;
  const font = (px: number) => (ctx.font = `${weight} ${Math.round(px)}px sans-serif`);
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  const tx = align === "center" ? x + w / 2 : x + 8 * k;
  let size = base * k;
  font(size);
  const full = ctx.measureText(text).width;
  if (full <= room) return void ctx.fillText(text, tx, y + h / 2 + 1);
  // Un peu trop long : police légèrement réduite plutôt qu'une coupure.
  if (full * 0.85 <= room) {
    font(size * (room / full));
    return void ctx.fillText(text, tx, y + h / 2 + 1);
  }
  // Deux lignes, si la hauteur le permet (coupure aux espaces).
  for (let px = size; px >= base * k * 0.62; px -= 1) {
    if (2 * px * 1.08 > h - 6) continue;
    font(px);
    const lines = wrap(ctx, text, room);
    if (lines.length === 2 && lines.every((l) => ctx.measureText(l).width <= room)) {
      lines.forEach((l, i) => ctx.fillText(l, tx, y + h / 2 + (i - 0.5) * px * 1.08 + 1));
      return;
    }
  }
  // Une ligne, police réduite à la largeur (jamais compressée).
  size = Math.max(8, size * (room / full));
  font(size);
  ctx.fillText(text, tx, y + h / 2 + 1, room);
}

/** Une ligne de cellules de hauteur `rh` (× `rows`), haut à `y` ; `left` / `span` : partie de la grille. */
function row(
  ctx: CanvasRenderingContext2D,
  y: number,
  cells: Cell[],
  k: number,
  rh: number,
  left = X0,
  span = WIDTH,
  rows = 1,
) {
  const height = rh * rows;
  let x = left;
  for (const cell of cells) {
    const w = cell.w * span;
    const kind = cell.kind ?? "value";
    ctx.fillStyle = cell.fill ?? (kind === "head" ? C.head : kind === "label" ? C.label : "#ffffff");
    ctx.fillRect(x, y, w, height);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, height);
    if (cell.text) {
      ctx.fillStyle = cell.color ?? (kind === "head" ? "#ffffff" : INK);
      cellText(ctx, cell.text, x, y, w, height, kind, k, cell.align ?? "center");
    }
    x += w;
  }
  ctx.textAlign = "left";
}

/**
 * Largeurs de colonnes (fractions de `span`, total 1) d'après le contenu :
 * chaque colonne reçoit au moins la place de son texte le plus long, le
 * reste est réparti selon les proportions de base ; si tout ne tient pas,
 * les colonnes sont réduites en proportion de leur besoin.
 */
function fitColumns(
  ctx: CanvasRenderingContext2D,
  base: number[],
  rows: Cell[][],
  k: number,
  span = WIDTH,
): number[] {
  const need = base.map(() => 0);
  for (const cells of rows) {
    if (cells.length !== base.length) continue;
    cells.forEach((c, i) => {
      if (c.text) need[i] = Math.max(need[i], (measure(ctx, c.text, c.kind, k) + PAD + 4) / span);
    });
  }
  const baseSum = base.reduce((a, b) => a + b, 0);
  // Colonne vide : garde un peu de place pour écrire au stylo.
  base.forEach((b, i) => (need[i] = Math.max(need[i], (b / baseSum) * 0.4)));
  const total = need.reduce((a, b) => a + b, 0);
  if (total > 1) {
    // Trop large : les colonnes courtes gardent leur place, seules les plus
    // longues sont limitées (même plafond pour toutes) et passent sur deux lignes.
    let lo = 0;
    let hi = Math.max(...need);
    for (let i = 0; i < 30; i++) {
      const cap = (lo + hi) / 2;
      if (need.reduce((sum, n) => sum + Math.min(n, cap), 0) > 1) hi = cap;
      else lo = cap;
    }
    const w = need.map((n) => Math.min(n, lo));
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / sum);
  }
  // Place restante : d'abord pour rapprocher chaque colonne de sa largeur de base.
  const w = [...need];
  let extra = 1 - total;
  const deficit = base.map((b, i) => Math.max(0, b / baseSum - w[i]));
  const defSum = deficit.reduce((a, b) => a + b, 0);
  if (defSum > 0) {
    const give = Math.min(extra, defSum);
    deficit.forEach((d, i) => (w[i] += (d / defSum) * give));
    extra -= give;
  }
  if (extra > 0) base.forEach((b, i) => (w[i] += (b / baseSum) * extra));
  return w;
}

/** Applique des largeurs aux lignes de même structure (les autres sont laissées telles quelles). */
function withWidths(rows: Cell[][], widths: number[]): Cell[][] {
  return rows.map((cells) => (cells.length === widths.length ? cells.map((c, i) => ({ ...c, w: widths[i] })) : cells));
}

/** Bloc de texte libre (notes) : cadre + lignes, centré ou aligné à gauche. */
function textBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lines: string[],
  k: number,
  align: "left" | "center",
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  const lh = 30 * k;
  ctx.fillStyle = INK;
  ctx.font = `500 ${Math.round(22 * k)}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  const top = align === "center" ? y + (h - lines.length * lh) / 2 : y + 8 * k;
  lines.forEach((line, i) => ctx.fillText(line, align === "center" ? x + w / 2 : x + 10 * k, top + (i + 0.5) * lh, w - 16));
  ctx.textAlign = "left";
}

/** Lignes d'un texte libre, coupées à la largeur `w` (police des notes). */
function textLines(ctx: CanvasRenderingContext2D, text: string, w: number, k: number): string[] {
  if (!text) return [];
  ctx.font = `500 ${Math.round(22 * k)}px sans-serif`;
  return text.split(/\r?\n/).flatMap((line) => (line.trim() ? wrap(ctx, line, w - 20) : [""]));
}

/** Nombre de lignes de grille (hauteur `rh`) nécessaires pour un texte de `lines` lignes. */
const rowsFor = (lines: number, k: number, rh: number) => (lines ? Math.ceil((lines * 30 * k + 16 * k) / rh) : 0);

/** Bandeau vertical de section (texte tourné), à gauche de la grille. */
function band(ctx: CanvasRenderingContext2D, y: number, height: number, text: string, k: number) {
  ctx.fillStyle = C.band;
  ctx.fillRect(SIDE, y, BAND - 4, height);
  ctx.save();
  ctx.translate(SIDE + (BAND - 4) / 2, y + height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  const label = text.toLocaleUpperCase();
  let size = Math.min(19, 19 * k);
  ctx.font = `700 ${Math.round(size)}px sans-serif`;
  const width = ctx.measureText(label).width;
  // Bandeau court : police réduite (jamais compressée).
  if (width > height - 10) {
    size = Math.max(8, size * ((height - 10) / width));
    ctx.font = `700 ${Math.round(size)}px sans-serif`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

/** Section posée sur la page : hauteur à l'échelle k, et son dessin. */
interface Block {
  name: string;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, top: number) => void;
}

const filled = (r: Record<string, string>) => !isBlank(r);
const blankRows = <T,>(n: number, row: T): T[] => Array.from({ length: n }, () => row);
const head = (labels: string[], widths: number[]): Cell[] => labels.map((text, i) => ({ text, w: widths[i], kind: "head" }));
const zebra = (i: number) => (i % 2 ? C.zebra : undefined);
/** Couleur du nom de package (BLUE en bleu, RED en rouge). */
const sideColor = (v: string) => (/blue|bleu/i.test(v) ? C.blue : /red|rouge/i.test(v) ? C.red : undefined);

/** Sections de la fiche, dans l'ordre de la page. */
const SECTIONS = ["Data", "Airfields", "Flight", "Loadout", "Radio", "Waypoints", "Package", "Support", "Admin", "Gameplan"];
/** Lignes vierges d'une section vide affichée pour remplir la page. */
const BLANK_ROWS = 2;

/**
 * Sections de la fiche : texte à l'échelle k, lignes de hauteur `rh`.
 * Les sections vides sont omises, sauf celles de `blank`, affichées vierges
 * (à remplir au stylo) ; `extra` : hauteur ajoutée au GAMEPLAN pour finir la page.
 */
function layout(
  ctx: CanvasRenderingContext2D,
  s: TacticalSheet,
  k: number,
  rh: number,
  blank: ReadonlySet<string> = new Set(),
  extra = 0,
): Block[] {
  const blocks: Block[] = [];
  const shown = (name: string, used: boolean) => used || blank.has(name);
  const line = (c: CanvasRenderingContext2D, y: number, cells: Cell[], left?: number, span?: number, rows?: number) =>
    row(c, y, cells, k, rh, left, span, rows);
  /** Tableau : colonnes ajustées au contenu (lignes de même structure que `base`). */
  const grid = (name: string, rows: Cell[][], base?: number[]) => {
    const fitted = base ? withWidths(rows, fitColumns(ctx, base, rows, k)) : rows;
    blocks.push({
      name,
      height: fitted.length * rh,
      draw: (c, top) => fitted.forEach((cells, i) => line(c, top + i * rh, cells)),
    });
  };

  // DATA
  const d = s.data;
  if (shown("Data", filled(d))) {
    const DW = [0.17, 0.15, 0.13, 0.11, 0.14, 0.14, 0.16];
    const rows: Cell[][] = [
      head(["CALLSIGN", "TASK", "DATE", "TIME", "AREA", "SERVER", "PACKAGE"], DW),
      [d.callsign, d.task, d.date, d.time, d.area, d.server, d.package].map((text, i) => ({
        text,
        w: DW[i],
        color: i === 6 ? sideColor(text) : undefined,
      })),
    ];
    if (d.weather) rows.push([{ text: "WEATHER", w: 0.1, kind: "label" }, { text: d.weather, w: 0.9, align: "left", kind: "name" }]);
    grid("Data", rows, DW);
  }

  // AIRFIELDS : DEP bleu, ARR rose, ALT vert
  const AF = [0.07, 0.14, 0.1, 0.08, 0.07, 0.1, 0.1, 0.17, 0.17];
  const roles = [
    ["DEP", s.airfields.dep, C.dep],
    ["ARR", s.airfields.arr, C.arr],
    ["ALT", s.airfields.alt, C.alt],
  ] as const;
  const used = roles.filter(([, a]) => filled(a)).length;
  if (shown("Airfields", used > 0)) {
    // Section vierge : les trois rôles.
    const fields = used ? roles.filter(([, a]) => filled(a)) : roles;
    const fieldRow = (role: string, a: Airfield, fill: string): Cell[] => [
      { text: role, w: AF[0], kind: "label", fill },
      ...[a.name, a.runway, a.tacan, a.wpt, a.freq, a.elev, a.procedure, a.ils].map((text, i) => ({ text, w: AF[i + 1], fill })),
    ];
    const data = fields.map(([role, a, fill]) => fieldRow(role, a, fill));
    const titles = ["RWY", "TCN", "WPT", "FREQ", "ELEV", "PROCEDURE", "ILS"];
    // Largeurs d'après le contenu (en-têtes compris : « AIRFIELDS » couvre rôle + nom).
    const W = fitColumns(ctx, AF, [[{ text: "", w: 0 }, { text: "AIRFIELDS", w: 0, kind: "head" }, ...head(titles, AF.slice(2))], ...data], k);
    grid("Airfields", [
      [{ text: "AIRFIELDS", w: W[0] + W[1], kind: "head" }, ...head(titles, W.slice(2))],
      ...withWidths(data, W),
    ]);
  }

  // FLIGHT : numéro coloré, sanctuaire en rouge
  const FL = [0.04, 0.13, 0.07, 0.09, 0.09, 0.09, 0.1, 0.08, 0.14, 0.17];
  const members = s.flight.map((m, i) => ({ m, i }));
  const flightUsed = members.filter(({ m }) => filled(m)).length;
  if (shown("Flight", flightUsed > 0)) {
    const flight = flightUsed ? members.filter(({ m }) => filled(m)) : members.slice(0, BLANK_ROWS);
    grid("Flight", [
      head(["#", "CREW", "TYPE", "HELMET", "TCN", "SQWK", "SNCTRY", "LSR", "SERIAL", "LIVERY"], FL),
      ...flight.map(({ m, i }, r): Cell[] => [
        { text: String(i + 1), w: FL[0], kind: "label", fill: C.flight[i] },
        ...[m.crew, m.type, m.helmet, m.tacan, m.sqwk, m.sanctuary, m.laser, m.serial, m.livery].map((text, j) => ({
          text,
          w: FL[j + 1],
          fill: zebra(r),
          color: j === 5 ? C.red : undefined,
        })),
      ]),
    ], FL);
  }

  // LOADOUT : configuration par avion (numéro coloré comme FLIGHT), puis carburant et spec
  const fu = s.fuel;
  const sp = s.spec;
  const allLoads = s.loadout.map((l, i) => ({ l, i }));
  const loadUsed = allLoads.some(({ l }) => filled(l)) || filled(fu) || filled(sp);
  const loadBlank = !loadUsed && blank.has("Loadout");
  // Section vierge : une ligne par avion de la patrouille (au moins deux), carburant et spec.
  const loads = loadBlank
    ? allLoads.slice(0, Math.max(BLANK_ROWS, flightUsed))
    : allLoads.filter(({ l }) => filled(l));
  if (loadUsed || loadBlank) {
    const rows: Cell[][] = [];
    /** Ajoute une ligne (ou un tableau) aux colonnes ajustées à son propre contenu. */
    const fit = (base: number[], part: Cell[][]) => rows.push(...withWidths(part, fitColumns(ctx, base, part, k)));
    if (loads.length) {
      const LW = [0.04, 0.11, 0.11, 0.06, 0.07, 0.22, 0.13, 0.12, 0.14];
      fit(LW, [
        head(["#", "CREW", "A/A", "TANKS", "ECM POD", "A/G", "PODS", "CH/FL", "NOTES"], LW),
        ...loads.map(({ l, i }, r): Cell[] => [
          { text: String(i + 1), w: LW[0], kind: "label", fill: C.flight[i] },
          { text: s.flight[i]?.crew, w: LW[1], fill: zebra(r) },
          ...[l.aa, l.tanks, l.ecm, l.ag, l.pods, l.chfl, l.notes].map((text, j) => ({
            text,
            w: LW[j + 2],
            fill: zebra(r),
            kind: j === 6 ? ("name" as const) : ("value" as const),
          })),
        ]),
      ]);
    }
    // Carburant et spec : une rangée chacun (titre de rangée à gauche), si remplis.
    const L = (text: string, w: number): Cell => ({ text, w, kind: "label" });
    const V = (text: string, w: number, fill?: string): Cell => ({ text, w, fill });
    const cells = (row: Cell[]) => fit(row.map((c) => c.w), [row]);
    if (filled(fu) || loadBlank) {
      cells([
        { text: "FUEL", w: 0.1, kind: "head" },
        L("TOTAL", 0.08),
        V(fu.total, 0.1, C.fuelTotal),
        L("TARGET", 0.08),
        V(fu.target, 0.1, C.fuelTarget),
        L("JOKER", 0.08),
        V(fu.joker, 0.1, C.joker),
        L("BINGO", 0.08),
        V(fu.bingo, 0.1, C.bingo),
        L("ALTN FUEL", 0.1),
        V(fu.altn, 0.08),
      ]);
    }
    if (filled(sp) || loadBlank) {
      cells([
        { text: "SPEC", w: 0.1, kind: "head" },
        L("ROT SPD", 0.1),
        V(sp.rotSpd, 0.125),
        L("ALOW", 0.1),
        V(sp.alow, 0.125),
        L("MSL", 0.1),
        V(sp.msl, 0.125),
        L("STN", 0.1),
        V(sp.stn, 0.125),
      ]);
    }
    grid("Loadout", rows);
  }

  // RADIO : UHF, VHF, COM NOTES, SPIN (colonnes de notes vides : place rendue aux fréquences)
  const uhf = s.uhf.filter(filled);
  const vhf = s.vhf.filter(filled);
  const radioUsed = uhf.length > 0 || vhf.length > 0 || !!s.comNotes.trim() || !!s.spin.trim();
  const radioBlank = !radioUsed && blank.has("Radio");
  const comW = s.comNotes.trim() || radioBlank ? 0.25 : 0;
  const spinW = s.spin.trim() || radioBlank ? 0.15 : 0;
  const comLines = comW ? textLines(ctx, s.comNotes, comW * WIDTH, k) : [];
  const spinLines = spinW ? textLines(ctx, s.spin, spinW * WIDTH, k) : [];
  if (radioUsed || radioBlank) {
    const n = Math.max(
      uhf.length,
      vhf.length,
      rowsFor(comLines.length, k, rh),
      rowsFor(spinLines.length, k, rh),
      radioBlank ? BLANK_ROWS + 1 : 1,
    );
    const none: Station = { code: "", name: "", freq: "" };
    const freqW = 1 - comW - spinW;
    const stationCells = (st: Station, r: number, w = [0.1, 0.16, 0.24]): Cell[] => [
      { text: st.code, w: w[0], fill: zebra(r) },
      { text: st.freq, w: w[1], fill: zebra(r) },
      { text: st.name, w: w[2], fill: zebra(r), kind: "name" },
    ];
    const pair = (i: number, w?: number[]) => [
      ...stationCells(uhf[i] ?? none, i, w?.slice(0, 3)),
      ...stationCells(vhf[i] ?? none, i, w?.slice(3)),
    ];
    // Colonnes canal / fréquence / nom des deux blocs ajustées au contenu.
    const ST = fitColumns(
      ctx,
      [0.1, 0.16, 0.24, 0.1, 0.16, 0.24],
      Array.from({ length: n }, (_, i) => pair(i)),
      k,
      freqW * WIDTH,
    ).map((x) => x * freqW);
    const titles = [
      { text: "UHF", w: ST[0] + ST[1] + ST[2], kind: "head" as const },
      { text: "VHF", w: ST[3] + ST[4] + ST[5], kind: "head" as const },
      ...(comW ? [{ text: "COM NOTES", w: comW, kind: "head" as const }] : []),
      ...(spinW ? [{ text: "SPIN", w: spinW, kind: "head" as const }] : []),
    ];
    blocks.push({
      name: "Radio",
      height: (n + 1) * rh,
      draw: (c, top) => {
        line(c, top, titles);
        for (let i = 0; i < n; i++) {
          line(c, top + (i + 1) * rh, pair(i, ST));
        }
        const y = top + rh;
        const h = n * rh;
        if (comW) textBox(c, X0 + freqW * WIDTH, y, comW * WIDTH, h, comLines, k, "left");
        if (spinW) textBox(c, X0 + (freqW + comW) * WIDTH, y, spinW * WIDTH, h, spinLines, k, "left");
      },
    });
  }

  // WAYPOINTS : notes et menaces (en-tête rouge), colonnes de notes masquées si vides
  const wps = s.waypoints.filter(filled);
  const wpUsed = wps.length > 0 || !!s.wptNotes.trim() || !!s.threatNotes.trim();
  const wpBlank = !wpUsed && blank.has("Waypoints");
  const wptW = s.wptNotes.trim() || wpBlank ? 0.2 : 0;
  const threatW = s.threatNotes.trim() || wpBlank ? 0.25 : 0;
  const wptLines = wptW ? textLines(ctx, s.wptNotes, wptW * WIDTH, k) : [];
  const threatLines = threatW ? textLines(ctx, s.threatNotes, threatW * WIDTH, k) : [];
  if (wpUsed || wpBlank) {
    const n = Math.max(
      wps.length,
      rowsFor(wptLines.length, k, rh),
      rowsFor(threatLines.length, k, rh),
      wpBlank ? BLANK_ROWS + 1 : 1,
    );
    const tableW = 1 - wptW - threatW;
    const wpCells = (i: number, w = [0.09, 0.29, 0.44, 0.18]): Cell[] => {
      const p = wps[i];
      return [
        { text: p ? p.n || String(i + 1) : "", w: w[0], kind: "label" },
        { text: p?.name, w: w[1], fill: zebra(i) },
        { text: p?.coords, w: w[2], fill: zebra(i) },
        { text: p?.alt, w: w[3], fill: zebra(i) },
      ];
    };
    const headCells = (w: number[]) => head(["N°", "NAME", "COORDINATES", "ALTITUDE"], w);
    const WP = fitColumns(
      ctx,
      [0.09, 0.29, 0.44, 0.18],
      [headCells([0, 0, 0, 0]), ...wps.map((_, i) => wpCells(i))],
      k,
      tableW * WIDTH,
    ).map((x) => x * tableW);
    blocks.push({
      name: "Waypoints",
      height: (n + 1) * rh,
      draw: (c, top) => {
        line(c, top, [
          ...headCells(WP),
          ...(wptW ? head(["WPT NOTES"], [wptW]) : []),
          ...(threatW ? [{ text: "THREAT NOTES", w: threatW, kind: "head" as const, fill: C.threat }] : []),
        ]);
        for (let i = 0; i < n; i++) line(c, top + (i + 1) * rh, wpCells(i, WP));
        const y = top + rh;
        const h = n * rh;
        if (wptW) textBox(c, X0 + tableW * WIDTH, y, wptW * WIDTH, h, wptLines, k, "center");
        if (threatW) textBox(c, X0 + (tableW + wptW) * WIDTH, y, threatW * WIDTH, h, threatLines, k, "center");
      },
    });
  }

  // RTBA : waypoints minutés (TOT calculés sur la planche RTBA)
  if (s.rtba.length) {
    const RT = [0.4, 0.25, 0.35];
    grid("RTBA", [
      head(["WAYPOINT", "T+", "TOT"], RT),
      ...s.rtba.map((r, i): Cell[] => [
        { text: r.wp, w: RT[0], fill: zebra(i) },
        { text: r.offset, w: RT[1], fill: zebra(i) },
        { text: "", w: RT[2], fill: zebra(i) },
      ]),
    ], RT);
  }

  // PACKAGE
  const pkg = s.package.filter(filled);
  if (shown("Package", pkg.length > 0)) {
    const PK = [0.16, 0.1, 0.1, 0.13, 0.1, 0.1, 0.1, 0.21];
    grid("Package", [
      head(["CALLSIGN", "TYPE", "COM", "LEADER", "STN", "TCN", "ALT", "TASK"], PK),
      ...(pkg.length ? pkg : blankRows(BLANK_ROWS, emptyPackageMember())).map((p, i): Cell[] =>
        [p.callsign, p.type, p.com, p.leader, p.stn, p.tacan, p.alt, p.task].map((text, j) => ({ text, w: PK[j], fill: zebra(i) })),
      ),
    ], PK);
  }

  // SUPPORT
  const sup = s.support.filter(filled);
  if (shown("Support", sup.length > 0)) {
    const SP = [0.11, 0.12, 0.15, 0.12, 0.08, 0.1, 0.1, 0.22];
    grid("Support", [
      head(["ROLE", "TYPE", "CALLSIGN", "COM", "WPT", "TCN", "ALT", "NOTES"], SP),
      ...(sup.length ? sup : blankRows(BLANK_ROWS, emptySupportRow())).map((u, i): Cell[] =>
        [u.role, u.type, u.callsign, u.com, u.wpt, u.tacan, u.alt, u.notes].map((text, j) => ({
          text,
          w: SP[j],
          fill: zebra(i),
          kind: j === 7 ? "name" : "value",
        })),
      ),
    ], SP);
  }

  // ADMIN : bullseye et RAMROD (« / » dans les cases vides)
  const be = s.bullseye;
  if (shown("Admin", filled(be) || s.ramrod.some(Boolean))) {
    blocks.push({
      name: "Admin",
      height: 3 * rh,
      draw: (c, top) => {
        const BE = [0.14, 0.1, 0.1, 0.08];
        line(c, top, [{ text: "BULLSEYE", w: 0.42, kind: "head" }]);
        line(c, top + rh, [be.name, be.lat, be.lon, be.wpt].map((text, i) => ({ text, w: BE[i] })), X0, WIDTH, 2);
        const left = X0 + 0.45 * WIDTH;
        const span = 0.55 * WIDTH;
        line(c, top, [{ text: "RAMROD", w: 1, kind: "head" }], left, span);
        line(c, top + rh, Array.from({ length: 10 }, (_, i) => ({ text: String(i), w: 0.1 })), left, span);
        line(c, top + 2 * rh, s.ramrod.map((ch) => ({ text: ch || "/", w: 0.1 })), left, span);
      },
    });
  }

  // GAMEPLAN
  const plan = textLines(ctx, s.gameplan, WIDTH, k);
  if (shown("Gameplan", plan.length > 0)) {
    const height = Math.max(2, rowsFor(plan.length, k, rh)) * rh + extra;
    blocks.push({
      name: "Gameplan",
      height,
      draw: (c, top) => textBox(c, X0, top, WIDTH, height, plan, k, "left"),
    });
  }
  return blocks;
}

const totalHeight = (blocks: Block[]) => blocks.reduce((sum, b) => sum + b.height, 0) + GAP * Math.max(0, blocks.length - 1);

export async function renderTactical(
  title: string,
  s: TacticalSheet,
  /** Résolution (1 = 150 dpi, 2 = 300 dpi) */
  scale = 1,
): Promise<File[]> {
  const { canvas, ctx } = newPage(scale);
  const available = BOTTOM - TOP;

  // Échelle du texte : la plus grande (≤ MAX_SCALE) qui fait tout tenir sur la page.
  let k = MAX_SCALE;
  let blocks = layout(ctx, s, k, ROW * k);
  for (let i = 0; i < 6 && totalHeight(blocks) > available && k > MIN_SCALE; i++) {
    k = Math.max(MIN_SCALE, k * (available / totalHeight(blocks)) * 0.995);
    blocks = layout(ctx, s, k, ROW * k);
  }
  // Place libre : sections vides affichées vierges (à remplir au stylo), dans
  // l'ordre de la page, tant qu'elles tiennent ; le GAMEPLAN prend le reste.
  let rh = ROW * k;
  const blank = new Set<string>();
  const present = new Set(blocks.map((b) => b.name));
  // GAMEPLAN d'abord (il occupe le bas de la page), puis les autres dans l'ordre.
  for (const name of ["Gameplan", ...SECTIONS]) {
    if (present.has(name) || blank.has(name)) continue;
    blank.add(name);
    if (totalHeight(layout(ctx, s, k, rh, blank)) > available) blank.delete(name);
  }
  blocks = layout(ctx, s, k, rh, blank);
  const rest = available - totalHeight(blocks);
  if (blocks.some((b) => b.name === "Gameplan")) {
    blocks = layout(ctx, s, k, rh, blank, Math.max(0, rest));
  } else {
    // Pas la place pour un GAMEPLAN : le reste (moins de deux lignes) est réparti.
    for (let i = 0; i < 4; i++) {
      const gap = available - totalHeight(blocks);
      if (Math.abs(gap) <= 1) break;
      const rows = (totalHeight(blocks) - GAP * Math.max(0, blocks.length - 1)) / rh;
      rh = Math.max(ROW * k * 0.5, rh + gap / rows);
      blocks = layout(ctx, s, k, rh, blank);
    }
  }

  let y = TOP;
  for (const block of blocks) {
    band(ctx, y, block.height, block.name, k);
    block.draw(ctx, y);
    y += block.height + GAP;
  }
  return [await toFile(canvas, title)];
}
