/**
 * Réglages des gestes du mode vol. Tous les seuils sont ici pour être
 * ajustés facilement (distances en px CSS de l'écran de la remote).
 */
export const GESTURE_CONFIG = {
  /** Zoom minimal (1 = page entière ajustée à la fenêtre) */
  zoomMin: 1,
  /** Zoom maximal */
  zoomMax: 6,
  /** En dessous de zoomMin + zoomEpsilon, on considère que la page n'est pas zoomée */
  zoomEpsilon: 0.02,

  /** Largeur des bandes latérales (page précédente / suivante) */
  edgeWidthPx: 56,
  /** Distance verticale minimale d'un swipe dans une bande latérale */
  edgeSwipeMinPx: 60,

  /** Tolérance de mouvement pour qu'un appui reste un « tap » */
  tapSlopPx: 12,
  /** Durée max d'un tap */
  tapMaxMs: 250,
  /** Délai max entre les deux taps d'un double tap */
  doubleTapMs: 320,
  /** Distance max entre les deux taps d'un double tap */
  doubleTapSlopPx: 48,

  /** Distance horizontale minimale d'un swipe de document (zoom = 1) */
  swipeMinPx: 60,
  /** Durée max d'un swipe de document */
  swipeMaxMs: 700,
  /** Le déplacement principal doit dominer l'autre axe de ce facteur */
  swipeDirectionRatio: 1.5,

  /** Appui long sans bouger (n'importe où) : active / désactive le crayon */
  penHoldMs: 1500,
  /** Tolérance de mouvement de l'appui long (le doigt tremble un peu) */
  penHoldSlopPx: 10,
  /** Crayon : le trait commence quand le doigt a bougé de cette distance (sinon : un point) */
  inkStartSlopPx: 8,
  /** Crayon : tap à deux doigts (annuler le dernier trait), durée max */
  twoFingerTapMs: 350,
} as const;

export type GestureConfig = { -readonly [K in keyof typeof GESTURE_CONFIG]: number };

/**
 * Ajustements par type d'appareil (fusionnés avec GESTURE_CONFIG).
 * Sur téléphone, l'écran est plus petit : bandes et distances réduites.
 */
export const DEVICE_GESTURE_OVERRIDES: Record<"phone" | "tablet" | "desktop", Partial<GestureConfig>> = {
  phone: { edgeWidthPx: 40, edgeSwipeMinPx: 45, swipeMinPx: 45, doubleTapSlopPx: 40 },
  tablet: {},
  desktop: {},
};

/** Envoi de l'état : intervalle min entre deux messages pendant un geste (≈ 30 msg/s). */
export const SEND_INTERVAL_MS = 33;

/**
 * Lissage du viewer : constante de temps de l'interpolation exponentielle
 * vers l'état cible (plus petit = plus réactif, plus grand = plus doux).
 */
export const SMOOTHING_TAU_MS = 35;
