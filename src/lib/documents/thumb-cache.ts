"use client";

/**
 * Cache navigateur des miniatures, indexé par id de document (une miniature
 * ne change jamais pour un document donné). Mémoire pour la session, Cache
 * API pour les visites suivantes : une fois téléchargée, une miniature
 * s'affiche instantanément, même après un changement de dossier ou un
 * rechargement, sans dépendre des en-têtes de cache de Supabase.
 */
const CACHE_NAME = "skyboard-thumbs-v1";
const keyFor = (docId: string) => `/__skyboard/thumb/${docId}`;

/** Miniatures déjà prêtes (lecture synchrone au rendu). */
const ready = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

async function openCache(): Promise<Cache | null> {
  try {
    if (typeof caches === "undefined") return null;
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

export function peekThumbnail(docId: string): string | undefined {
  return ready.get(docId);
}

/** URL locale (objectURL) de la miniature, téléchargée au plus une fois. */
export function loadThumbnail(docId: string, signedUrl: string): Promise<string> {
  const known = ready.get(docId);
  if (known) return Promise.resolve(known);
  let task = pending.get(docId);
  if (!task) {
    task = (async () => {
      const cache = await openCache();
      const hit = await cache?.match(keyFor(docId)).catch(() => undefined);
      let blob: Blob;
      if (hit) {
        blob = await hit.blob();
      } else {
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error(`miniature ${res.status}`);
        blob = await res.blob();
        await cache
          ?.put(keyFor(docId), new Response(blob, { headers: { "Content-Type": blob.type } }))
          .catch(() => {});
      }
      const url = URL.createObjectURL(blob);
      ready.set(docId, url);
      return url;
    })();
    pending.set(docId, task);
    task.finally(() => pending.delete(docId)).catch(() => {});
  }
  return task;
}

/** Oublie les miniatures des documents supprimés. */
export async function pruneThumbnails(keepIds: Set<string>) {
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
