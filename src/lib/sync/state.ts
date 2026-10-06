import type { ViewState } from "./protocol";

/**
 * Numéro de séquence suivant. Basé sur l'horloge (ms) : une remote rechargée
 * repart au-dessus de ses anciens messages, sans rien mémoriser.
 * Débit max ≈ 60 msg/s < 1000 ms⁻¹ : l'horloge reste en avance.
 */
export function nextSeq(previous: number, now: number): number {
  return Math.max(previous + 1, Math.floor(now));
}

/** Un état reçu est appliqué seulement s'il est plus récent que l'état courant. */
export function isNewer(incoming: ViewState, current: ViewState | null): boolean {
  return current === null || incoming.seq > current.seq;
}

export interface DocRef {
  id: string;
  pageCount: number;
}

/** Remet zoom et déplacement à zéro (changement de page ou de document). */
function resetView(state: ViewState): ViewState {
  return { ...state, zoom: 1, panX: 0, panY: 0 };
}

/** Affiche un document, sur la dernière page vue dans ce document (sinon 1). */
export function selectDocument(
  state: ViewState,
  doc: DocRef,
  pageMemory: Record<string, number>,
): ViewState {
  const remembered = pageMemory[doc.id] ?? 1;
  const page = Math.min(Math.max(1, remembered), doc.pageCount);
  return resetView({ ...state, docId: doc.id, page });
}

/** Page suivante / précédente dans le document courant. Renvoie null si en butée. */
export function stepPage(state: ViewState, doc: DocRef, delta: number): ViewState | null {
  const page = Math.min(Math.max(1, state.page + delta), doc.pageCount);
  if (page === state.page) return null;
  return resetView({ ...state, page });
}

/** Document suivant / précédent (boucle sur la liste). */
export function stepDocument(
  state: ViewState,
  docs: DocRef[],
  delta: number,
  pageMemory: Record<string, number>,
): ViewState | null {
  if (docs.length === 0) return null;
  const index = docs.findIndex((d) => d.id === state.docId);
  const nextIndex =
    index === -1 ? 0 : (((index + delta) % docs.length) + docs.length) % docs.length;
  const doc = docs[nextIndex];
  if (doc.id === state.docId) return null;
  return selectDocument(state, doc, pageMemory);
}
