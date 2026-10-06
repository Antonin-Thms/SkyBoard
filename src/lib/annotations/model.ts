import type { Rotation } from "@/lib/database.types";
import type { NormalizedPoint } from "@/lib/sync/protocol";

/**
 * Annotations : traits dessinés au doigt sur une page.
 *
 * Les points sont stockés dans le repère du DOCUMENT (page non tournée,
 * 0..1 sur chaque axe) : une rotation réglée plus tard sur la page Documents
 * ne décale pas les annotations. La remote et le viewer convertissent depuis
 * / vers le repère affiché (page tournée).
 */
export interface Stroke {
  /** Identifiant aléatoire (créé par la remote) */
  id: string;
  color: InkColor;
  /** Épaisseur, en fraction de la largeur de la page */
  width: number;
  /** Points à plat [x0, y0, x1, y1, …], repère du document */
  points: number[];
}

/** Couleurs disponibles (lisibles sur un kneeboard blanc). */
export const INK_COLORS = ["#d62828", "#1d4ed8", "#111111", "#15803d"] as const;
export type InkColor = (typeof INK_COLORS)[number];
/** Épaisseurs proposées (fraction de la largeur de la page). */
export const INK_WIDTHS = { fin: 0.005, epais: 0.011 } as const;
export const DEFAULT_INK = { color: INK_COLORS[0] as InkColor, width: INK_WIDTHS.fin };

const MIN_WIDTH = 0.001;
const MAX_WIDTH = 0.03;
/** Au-delà, un trait est coupé en plusieurs (taille des messages bornée). */
export const MAX_STROKE_POINTS = 1000;
/** Nombre maximal de traits par page (aussi borné en base). */
export const MAX_STROKES_PER_PAGE = 1000;
/** Distance minimale entre deux points enregistrés (repère normalisé). */
export const MIN_POINT_DISTANCE = 0.002;

/** Clé d'une page annotée. */
export const pageKey = (docId: string, page: number) => `${docId}:${page}`;

/** 4 décimales suffisent (1/10 000 de page) et allègent les messages. */
export const quantize = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1e4) / 1e4;

/** Point affiché (page tournée de `rotation` degrés, sens horaire) → repère du document. */
export function toDocumentPoint({ x, y }: NormalizedPoint, rotation: Rotation): NormalizedPoint {
  switch (rotation) {
    case 90:
      return { x: y, y: 1 - x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: 1 - y, y: x };
    default:
      return { x, y };
  }
}

/** Repère du document → point affiché (inverse de toDocumentPoint). */
export function toDisplayPoint({ x, y }: NormalizedPoint, rotation: Rotation): NormalizedPoint {
  switch (rotation) {
    case 90:
      return { x: 1 - y, y: x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      return { x: y, y: 1 - x };
    default:
      return { x, y };
  }
}

/** Identifiant de trait : 16 caractères aléatoires. */
export function newStrokeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrokeId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v);
const isDocId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const isPage = (v: unknown): v is number => isFiniteNumber(v) && Number.isInteger(v) && v >= 1 && v <= 2000;
export const isInkColor = (v: unknown): v is InkColor => INK_COLORS.includes(v as InkColor);
const isWidth = (v: unknown): v is number => isFiniteNumber(v) && v >= MIN_WIDTH && v <= MAX_WIDTH;

function parsePoints(v: unknown, max = MAX_STROKE_POINTS): number[] | null {
  if (!Array.isArray(v) || v.length % 2 !== 0 || v.length > max * 2) return null;
  for (const n of v) if (!isFiniteNumber(n) || n < 0 || n > 1) return null;
  return v as number[];
}

/** Valide un trait (réseau ou base). */
export function parseStroke(value: unknown): Stroke | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  if (!isStrokeId(s.id) || !isInkColor(s.color) || !isWidth(s.width)) return null;
  const points = parsePoints(s.points);
  if (!points || points.length < 2) return null;
  return { id: s.id, color: s.color, width: s.width, points };
}

/** Liste de traits stockée en base : les traits invalides sont ignorés. */
export function parseStrokes(value: unknown): Stroke[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_STROKES_PER_PAGE).flatMap((s) => {
    const stroke = parseStroke(s);
    return stroke ? [stroke] : [];
  });
}

/**
 * Messages d'annotation diffusés sur le canal du cockpit (événement « ink »).
 * - draw : points ajoutés à un trait en cours (à partir du point `from`)
 * - commit : trait terminé (complet)
 * - erase : traits supprimés
 * - clear : page (ou document entier si page = null) effacée
 */
export type InkMessage =
  | { op: "draw"; docId: string; page: number; id: string; color: InkColor; width: number; from: number; points: number[] }
  | { op: "commit"; docId: string; page: number; stroke: Stroke }
  | { op: "erase"; docId: string; page: number; ids: string[] }
  | { op: "clear"; docId: string; page: number | null };

/** Valide un message reçu (canal public : jamais de confiance). */
export function parseInkMessage(value: unknown): InkMessage | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  if (!isDocId(m.docId)) return null;
  switch (m.op) {
    case "draw": {
      if (!isPage(m.page) || !isStrokeId(m.id) || !isInkColor(m.color) || !isWidth(m.width)) return null;
      if (!isFiniteNumber(m.from) || !Number.isInteger(m.from) || m.from < 0 || m.from >= MAX_STROKE_POINTS) {
        return null;
      }
      const points = parsePoints(m.points);
      if (!points || m.from + points.length / 2 > MAX_STROKE_POINTS) return null;
      return { op: "draw", docId: m.docId, page: m.page, id: m.id, color: m.color, width: m.width, from: m.from, points };
    }
    case "commit": {
      const stroke = parseStroke(m.stroke);
      return isPage(m.page) && stroke ? { op: "commit", docId: m.docId, page: m.page, stroke } : null;
    }
    case "erase": {
      if (!isPage(m.page) || !Array.isArray(m.ids) || m.ids.length > MAX_STROKES_PER_PAGE) return null;
      if (!m.ids.every(isStrokeId)) return null;
      return { op: "erase", docId: m.docId, page: m.page, ids: m.ids as string[] };
    }
    case "clear":
      if (m.page !== null && !isPage(m.page)) return null;
      return { op: "clear", docId: m.docId, page: m.page as number | null };
    default:
      return null;
  }
}

/** Distance d'un point au segment [a, b]. */
function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Gomme : le trait passe-t-il à moins de `tolerance` du point (repère du document) ? */
export function strokeHit(stroke: Stroke, point: NormalizedPoint, tolerance: number): boolean {
  const p = stroke.points;
  const reach = tolerance + stroke.width / 2;
  if (p.length === 2) return Math.hypot(point.x - p[0], point.y - p[1]) <= reach;
  for (let i = 0; i + 3 < p.length; i += 2) {
    if (distanceToSegment(point.x, point.y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) return true;
  }
  return false;
}
