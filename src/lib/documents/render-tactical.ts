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
import { isBlank, type Airfield, type Station, type TacticalSheet } from "./tactical";

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

/** Une ligne de cellules (texte ajusté à la largeur), haut à `y` ; `left` / `span` : partie de la grille. */
function row(ctx: CanvasRenderingContext2D, y: number, cells: Cell[], k: number, left = X0, span = WIDTH, rows = 1) {
  const height = ROW * k * rows;
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
      const [weight, size] =
        kind === "head" ? [700, 19] : kind === "label" ? [700, 20] : kind === "name" ? [500, 22] : [700, 23];
      ctx.font = `${weight} ${Math.round(size * k)}px sans-serif`;
      ctx.textBaseline = "middle";
      const align = cell.align ?? "center";
      ctx.textAlign = align;
      const tx = align === "center" ? x + w / 2 : x + 8 * k;
      ctx.fillText(cell.text, tx, y + height / 2 + 1, w - 12);
    }
    x += w;
  }
  ctx.textAlign = "left";
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

/** Nombre de lignes de grille nécessaires pour un texte de `lines` lignes. */
const rowsFor = (lines: number, k: number) => (lines ? Math.ceil((lines * 30 * k + 16 * k) / (ROW * k)) : 0);

/** Bandeau vertical de section (texte tourné), à gauche de la grille. */
function band(ctx: CanvasRenderingContext2D, y: number, height: number, text: string, k: number) {
  ctx.fillStyle = C.band;
  ctx.fillRect(SIDE, y, BAND - 4, height);
  ctx.save();
  ctx.translate(SIDE + (BAND - 4) / 2, y + height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(Math.min(19, 19 * k))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toLocaleUpperCase(), 0, 1, height - 10);
  ctx.restore();
}

/** Section posée sur la page : hauteur à l'échelle k, et son dessin. */
interface Block {
  name: string;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, top: number) => void;
}

const filled = (r: Record<string, string>) => !isBlank(r);
const head = (labels: string[], widths: number[]): Cell[] => labels.map((text, i) => ({ text, w: widths[i], kind: "head" }));
const zebra = (i: number) => (i % 2 ? C.zebra : undefined);
/** Couleur du nom de package (BLUE en bleu, RED en rouge). */
const sideColor = (v: string) => (/blue|bleu/i.test(v) ? C.blue : /red|rouge/i.test(v) ? C.red : undefined);

/** Sections de la fiche à l'échelle k (sections et lignes vides omises). */
function layout(ctx: CanvasRenderingContext2D, s: TacticalSheet, k: number): Block[] {
  const blocks: Block[] = [];
  const grid = (name: string, rows: Cell[][]) =>
    blocks.push({
      name,
      height: rows.length * ROW * k,
      draw: (c, top) => rows.forEach((cells, i) => row(c, top + i * ROW * k, cells, k)),
    });

  // DATA
  const d = s.data;
  if (filled(d)) {
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
    grid("Data", rows);
  }

  // AIRFIELDS : DEP bleu, ARR rose, ALT vert
  const AF = [0.07, 0.14, 0.1, 0.08, 0.07, 0.1, 0.1, 0.17, 0.17];
  const fields = (
    [
      ["DEP", s.airfields.dep, C.dep],
      ["ARR", s.airfields.arr, C.arr],
      ["ALT", s.airfields.alt, C.alt],
    ] as const
  ).filter(([, a]) => filled(a));
  if (fields.length) {
    const fieldRow = (role: string, a: Airfield, fill: string): Cell[] => [
      { text: role, w: AF[0], kind: "label", fill },
      ...[a.name, a.runway, a.tacan, a.wpt, a.freq, a.elev, a.procedure, a.ils].map((text, i) => ({ text, w: AF[i + 1], fill })),
    ];
    grid("Airfields", [
      [{ text: "AIRFIELDS", w: AF[0] + AF[1], kind: "head" }, ...head(["RWY", "TCN", "WPT", "FREQ", "ELEV", "PROCEDURE", "ILS"], AF.slice(2))],
      ...fields.map(([role, a, fill]) => fieldRow(role, a, fill)),
    ]);
  }

  // FLIGHT : numéro coloré, sanctuaire en rouge
  const FL = [0.04, 0.13, 0.07, 0.09, 0.09, 0.09, 0.1, 0.08, 0.14, 0.17];
  const flight = s.flight.map((m, i) => ({ m, i })).filter(({ m }) => filled(m));
  if (flight.length) {
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
    ]);
  }

  // LOADOUT : configuration par avion (numéro coloré comme FLIGHT), puis carburant et spec
  const loads = s.loadout.map((l, i) => ({ l, i })).filter(({ l }) => filled(l));
  const fu = s.fuel;
  const sp = s.spec;
  if (loads.length || filled(fu) || filled(sp)) {
    const rows: Cell[][] = [];
    if (loads.length) {
      const LW = [0.04, 0.11, 0.11, 0.06, 0.07, 0.22, 0.13, 0.12, 0.14];
      rows.push(head(["#", "CREW", "A/A", "TANKS", "ECM POD", "A/G", "PODS", "CH/FL", "NOTES"], LW));
      loads.forEach(({ l, i }, r) =>
        rows.push([
          { text: String(i + 1), w: LW[0], kind: "label", fill: C.flight[i] },
          { text: s.flight[i]?.crew, w: LW[1], fill: zebra(r) },
          ...[l.aa, l.tanks, l.ecm, l.ag, l.pods, l.chfl, l.notes].map((text, j) => ({
            text,
            w: LW[j + 2],
            fill: zebra(r),
            kind: j === 6 ? ("name" as const) : ("value" as const),
          })),
        ]),
      );
    }
    // Carburant et spec : une rangée chacun (titre de rangée à gauche), si remplis.
    const L = (text: string, w: number): Cell => ({ text, w, kind: "label" });
    const V = (text: string, w: number, fill?: string): Cell => ({ text, w, fill });
    if (filled(fu)) {
      rows.push([
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
    if (filled(sp)) {
      rows.push([
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

  // RADIO : UHF, VHF, COM NOTES, SPIN
  const uhf = s.uhf.filter(filled);
  const vhf = s.vhf.filter(filled);
  const comLines = textLines(ctx, s.comNotes, 0.25 * WIDTH, k);
  const spinLines = textLines(ctx, s.spin, 0.15 * WIDTH, k);
  if (uhf.length || vhf.length || comLines.length || spinLines.length) {
    const n = Math.max(uhf.length, vhf.length, rowsFor(comLines.length, k), rowsFor(spinLines.length, k), 1);
    const none: Station = { code: "", name: "", freq: "" };
    const ST = [0.06, 0.1, 0.14];
    const stationCells = (st: Station, r: number): Cell[] => [
      { text: st.code, w: ST[0], fill: zebra(r) },
      { text: st.freq, w: ST[1], fill: zebra(r) },
      { text: st.name, w: ST[2], fill: zebra(r) },
    ];
    blocks.push({
      name: "Radio",
      height: (n + 1) * ROW * k,
      draw: (c, top) => {
        row(c, top, head(["UHF", "VHF", "COM NOTES", "SPIN"], [0.3, 0.3, 0.25, 0.15]), k);
        for (let i = 0; i < n; i++) {
          row(c, top + (i + 1) * ROW * k, [...stationCells(uhf[i] ?? none, i), ...stationCells(vhf[i] ?? none, i)], k);
        }
        const y = top + ROW * k;
        const h = n * ROW * k;
        textBox(c, X0 + 0.6 * WIDTH, y, 0.25 * WIDTH, h, comLines, k, "left");
        textBox(c, X0 + 0.85 * WIDTH, y, 0.15 * WIDTH, h, spinLines, k, "left");
      },
    });
  }

  // WAYPOINTS : notes et menaces (en-tête rouge)
  const wps = s.waypoints.filter(filled);
  const wptLines = textLines(ctx, s.wptNotes, 0.2 * WIDTH, k);
  const threatLines = textLines(ctx, s.threatNotes, 0.25 * WIDTH, k);
  if (wps.length || wptLines.length || threatLines.length) {
    const n = Math.max(wps.length, rowsFor(wptLines.length, k), rowsFor(threatLines.length, k), 1);
    const WP = [0.05, 0.16, 0.24, 0.1];
    blocks.push({
      name: "Waypoints",
      height: (n + 1) * ROW * k,
      draw: (c, top) => {
        row(
          c,
          top,
          [
            ...head(["N°", "NAME", "COORDINATES", "ALTITUDE", "WPT NOTES"], [...WP, 0.2]),
            { text: "THREAT NOTES", w: 0.25, kind: "head", fill: C.threat },
          ],
          k,
        );
        for (let i = 0; i < n; i++) {
          const w = wps[i];
          row(
            c,
            top + (i + 1) * ROW * k,
            [
              { text: w ? w.n || String(i + 1) : "", w: WP[0], kind: "label" },
              { text: w?.name, w: WP[1], fill: zebra(i) },
              { text: w?.coords, w: WP[2], fill: zebra(i) },
              { text: w?.alt, w: WP[3], fill: zebra(i) },
            ],
            k,
          );
        }
        const y = top + ROW * k;
        const h = n * ROW * k;
        textBox(c, X0 + 0.55 * WIDTH, y, 0.2 * WIDTH, h, wptLines, k, "center");
        textBox(c, X0 + 0.75 * WIDTH, y, 0.25 * WIDTH, h, threatLines, k, "center");
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
    ]);
  }

  // PACKAGE
  const pkg = s.package.filter(filled);
  if (pkg.length) {
    const PK = [0.16, 0.1, 0.1, 0.13, 0.1, 0.1, 0.1, 0.21];
    grid("Package", [
      head(["CALLSIGN", "TYPE", "COM", "LEADER", "STN", "TCN", "ALT", "TASK"], PK),
      ...pkg.map((p, i): Cell[] =>
        [p.callsign, p.type, p.com, p.leader, p.stn, p.tacan, p.alt, p.task].map((text, j) => ({ text, w: PK[j], fill: zebra(i) })),
      ),
    ]);
  }

  // SUPPORT
  const sup = s.support.filter(filled);
  if (sup.length) {
    const SP = [0.11, 0.12, 0.15, 0.12, 0.08, 0.1, 0.1, 0.22];
    grid("Support", [
      head(["ROLE", "TYPE", "CALLSIGN", "COM", "WPT", "TCN", "ALT", "NOTES"], SP),
      ...sup.map((u, i): Cell[] =>
        [u.role, u.type, u.callsign, u.com, u.wpt, u.tacan, u.alt, u.notes].map((text, j) => ({
          text,
          w: SP[j],
          fill: zebra(i),
          kind: j === 7 ? "name" : "value",
        })),
      ),
    ]);
  }

  // ADMIN : bullseye et RAMROD (« / » dans les cases vides)
  const be = s.bullseye;
  if (filled(be) || s.ramrod.some(Boolean)) {
    blocks.push({
      name: "Admin",
      height: 3 * ROW * k,
      draw: (c, top) => {
        const BE = [0.14, 0.1, 0.1, 0.08];
        row(c, top, [{ text: "BULLSEYE", w: 0.42, kind: "head" }], k);
        row(c, top + ROW * k, [be.name, be.lat, be.lon, be.wpt].map((text, i) => ({ text, w: BE[i] })), k, X0, WIDTH, 2);
        const left = X0 + 0.45 * WIDTH;
        const span = 0.55 * WIDTH;
        row(c, top, [{ text: "RAMROD", w: 1, kind: "head" }], k, left, span);
        row(c, top + ROW * k, Array.from({ length: 10 }, (_, i) => ({ text: String(i), w: 0.1 })), k, left, span);
        row(c, top + 2 * ROW * k, s.ramrod.map((ch) => ({ text: ch || "/", w: 0.1 })), k, left, span);
      },
    });
  }

  // GAMEPLAN
  const plan = textLines(ctx, s.gameplan, WIDTH, k);
  if (plan.length) {
    const n = Math.max(2, rowsFor(plan.length, k));
    blocks.push({
      name: "Gameplan",
      height: n * ROW * k,
      draw: (c, top) => textBox(c, X0, top, WIDTH, n * ROW * k, plan, k, "left"),
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

  // Échelle : la plus grande (≤ MAX_SCALE) qui fait tout tenir sur la page.
  let k = MAX_SCALE;
  let blocks = layout(ctx, s, k);
  for (let i = 0; i < 6 && totalHeight(blocks) > available && k > MIN_SCALE; i++) {
    k = Math.max(MIN_SCALE, k * (available / totalHeight(blocks)) * 0.995);
    blocks = layout(ctx, s, k);
  }

  let y = TOP;
  for (const block of blocks) {
    band(ctx, y, block.height, block.name, k);
    block.draw(ctx, y);
    y += block.height + GAP;
  }
  return [await toFile(canvas, title)];
}
