"use client";

import type { DocumentMimeType } from "@/lib/database.types";
import { loadPdfjs } from "@/lib/pdf/pdfjs";

/** Taille max (px) du plus grand côté d'une miniature. */
const THUMBNAIL_MAX_SIDE = 480;

export interface FileAnalysis {
  pageCount: number;
  thumbnail: Blob | null;
}

/** Compte les pages et génère une miniature de la première page. */
export async function analyzeFile(file: Blob, mime: DocumentMimeType): Promise<FileAnalysis> {
  return mime === "application/pdf" ? analyzePdf(file) : analyzeImage(file);
}

async function analyzePdf(file: Blob): Promise<FileAnalysis> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_MAX_SIDE / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    return { pageCount: pdf.numPages, thumbnail: await canvasToThumbnail(canvas) };
  } finally {
    await task.destroy();
  }
}

async function analyzeImage(file: Blob): Promise<FileAnalysis> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, THUMBNAIL_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { pageCount: 1, thumbnail: await canvasToThumbnail(canvas) };
  } finally {
    bitmap.close();
  }
}

/** WebP si le navigateur sait l'encoder, sinon JPEG (anciens Safari). */
async function canvasToThumbnail(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.8));
  const webp = await toBlob("image/webp");
  if (webp?.type === "image/webp") return webp;
  return toBlob("image/jpeg");
}
