"use client";

/**
 * Export Excel de la fiche tactique : les cases dessinées par le rendu de la
 * kneeboard (voir `tacticalCells`) sont reportées sur une grille de tableur
 * (une colonne / une ligne entre deux bords de case, cases fusionnées), avec
 * les mêmes proportions, couleurs, polices et bordures. Une page A4 portrait.
 */

import { PAGE } from "./generate";
import { tacticalCells, type DrawnCell } from "./render-tactical";
import type { TacticalSheet } from "./tactical";

/** Pixels de la page (150 dpi) → pixels d'écran Excel (96 dpi). */
const SCREEN = 96 / 150;

/** Case placée sur la grille : colonnes et lignes 1-based, bornes incluses. */
export interface GridCell {
  cell: DrawnCell;
  c1: number;
  c2: number;
  r1: number;
  r2: number;
}

export interface Grid {
  /** Largeur de chaque colonne, en pixels de la page */
  cols: number[];
  /** Hauteur de chaque ligne, en pixels de la page */
  rows: number[];
  cells: GridCell[];
}

/** Bords triés, rapprochés s'ils sont à moins de `snap` pixels. */
function edges(values: number[], snap = 1.5): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) if (!out.length || v - out[out.length - 1] > snap) out.push(v);
  return out;
}

/** Index du bord le plus proche. */
function nearest(list: number[], v: number): number {
  let best = 0;
  for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - v) < Math.abs(list[best] - v)) best = i;
  return best;
}

/**
 * Grille de tableur à partir des cases dessinées. Une case qui en
 * chevaucherait une autre déjà placée est ignorée (fusion impossible).
 */
export function buildGrid(drawn: DrawnCell[]): Grid {
  const xs = edges([0, ...drawn.flatMap((d) => [d.x, d.x + d.w]), PAGE.width]);
  const ys = edges([0, ...drawn.flatMap((d) => [d.y, d.y + d.h]), PAGE.height]);
  const taken = new Set<string>();
  const cells: GridCell[] = [];
  for (const cell of drawn) {
    const c1 = nearest(xs, cell.x) + 1;
    const c2 = nearest(xs, cell.x + cell.w);
    const r1 = nearest(ys, cell.y) + 1;
    const r2 = nearest(ys, cell.y + cell.h);
    if (c2 < c1 || r2 < r1) continue;
    const keys: string[] = [];
    let free = true;
    for (let r = r1; r <= r2 && free; r++)
      for (let c = c1; c <= c2; c++) {
        const key = `${r}:${c}`;
        if (taken.has(key)) free = false;
        keys.push(key);
      }
    if (!free) continue;
    keys.forEach((key) => taken.add(key));
    cells.push({ cell, c1, c2, r1, r2 });
  }
  return {
    cols: xs.slice(1).map((x, i) => x - xs[i]),
    rows: ys.slice(1).map((y, i) => y - ys[i]),
    cells,
  };
}

/** « #rrggbb » ou « #rgb » → ARGB Excel. */
function argb(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((ch) => ch + ch).join("");
  return `FF${h.toUpperCase()}`;
}

/** Classeur Excel (.xlsx) de la fiche tactique. */
export async function tacticalXlsx(title: string, s: TacticalSheet): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const grid = buildGrid(tacticalCells(s));

  const wb = new ExcelJS.Workbook();
  wb.creator = "SkyBoard";
  const ws = wb.addWorksheet((title || "Fiche").replace(/[*?:\\/[\]]/g, " ").slice(0, 31) || "Fiche", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0, footer: 0 },
    },
  });

  // Largeurs (caractères) et hauteurs (points) aux proportions de la kneeboard.
  ws.columns = grid.cols.map((px) => ({ width: Math.max(0.1, (px * SCREEN) / 7) }));
  grid.rows.forEach((px, i) => (ws.getRow(i + 1).height = Math.max(1, px * SCREEN * 0.75)));

  const line = { style: "thin" as const, color: { argb: argb("#262626") } };
  for (const { cell, c1, c2, r1, r2 } of grid.cells) {
    const fill = cell.fill ? { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: argb(cell.fill) } } : undefined;
    if (c2 > c1 || r2 > r1) ws.mergeCells(r1, c1, r2, c2);
    // Fond et bordure sur chaque case de la zone, après la fusion (Excel lit les
    // cases du bord, LibreOffice la case principale : elle reçoit les 4 côtés).
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++) {
        const target = ws.getCell(r, c);
        if (fill) target.fill = fill;
        if (!cell.border) continue;
        const main = r === r1 && c === c1;
        target.border = {
          top: main || r === r1 ? line : undefined,
          bottom: main || r === r2 ? line : undefined,
          left: main || c === c1 ? line : undefined,
          right: main || c === c2 ? line : undefined,
        };
      }
    const master = ws.getCell(r1, c1);
    if (cell.text) master.value = cell.text;
    master.font = {
      name: "Arial",
      size: Math.max(5, Math.round(cell.size * SCREEN * 0.75 * 2) / 2),
      bold: cell.bold,
      color: { argb: argb(cell.color) },
    };
    master.alignment = {
      horizontal: cell.align,
      vertical: cell.valign,
      wrapText: !cell.rotate,
      textRotation: cell.rotate ? 90 : undefined,
      indent: cell.align === "left" ? 1 : undefined,
    };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
