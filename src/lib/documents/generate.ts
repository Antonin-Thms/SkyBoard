"use client";

/**
 * Pages créées dans SkyBoard (sans fichier) : page de notes vierge à annoter et
 * checklists. Rendues en PNG dans le navigateur, puis envoyées comme
 * n'importe quel document (miniature, viewer, annotations…).
 */

import { fmt } from "@/lib/i18n/define";
import type { TacticalData } from "./generated";

/** Format A4 portrait à 150 dpi. */
const PAGE = { width: 1240, height: 1754 };
const MARGIN = 90;
const INK = "#111111";

function newPage(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE.width;
  canvas.height = PAGE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE.width, PAGE.height);
  return { canvas, ctx };
}

function toFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], `${name}.png`, { type: "image/png" })) : reject(new Error("Rendu impossible."))),
      "image/png",
    ),
  );
}

/** Page de notes vierge, à annoter au doigt. */
export async function renderNotePage(name: string): Promise<File> {
  const { canvas } = newPage();
  return toFile(canvas, name);
}

/** Coupe un texte en lignes qui tiennent dans `maxWidth`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Nettoie la saisie d'une checklist : une ligne = un élément. */
export function parseChecklistItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\[\s?[xX ]?\]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 300);
}

/**
 * Checklist : titre puis une case par élément, sur autant de pages que
 * nécessaire. Les cases se cochent au doigt avec le crayon.
 */
export async function renderChecklist(
  title: string,
  items: string[],
  /** Titre des pages suivantes, gabarit avec {title} (ex. « {title} (suite) ») */
  continuedTitle: string,
): Promise<File[]> {
  const pages: HTMLCanvasElement[] = [];
  const box = 38;
  const textX = MARGIN + box + 28;
  const textWidth = PAGE.width - MARGIN - textX;
  const lineHeight = 52;
  const itemGap = 26;

  let page = newPage();
  let y = 0;
  const header = (ctx: CanvasRenderingContext2D, continued: boolean) => {
    ctx.fillStyle = INK;
    ctx.font = "600 56px sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(continued ? fmt(continuedTitle, { title }) : title, MARGIN, MARGIN + 50);
    ctx.fillRect(MARGIN, MARGIN + 80, PAGE.width - 2 * MARGIN, 4);
    return MARGIN + 150;
  };
  y = header(page.ctx, false);

  for (const item of items) {
    const { ctx } = page;
    ctx.font = "40px sans-serif";
    const lines = wrap(ctx, item, textWidth);
    const height = lines.length * lineHeight;
    if (y + height > PAGE.height - MARGIN) {
      pages.push(page.canvas);
      page = newPage();
      y = header(page.ctx, true);
      page.ctx.font = "40px sans-serif";
    }
    const c = page.ctx;
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.strokeRect(MARGIN, y - box + 6, box, box);
    c.fillStyle = INK;
    lines.forEach((line, i) => c.fillText(line, textX, y + i * lineHeight));
    y += height + itemGap;
  }
  pages.push(page.canvas);

  return Promise.all(
    pages.map((canvas, i) => toFile(canvas, pages.length > 1 ? `${title} (${i + 1}-${pages.length})` : title)),
  );
}

/** Nombre de colonnes d'une table RAMROD (chiffres 0 à 9). */
export const RAMROD_SIZE = 10;

/** Un caractère par case : majuscule, sans espace (gère les caractères accentués). */
export function normalizeRamrodChar(input: string): string {
  return Array.from(input.replace(/\s+/g, "").toLocaleUpperCase()).at(-1) ?? "";
}

/** Texte collé ou saisi d'un coup : un caractère par case, au plus 10. */
export function splitRamrodChars(input: string): string[] {
  return Array.from(input.replace(/\s+/g, "").toLocaleUpperCase()).slice(0, RAMROD_SIZE);
}

/** Caractères présents plusieurs fois (une table RAMROD n'en a normalement aucun). */
export function ramrodDuplicates(chars: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const c of chars) {
    if (!c) continue;
    if (seen.has(c)) dupes.add(c);
    seen.add(c);
  }
  return [...dupes];
}

/**
 * Table d'authentification RAMROD : ligne 1 = chiffres 0 à 9, ligne 2 = le
 * caractère associé à chaque chiffre. Cases vides laissées à remplir au crayon.
 */
/** Table RAMROD (chiffres 0 à 9 / caractères), haut à `top`. Renvoie sa hauteur. */
function drawRamrod(ctx: CanvasRenderingContext2D, top: number, chars: string[]): number {
  const cell = (PAGE.width - 2 * MARGIN) / RAMROD_SIZE;
  const digitsHeight = 80;
  const charsHeight = 130;

  // Ligne des chiffres : fond gris clair, lisible même atténuée (mode nuit).
  ctx.fillStyle = HEADER_FILL;
  ctx.fillRect(MARGIN, top, cell * RAMROD_SIZE, digitsHeight);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < RAMROD_SIZE; i++) {
    const cx = MARGIN + cell * i + cell / 2;
    ctx.fillStyle = INK;
    ctx.font = "600 48px sans-serif";
    ctx.fillText(String(i), cx, top + digitsHeight / 2 + 2);
    const ch = chars[i] ?? "";
    if (ch) {
      ctx.font = "700 84px sans-serif";
      ctx.fillText(ch, cx, top + digitsHeight + charsHeight / 2 + 4, cell - 12);
    }
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(MARGIN, top, cell * RAMROD_SIZE, digitsHeight + charsHeight);
  ctx.beginPath();
  ctx.moveTo(MARGIN, top + digitsHeight);
  ctx.lineTo(MARGIN + cell * RAMROD_SIZE, top + digitsHeight);
  for (let i = 1; i < RAMROD_SIZE; i++) {
    ctx.moveTo(MARGIN + cell * i, top);
    ctx.lineTo(MARGIN + cell * i, top + digitsHeight + charsHeight);
  }
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  return digitsHeight + charsHeight;
}

const HEADER_FILL = "#e4e4e4";

/** Textes de la fiche tactique (dans la langue de l'interface). */
export interface TacticalLabels {
  /** Titre des pages suivantes, gabarit avec {title} */
  continued: string;
  ramrod: string;
  navaids: string;
  navaidColumns: [name: string, tacan: string, ils: string, freq: string];
  freqs: string;
  freqColumns: [name: string, freq: string];
  codes: string;
  codeColumns: [name: string, code: string];
  notes: string;
}

/**
 * Fiche tactique : titre puis sections facultatives (RAMROD, navigation,
 * fréquences, codes laser, notes), en gros caractères lisibles dans le
 * casque. Continue sur une page suivante si nécessaire.
 */
export async function renderTactical(title: string, data: TacticalData, labels: TacticalLabels): Promise<File[]> {
  const pages: HTMLCanvasElement[] = [];
  const width = PAGE.width - 2 * MARGIN;
  // Marge basse réduite : une fiche bien remplie tient sur une page.
  const bottom = PAGE.height - 50;
  let page = newPage();
  let y = 0;

  const header = (continued: boolean) => {
    const { ctx } = page;
    ctx.fillStyle = INK;
    ctx.font = "600 56px sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText(continued ? fmt(labels.continued, { title }) : title, MARGIN, MARGIN + 50, width);
    ctx.fillRect(MARGIN, MARGIN + 80, width, 4);
    y = MARGIN + 130;
  };
  const newSheet = () => {
    pages.push(page.canvas);
    page = newPage();
    header(true);
  };
  /** Réserve `height` px (nouvelle page si besoin). */
  const ensure = (height: number) => {
    if (y + height > bottom) newSheet();
  };
  const sectionTitle = (text: string) => {
    const { ctx } = page;
    ctx.fillStyle = "#555555";
    ctx.font = "700 34px sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text.toLocaleUpperCase(), MARGIN, y + 34, width);
    y += 50;
  };

  /** Tableau : en-tête gris, lignes en gros caractères ; l'en-tête est répété après un saut de page. */
  const table = (name: string, columns: string[], fractions: number[], rows: string[][]) => {
    const headerHeight = 54;
    const rowHeight = 74;
    const xs = fractions.reduce<number[]>((acc, f, i) => [...acc, acc[i] + f * width], [MARGIN]);
    const drawHeader = () => {
      const { ctx } = page;
      ctx.fillStyle = HEADER_FILL;
      ctx.fillRect(MARGIN, y, width, headerHeight);
      ctx.fillStyle = INK;
      ctx.font = "600 30px sans-serif";
      ctx.textBaseline = "middle";
      columns.forEach((c, i) => ctx.fillText(c, xs[i] + 18, y + headerHeight / 2 + 1, xs[i + 1] - xs[i] - 28));
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(MARGIN, y, width, headerHeight);
      columnLines(headerHeight);
      y += headerHeight;
    };
    const columnLines = (height: number) => {
      const { ctx } = page;
      ctx.beginPath();
      for (let i = 1; i < columns.length; i++) {
        ctx.moveTo(xs[i], y);
        ctx.lineTo(xs[i], y + height);
      }
      ctx.stroke();
    };
    ensure(50 + headerHeight + rowHeight);
    sectionTitle(name);
    drawHeader();
    for (const row of rows) {
      if (y + rowHeight > bottom) {
        newSheet();
        sectionTitle(name);
        drawHeader();
      }
      const { ctx } = page;
      ctx.fillStyle = INK;
      ctx.textBaseline = "middle";
      row.forEach((cell, i) => {
        // Première colonne (nom) un peu plus légère, valeurs en gras.
        ctx.font = i === 0 ? "500 40px sans-serif" : "700 44px sans-serif";
        ctx.fillText(cell, xs[i] + 18, y + rowHeight / 2 + 2, xs[i + 1] - xs[i] - 28);
      });
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(MARGIN, y, width, rowHeight);
      columnLines(rowHeight);
      y += rowHeight;
    }
    y += 34;
  };

  header(false);

  if (data.ramrod.some((c) => c)) {
    ensure(50 + 210);
    sectionTitle(labels.ramrod);
    y += drawRamrod(page.ctx, y, data.ramrod) + 34;
  }
  if (data.navaids.length) {
    table(labels.navaids, labels.navaidColumns, [0.34, 0.2, 0.2, 0.26], data.navaids.map((r) => [r.name, r.tacan, r.ils, r.freq]));
  }
  if (data.freqs.length) {
    table(labels.freqs, labels.freqColumns, [0.6, 0.4], data.freqs.map((r) => [r.name, r.freq]));
  }
  if (data.codes.length) {
    table(labels.codes, labels.codeColumns, [0.6, 0.4], data.codes.map((r) => [r.name, r.code]));
  }
  if (data.notes) {
    const { ctx } = page;
    ctx.font = "40px sans-serif";
    const lines = data.notes.split(/\r?\n/).flatMap((line) => (line.trim() ? wrap(ctx, line, width) : [""]));
    ensure(50 + 48);
    sectionTitle(labels.notes);
    for (const line of lines) {
      if (y + 48 > bottom) {
        newSheet();
        sectionTitle(labels.notes);
      }
      page.ctx.font = "40px sans-serif";
      page.ctx.fillStyle = INK;
      page.ctx.textBaseline = "alphabetic";
      page.ctx.fillText(line, MARGIN, y + 40);
      y += 48;
    }
  }
  pages.push(page.canvas);

  return Promise.all(
    pages.map((canvas, i) => toFile(canvas, pages.length > 1 ? `${title} (${i + 1}-${pages.length})` : title)),
  );
}
