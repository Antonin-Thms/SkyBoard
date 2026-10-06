"use client";

/**
 * Pages créées dans SkyBoard (sans fichier) : page de notes vierge à annoter et
 * checklists. Rendues en PNG dans le navigateur, puis envoyées comme
 * n'importe quel document (miniature, viewer, annotations…).
 */

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
export async function renderChecklist(title: string, items: string[]): Promise<File[]> {
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
    ctx.fillText(continued ? `${title} (suite)` : title, MARGIN, MARGIN + 50);
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
