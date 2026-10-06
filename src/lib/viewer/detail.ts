import type { ViewTransform } from "@/lib/gestures/transform";
import type { Size } from "./fit";

/** Rectangle en coordonnées normalisées de la page (0..1). */
export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** En dessous de ce zoom, le rendu de base (ajusté à la fenêtre) suffit. */
export const DETAIL_MIN_ZOOM = 1.15;
/** Marge rendue autour de la zone visible (fraction de sa taille, de chaque côté). */
export const DETAIL_MARGIN = 0.35;
/** Délai de stabilité du zoom / déplacement avant le rendu haute résolution (ms). */
export const DETAIL_DEBOUNCE_MS = 200;
/** On garde une tuile tant que sa résolution vaut au moins cette fraction de l'idéal. */
export const DETAIL_MIN_RESOLUTION_RATIO = 0.85;

/**
 * Partie de la page visible dans le conteneur pour une vue donnée.
 * `page` est la taille de la page ajustée (zoom 1) en px CSS.
 */
export function visiblePageRect(view: ViewTransform, page: Size, container: Size): PageRect | null {
  if (page.width <= 0 || page.height <= 0) return null;
  const halfW = container.width / (2 * page.width * view.zoom);
  const halfH = container.height / (2 * page.height * view.zoom);
  const cx = 0.5 - view.panX;
  const cy = 0.5 - view.panY;
  return clampRect({ x: cx - halfW, y: cy - halfH, width: 2 * halfW, height: 2 * halfH });
}

/** Agrandit un rectangle d'une marge relative, borné à la page. */
export function expandRect(rect: PageRect, margin: number): PageRect {
  const mx = rect.width * margin;
  const my = rect.height * margin;
  return clampRect({ x: rect.x - mx, y: rect.y - my, width: rect.width + 2 * mx, height: rect.height + 2 * my })!;
}

export function clampRect(rect: PageRect): PageRect | null {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(1, rect.x + rect.width);
  const y1 = Math.min(1, rect.y + rect.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function rectContains(outer: PageRect, inner: PageRect, epsilon = 1e-6): boolean {
  return (
    inner.x >= outer.x - epsilon &&
    inner.y >= outer.y - epsilon &&
    inner.x + inner.width <= outer.x + outer.width + epsilon &&
    inner.y + inner.height <= outer.y + outer.height + epsilon
  );
}

export interface DetailTile {
  rect: PageRect;
  /** Zoom pour lequel la tuile a été rendue */
  zoom: number;
}

/** La tuile actuelle suffit-elle pour cette vue (couverture et résolution) ? */
export function tileIsSufficient(tile: DetailTile | null, visible: PageRect, zoom: number): boolean {
  return (
    tile !== null &&
    rectContains(tile.rect, visible) &&
    tile.zoom >= zoom * DETAIL_MIN_RESOLUTION_RATIO
  );
}
