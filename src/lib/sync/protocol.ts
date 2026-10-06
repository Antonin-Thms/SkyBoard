/**
 * Protocole de synchronisation remote → viewer.
 * On synchronise un ÉTAT, jamais de vidéo. Les positions (pan, curseur) sont
 * normalisées par rapport aux dimensions de la page pour être indépendantes
 * de la taille des écrans.
 */

export interface NormalizedPoint {
  /** 0..1 sur la largeur de la page */
  x: number;
  /** 0..1 sur la hauteur de la page */
  y: number;
}

export interface ViewState {
  /** Document affiché (null : aucun) */
  docId: string | null;
  /** Page courante, à partir de 1 */
  page: number;
  /** Facteur de zoom, 1 = page ajustée à la fenêtre */
  zoom: number;
  /** Déplacement horizontal, en fraction de la largeur de la page */
  panX: number;
  /** Déplacement vertical, en fraction de la hauteur de la page */
  panY: number;
  /** Numéro de séquence croissant : le viewer ignore les messages plus anciens */
  seq: number;
  /** Horodatage d'émission (ms epoch) */
  ts: number;
  /** Position du doigt sur l'iPad, si l'affichage du curseur est demandé */
  cursor?: NormalizedPoint | null;
}

export const INITIAL_VIEW_STATE: ViewState = {
  docId: null,
  page: 1,
  zoom: 1,
  panX: 0,
  panY: 0,
  seq: 0,
  ts: 0,
  cursor: null,
};

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parsePoint(value: unknown): NormalizedPoint | null {
  if (!value || typeof value !== "object") return null;
  const { x, y } = value as Record<string, unknown>;
  return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : null;
}

/**
 * Valide un état reçu (réseau ou base). Renvoie null si invalide.
 * Les messages Realtime sont publics pour qui connaît le canal : on ne fait
 * jamais confiance à leur contenu.
 */
export function parseViewState(value: unknown): ViewState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  const docId = v.docId === null || typeof v.docId === "string" ? v.docId : undefined;
  if (docId === undefined || (docId !== null && docId.length > 64)) return null;
  if (!isFiniteNumber(v.page) || !Number.isInteger(v.page) || v.page < 1) return null;
  if (!isFiniteNumber(v.zoom) || v.zoom <= 0) return null;
  if (!isFiniteNumber(v.panX) || !isFiniteNumber(v.panY)) return null;
  if (!isFiniteNumber(v.seq) || !isFiniteNumber(v.ts)) return null;

  return {
    docId,
    page: v.page,
    zoom: v.zoom,
    panX: v.panX,
    panY: v.panY,
    seq: v.seq,
    ts: v.ts,
    cursor: parsePoint(v.cursor),
  };
}
