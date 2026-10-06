import type { ViewTransform } from "@/lib/gestures/transform";
import type { NormalizedPoint } from "@/lib/sync/protocol";

/** Écart en dessous duquel on considère la cible atteinte. */
const ZOOM_LOG_EPSILON = 1e-4;
const PAN_EPSILON = 1e-5;

/** Fraction du chemin à parcourir en dt ms (indépendante du nombre d'images/s). */
export function smoothingAlpha(dtMs: number, tauMs: number): number {
  if (tauMs <= 0) return 1;
  return 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
}

/**
 * Rapproche la vue affichée de la vue cible (interpolation exponentielle).
 * Le zoom est interpolé en logarithme : un zoom ×2 → ×4 a la même allure
 * qu'un ×1 → ×2. Renvoie `done` quand la cible est atteinte.
 */
export function smoothView(
  current: ViewTransform,
  target: ViewTransform,
  dtMs: number,
  tauMs: number,
): { view: ViewTransform; done: boolean } {
  const a = smoothingAlpha(dtMs, tauMs);
  const logCur = Math.log(current.zoom);
  const logTarget = Math.log(target.zoom);
  const logZoom = logCur + (logTarget - logCur) * a;
  const panX = current.panX + (target.panX - current.panX) * a;
  const panY = current.panY + (target.panY - current.panY) * a;

  const done =
    Math.abs(logTarget - logZoom) < ZOOM_LOG_EPSILON &&
    Math.abs(target.panX - panX) < PAN_EPSILON &&
    Math.abs(target.panY - panY) < PAN_EPSILON;
  return done ? { view: { ...target }, done } : { view: { zoom: Math.exp(logZoom), panX, panY }, done };
}

export function smoothPoint(
  current: NormalizedPoint,
  target: NormalizedPoint,
  dtMs: number,
  tauMs: number,
): { point: NormalizedPoint; done: boolean } {
  const a = smoothingAlpha(dtMs, tauMs);
  const x = current.x + (target.x - current.x) * a;
  const y = current.y + (target.y - current.y) * a;
  const done = Math.abs(target.x - x) < PAN_EPSILON && Math.abs(target.y - y) < PAN_EPSILON;
  return { point: done ? { ...target } : { x, y }, done };
}
