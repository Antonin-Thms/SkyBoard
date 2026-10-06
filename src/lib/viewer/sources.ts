"use client";

import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { loadPdfjs } from "@/lib/pdf/pdfjs";
import { getDocumentBlob } from "./doc-cache";
import type { ViewerDocument } from "./types";

/**
 * Source chargée d'un document : PDF (pdf.js) ou image décodée.
 * Le cache est indexé par id de document (pas par URL signée, qui change
 * à chaque renouvellement).
 */
export type DocumentSource = (
  | { kind: "pdf"; pdf: PDFDocumentProxy }
  | { kind: "image"; image: ImageBitmap }
) & { release: () => void };

const cache = new Map<string, Promise<DocumentSource>>();

/**
 * Documents gardés ouverts : le courant, ses voisins pré-rendus et un peu de
 * marge. Au-delà, le moins récemment utilisé est fermé (mémoire du worker
 * pdf.js, prise à DCS pendant une longue session).
 */
const MAX_OPEN_SOURCES = 8;

export function loadDocumentSource(doc: ViewerDocument): Promise<DocumentSource> {
  let entry = cache.get(doc.id);
  if (entry) {
    // Récemment utilisé : passe en fin de file.
    cache.delete(doc.id);
    cache.set(doc.id, entry);
    return entry;
  }
  entry = fetchSource(doc);
  cache.set(doc.id, entry);
  // En cas d'échec, on retire l'entrée pour permettre un nouvel essai.
  entry.catch(() => {
    if (cache.get(doc.id) === entry) cache.delete(doc.id);
  });
  while (cache.size > MAX_OPEN_SOURCES) {
    const [oldestId, oldest] = cache.entries().next().value!;
    cache.delete(oldestId);
    oldest.then((src) => src.release()).catch(() => {});
  }
  return entry;
}

/** Libère les documents qui ne font plus partie de la liste. */
export function pruneDocumentSources(keepIds: Set<string>) {
  for (const [id, entry] of cache) {
    if (keepIds.has(id)) continue;
    cache.delete(id);
    entry
      .then((src) => src.release())
      .catch(() => {});
  }
}

async function fetchSource(doc: ViewerDocument): Promise<DocumentSource> {
  // Fichier complet (pas de requêtes par plages), depuis le cache persistant
  // si possible : le document reste utilisable même après expiration de
  // l'URL signée ou perte de connexion.
  const blob = await getDocumentBlob(doc);

  if (doc.type === "application/pdf") {
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(await blob.arrayBuffer());
    const task = pdfjs.getDocument({ data });
    const pdf = await task.promise;
    return { kind: "pdf", pdf, release: () => void task.destroy() };
  }
  const image = await createImageBitmap(blob);
  return { kind: "image", image, release: () => image.close() };
}
