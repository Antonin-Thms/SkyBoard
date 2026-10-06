"use client";

import type { ViewerDocument } from "./types";

/**
 * Cache persistant des fichiers de documents (Cache API), indexé par id de
 * document : l'affichage tient même si la connexion faiblit ou si l'URL
 * signée a expiré. Les documents sont immuables (pas de remplacement de
 * fichier), un id suffit donc comme clé.
 */
const CACHE_NAME = "skyboard-docs-v1";
const keyFor = (docId: string) => `/__skyboard/doc/${docId}`;

async function openCache(): Promise<Cache | null> {
  try {
    // Cache API : contexte sécurisé uniquement (https ou localhost).
    if (typeof caches === "undefined") return null;
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/** Fichier du document : depuis le cache si présent, sinon téléchargé puis mis en cache. */
export async function getDocumentBlob(doc: ViewerDocument): Promise<Blob> {
  const cache = await openCache();
  const hit = await cache?.match(keyFor(doc.id)).catch(() => undefined);
  if (hit) return hit.blob();

  const res = await fetch(doc.url);
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const blob = await res.blob();
  await cache
    ?.put(keyFor(doc.id), new Response(blob, { headers: { "Content-Type": doc.type } }))
    .catch(() => {}); // quota dépassé, etc. : on continue sans cache
  return blob;
}

/** Télécharge en arrière-plan, un par un, les documents pas encore en cache. */
export async function prefetchDocuments(docs: ViewerDocument[], signal: { cancelled: boolean }) {
  const cache = await openCache();
  if (!cache) return;
  for (const doc of docs) {
    if (signal.cancelled) return;
    try {
      if (await cache.match(keyFor(doc.id))) continue;
      await getDocumentBlob(doc);
    } catch {
      // réseau indisponible : on réessaiera au prochain rechargement de la liste
    }
  }
}

/** Retire du cache les documents supprimés (ou tout, si `keepIds` est vide). */
export async function pruneDocumentCache(keepIds: Set<string>) {
  const cache = await openCache();
  if (!cache) return;
  try {
    for (const request of await cache.keys()) {
      const id = new URL(request.url).pathname.split("/").pop() ?? "";
      if (!keepIds.has(id)) await cache.delete(request);
    }
  } catch {
    // ignoré
  }
}
