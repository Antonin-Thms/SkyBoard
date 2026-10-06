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

import type { Rotation } from "@/lib/database.types";

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
  /** Position du doigt sur la remote, si l'affichage du curseur est demandé */
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

/**
 * Avance maximale tolérée d'un numéro de séquence sur l'horloge locale.
 * `seq` est basé sur l'horloge de la remote : sans borne, un message forgé
 * avec un `seq` démesuré ferait ignorer tous les états légitimes suivants.
 * Couvre largement le décalage d'horloge entre deux appareils.
 */
export const MAX_SEQ_AHEAD_MS = 2 * 60 * 1000;
/** Bornes larges : le viewer reborne de toute façon zoom et déplacement. */
const MAX_ZOOM = 100;
const MAX_PAN = 1;

function parsePoint(value: unknown): NormalizedPoint | null {
  if (!value || typeof value !== "object") return null;
  const { x, y } = value as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  // Le curseur peut sortir un peu de la page, pas plus.
  return Math.abs(x - 0.5) <= 1 && Math.abs(y - 0.5) <= 1 ? { x, y } : null;
}

/**
 * Valide un état reçu (réseau ou base). Renvoie null si invalide.
 * Les messages Realtime sont publics pour qui connaît le canal : on ne fait
 * jamais confiance à leur contenu.
 */
export function parseViewState(value: unknown, now: number = Date.now()): ViewState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  const docId = v.docId === null || typeof v.docId === "string" ? v.docId : undefined;
  if (docId === undefined || (docId !== null && docId.length > 64)) return null;
  if (!isFiniteNumber(v.page) || !Number.isInteger(v.page) || v.page < 1) return null;
  if (!isFiniteNumber(v.zoom) || v.zoom <= 0 || v.zoom > MAX_ZOOM) return null;
  if (!isFiniteNumber(v.panX) || !isFiniteNumber(v.panY)) return null;
  if (Math.abs(v.panX) > MAX_PAN || Math.abs(v.panY) > MAX_PAN) return null;
  if (!isFiniteNumber(v.seq) || !Number.isSafeInteger(v.seq) || v.seq < 0) return null;
  if (v.seq > now + MAX_SEQ_AHEAD_MS) return null;
  if (!isFiniteNumber(v.ts)) return null;

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

/** Rotation d'un document (propriété du document, pas de l'état synchronisé). */
export function isRotation(value: unknown): value is Rotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

/** Tourne de `delta` × 90° (sens horaire si positif). */
export function rotateBy(rotation: Rotation, delta: number): Rotation {
  return ((((rotation + delta * 90) % 360) + 360) % 360) as Rotation;
}
