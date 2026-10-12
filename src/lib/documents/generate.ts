"use client";

/**
 * Pages créées dans SkyBoard (sans fichier) : page de notes vierge à annoter et
 * checklists. Rendues en PNG dans le navigateur, puis envoyées comme
 * n'importe quel document (miniature, viewer, annotations…).
 */

import { fmt } from "@/lib/i18n/define";

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
export async function renderRamrod(title: string, chars: string[]): Promise<File> {
  const { canvas, ctx } = newPage();
  ctx.fillStyle = INK;
  ctx.font = "600 56px sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, MARGIN, MARGIN + 50);
  ctx.fillRect(MARGIN, MARGIN + 80, PAGE.width - 2 * MARGIN, 4);

  const top = MARGIN + 170;
  const cell = (PAGE.width - 2 * MARGIN) / RAMROD_SIZE;
  const digitsHeight = 110;
  const charsHeight = 170;

  // Ligne des chiffres : fond gris clair, lisible même atténuée (mode nuit).
  ctx.fillStyle = "#e4e4e4";
  ctx.fillRect(MARGIN, top, cell * RAMROD_SIZE, digitsHeight);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < RAMROD_SIZE; i++) {
    const cx = MARGIN + cell * i + cell / 2;
    ctx.fillStyle = INK;
    ctx.font = "600 60px sans-serif";
    ctx.fillText(String(i), cx, top + digitsHeight / 2 + 2);
    const ch = chars[i] ?? "";
    if (ch) {
      ctx.font = "700 100px sans-serif";
      ctx.fillText(ch, cx, top + digitsHeight + charsHeight / 2 + 4, cell - 12);
    }
  }

  // Quadrillage
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

  return toFile(canvas, title);
}
