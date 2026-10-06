import { pageKey, type InkMessage, type Stroke } from "./model";

/** Trait en cours de tracé (reçu point par point). */
export interface LiveStroke {
  key: string;
  stroke: Stroke;
  /** Dernière mise à jour (ms) : un trait jamais terminé finit par disparaître */
  updatedAt: number;
}

/** Annotations connues : traits terminés par page, et traits en cours. */
export interface InkState {
  pages: Record<string, Stroke[]>;
  live: Record<string, LiveStroke>;
}

export const EMPTY_INK: InkState = { pages: {}, live: {} };

/** Durée après laquelle un trait en cours sans nouvelles est abandonné. */
export const LIVE_STROKE_TTL_MS = 10_000;

/** Applique un message d'annotation (fonction pure). */
export function applyInk(state: InkState, msg: InkMessage, now: number): InkState {
  switch (msg.op) {
    case "draw": {
      const key = pageKey(msg.docId, msg.page);
      const prev = state.live[msg.id];
      const base = prev && prev.key === key ? prev.stroke.points : [];
      // Les points reçus remplacent ceux à partir de `from` (messages rejoués ou perdus tolérés).
      const points = [...base.slice(0, Math.min(base.length, msg.from * 2)), ...msg.points];
      const stroke: Stroke = { id: msg.id, color: msg.color, width: msg.width, points };
      return { ...state, live: { ...state.live, [msg.id]: { key, stroke, updatedAt: now } } };
    }
    case "commit": {
      const key = pageKey(msg.docId, msg.page);
      const live = { ...state.live };
      delete live[msg.stroke.id];
      const strokes = (state.pages[key] ?? []).filter((s) => s.id !== msg.stroke.id);
      return { pages: { ...state.pages, [key]: [...strokes, msg.stroke] }, live };
    }
    case "erase": {
      const key = pageKey(msg.docId, msg.page);
      const ids = new Set(msg.ids);
      const live = Object.fromEntries(Object.entries(state.live).filter(([id]) => !ids.has(id)));
      const strokes = (state.pages[key] ?? []).filter((s) => !ids.has(s.id));
      return { pages: { ...state.pages, [key]: strokes }, live };
    }
    case "clear": {
      const matches = (key: string) =>
        msg.page === null ? key.startsWith(`${msg.docId}:`) : key === pageKey(msg.docId, msg.page);
      return {
        pages: Object.fromEntries(Object.entries(state.pages).filter(([key]) => !matches(key))),
        live: Object.fromEntries(Object.entries(state.live).filter(([, l]) => !matches(l.key))),
      };
    }
  }
}

/** Retire les traits en cours abandonnés (remote déconnectée en plein tracé). */
export function pruneLive(state: InkState, now: number): InkState {
  const stale = Object.values(state.live).some((l) => now - l.updatedAt > LIVE_STROKE_TTL_MS);
  if (!stale) return state;
  return {
    ...state,
    live: Object.fromEntries(
      Object.entries(state.live).filter(([, l]) => now - l.updatedAt <= LIVE_STROKE_TTL_MS),
    ),
  };
}

/** Traits à afficher pour une page : terminés puis en cours. */
export function strokesForPage(state: InkState, key: string): Stroke[] {
  const live = Object.values(state.live)
    .filter((l) => l.key === key)
    .map((l) => l.stroke);
  const done = state.pages[key] ?? [];
  return live.length ? [...done, ...live] : done;
}
