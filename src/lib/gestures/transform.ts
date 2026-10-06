import type { NormalizedPoint } from "@/lib/sync/protocol";
import { GESTURE_CONFIG } from "./constants";

/**
 * Modèle de vue partagé par la remote et le viewer.
 *
 * La page (ajustée à la fenêtre) est agrandie de `zoom` autour du centre de
 * la fenêtre puis décalée. `panX`/`panY` sont exprimés en fraction de la
 * page : le point de la page au centre de la fenêtre est (0.5 - panX,
 * 0.5 - panY). Une position écran normalisée s (0..1) correspond donc au
 * point de page u = 0.5 + (s - 0.5) / zoom - pan.
 */
export interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export const IDENTITY_VIEW: ViewTransform = { zoom: 1, panX: 0, panY: 0 };

interface Bounds {
  zoomMin: number;
  zoomMax: number;
}

const DEFAULT_BOUNDS: Bounds = GESTURE_CONFIG;

export function clampZoom(zoom: number, bounds: Bounds = DEFAULT_BOUNDS): number {
  if (!Number.isFinite(zoom)) return bounds.zoomMin;
  return Math.min(bounds.zoomMax, Math.max(bounds.zoomMin, zoom));
}

/** Déplacement max sur un axe : le bord de la page ne dépasse pas le bord de la fenêtre. */
export function maxPan(zoom: number): number {
  return Math.max(0, 0.5 - 0.5 / zoom);
}

/** Applique les bornes : zoom [min, max], pan limité pour garder la page à l'écran. */
export function clampView(view: ViewTransform, bounds: Bounds = DEFAULT_BOUNDS): ViewTransform {
  const zoom = clampZoom(view.zoom, bounds);
  const limit = maxPan(zoom);
  // "+ 0" normalise -0 en 0.
  const clampAxis = (v: number) =>
    Number.isFinite(v) ? Math.min(limit, Math.max(-limit, v)) + 0 : 0;
  return { zoom, panX: clampAxis(view.panX), panY: clampAxis(view.panY) };
}

/**
 * Zoom d'un facteur autour d'un point focal (coordonnées écran normalisées) :
 * le point de la page sous le focal reste sous le focal.
 */
export function zoomAt(
  view: ViewTransform,
  focal: NormalizedPoint,
  factor: number,
  bounds: Bounds = DEFAULT_BOUNDS,
): ViewTransform {
  const zoom = clampZoom(view.zoom * factor, bounds);
  const k = 1 / zoom - 1 / view.zoom;
  return clampView(
    {
      zoom,
      panX: view.panX + (focal.x - 0.5) * k,
      panY: view.panY + (focal.y - 0.5) * k,
    },
    bounds,
  );
}

/** Déplacement d'un delta écran normalisé (fraction de la largeur / hauteur de l'écran). */
export function panBy(
  view: ViewTransform,
  dx: number,
  dy: number,
  bounds: Bounds = DEFAULT_BOUNDS,
): ViewTransform {
  return clampView({ ...view, panX: view.panX + dx / view.zoom, panY: view.panY + dy / view.zoom }, bounds);
}

/** Point de la page (0..1) situé sous une position écran normalisée. */
export function screenToPage(view: ViewTransform, screen: NormalizedPoint): NormalizedPoint {
  return {
    x: 0.5 + (screen.x - 0.5) / view.zoom - view.panX,
    y: 0.5 + (screen.y - 0.5) / view.zoom - view.panY,
  };
}

/** Position écran normalisée d'un point de la page (inverse de screenToPage). */
export function pageToScreen(view: ViewTransform, page: NormalizedPoint): NormalizedPoint {
  return {
    x: 0.5 + (page.x - 0.5 + view.panX) * view.zoom,
    y: 0.5 + (page.y - 0.5 + view.panY) * view.zoom,
  };
}
