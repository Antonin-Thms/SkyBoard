"use client";

import type { PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PageRect } from "./detail";
import { capRenderScale, type Size } from "./fit";
import type { DocumentSource } from "./sources";

/** Plafond de pixels d'un canvas de rendu (≈ 4096 × 4096). */
export const MAX_CANVAS_PIXELS = 16_777_216;

/** Permet d'annuler un rendu pdf.js en cours. */
export type CancelHook = (cancel: () => void) => void;

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  /** Taille naturelle de la page (points PDF ou pixels de l'image) */
  natural: Size;
}

async function pdfPageOf(source: DocumentSource, page: number): Promise<PDFPageProxy> {
  if (source.kind !== "pdf") throw new Error("not a pdf");
  return source.pdf.getPage(Math.min(Math.max(1, page), source.pdf.numPages));
}

/** Taille naturelle d'une page. */
export async function naturalSize(source: DocumentSource, page: number): Promise<Size> {
  if (source.kind === "image") return { width: source.image.width, height: source.image.height };
  const viewport = (await pdfPageOf(source, page)).getViewport({ scale: 1 });
  return { width: viewport.width, height: viewport.height };
}

/**
 * Rend une portion de page (rect normalisé, toute la page par défaut) à
 * `scale` pixels de canvas par unité naturelle, dans un canvas hors écran.
 */
export async function renderRegion(
  source: DocumentSource,
  page: number,
  scale: number,
  rect: PageRect = { x: 0, y: 0, width: 1, height: 1 },
  onCancel?: CancelHook,
): Promise<RenderedPage> {
  const natural = await naturalSize(source, page);
  const region = { width: natural.width * rect.width, height: natural.height * rect.height };
  const s = capRenderScale(region, scale, MAX_CANVAS_PIXELS);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * s));
  canvas.height = Math.max(1, Math.round(region.height * s));

  if (source.kind === "pdf") {
    const pdfPage = await pdfPageOf(source, page);
    const viewport = pdfPage.getViewport({
      scale: s,
      offsetX: -rect.x * natural.width * s,
      offsetY: -rect.y * natural.height * s,
    });
    const task = pdfPage.render({ canvas, viewport });
    onCancel?.(() => task.cancel());
    await task.promise;
  } else {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        source.image,
        rect.x * natural.width,
        rect.y * natural.height,
        region.width,
        region.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }
  }
  return { canvas, natural };
}

/** Copie un canvas hors écran dans un canvas affiché (remplacement d'un coup). */
export function blit(from: HTMLCanvasElement, to: HTMLCanvasElement) {
  to.width = from.width;
  to.height = from.height;
  to.getContext("2d")?.drawImage(from, 0, 0);
}
