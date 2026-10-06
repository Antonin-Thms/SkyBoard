export interface Size {
  width: number;
  height: number;
}

/** Échelle pour faire tenir entièrement la page dans le conteneur ("fit"). */
export function fitScale(container: Size, page: Size): number {
  if (page.width <= 0 || page.height <= 0 || container.width <= 0 || container.height <= 0) {
    return 0;
  }
  return Math.min(container.width / page.width, container.height / page.height);
}

/**
 * Limite le nombre de pixels d'un canvas (mémoire GPU, limites navigateur) :
 * renvoie l'échelle de rendu effective à appliquer.
 */
export function capRenderScale(page: Size, scale: number, maxPixels: number): number {
  const pixels = page.width * page.height * scale * scale;
  if (pixels <= maxPixels) return scale;
  return Math.sqrt(maxPixels / (page.width * page.height));
}

export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.round(page)), Math.max(1, pageCount));
}
