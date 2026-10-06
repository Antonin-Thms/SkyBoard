import type { NormalizedPoint } from "@/lib/sync/protocol";
import { GESTURE_CONFIG, type GestureConfig } from "./constants";
import { panBy, screenToPage, zoomAt, type ViewTransform } from "./transform";

/** Actions produites par le reconnaisseur, appliquées par la remote. */
export type GestureAction =
  | { type: "view"; view: ViewTransform }
  | { type: "page"; delta: 1 | -1 }
  | { type: "document"; delta: 1 | -1 }
  | { type: "reset" }
  /** Point de la page sous le doigt (null : plus de doigt) */
  | { type: "cursor"; point: NormalizedPoint | null }
  /** Fin de geste (tous les doigts levés) : envoi final garanti */
  | { type: "end" };

export interface Size {
  width: number;
  height: number;
}

interface Pointer {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startT: number;
}

type Mode =
  /** Un doigt, en attente : tap, swipe de document ou pan selon la suite */
  | "single"
  /** Un doigt parti d'une bande latérale : swipe vertical = changement de page */
  | "edge"
  /** Un doigt qui déplace la page zoomée */
  | "pan"
  /** Deux doigts : pincement + déplacement */
  | "pinch"
  /** Geste multi-doigts terminé partiellement : on attend que tout soit levé */
  | "settling";

/**
 * Reconnaissance des gestes du mode vol à partir de Pointer Events.
 * Pure (aucune dépendance au DOM) : les positions sont en px CSS de la
 * surface, le temps en ms. `getView` fournit la vue courante.
 */
export class GestureRecognizer {
  private pointers = new Map<number, Pointer>();
  private mode: Mode | null = null;
  private lastTap: { x: number; y: number; t: number } | null = null;
  private pinchPrev: { dist: number; mid: { x: number; y: number } } | null = null;
  private config: GestureConfig;

  constructor(
    private surface: Size,
    private getView: () => ViewTransform,
    config: Partial<GestureConfig> = {},
  ) {
    this.config = { ...GESTURE_CONFIG, ...config };
  }

  setSurface(surface: Size) {
    this.surface = surface;
  }

  get activePointers(): number {
    return this.pointers.size;
  }

  down(id: number, x: number, y: number, t: number): GestureAction[] {
    if (this.pointers.size >= 2) return []; // 3e doigt et plus : ignorés
    this.pointers.set(id, { x, y, startX: x, startY: y, startT: t });

    if (this.pointers.size === 1) {
      this.mode = this.isInEdge(x) ? "edge" : "single";
      return [this.cursorAt(x, y)];
    }

    // Deuxième doigt : pincement (annule tap / swipe / bande latérale).
    this.mode = "pinch";
    this.lastTap = null;
    this.pinchPrev = this.pinchMetrics();
    const mid = this.pinchPrev.mid;
    return [this.cursorAt(mid.x, mid.y)];
  }

  move(id: number, x: number, y: number): GestureAction[] {
    const p = this.pointers.get(id);
    if (!p) return [];
    const prevX = p.x;
    const prevY = p.y;
    p.x = x;
    p.y = y;

    switch (this.mode) {
      case "pinch":
        return this.movePinch();

      case "single": {
        // Page zoomée : un doigt déplace la page dès qu'il sort de la zone de tap.
        if (this.isZoomed() && this.movedBeyond(p, this.config.tapSlopPx)) {
          this.mode = "pan";
          return [this.panAction(x - p.startX, y - p.startY), this.cursorAt(x, y)];
        }
        return [this.cursorAt(x, y)];
      }

      case "pan":
        return [this.panAction(x - prevX, y - prevY), this.cursorAt(x, y)];

      case "settling":
        // Après un pincement, le doigt restant déplace la page si elle est zoomée.
        if (this.isZoomed()) return [this.panAction(x - prevX, y - prevY), this.cursorAt(x, y)];
        return [this.cursorAt(x, y)];

      default:
        return [this.cursorAt(x, y)];
    }
  }

  up(id: number, x: number, y: number, t: number): GestureAction[] {
    const p = this.pointers.get(id);
    if (!p) return [];
    p.x = x;
    p.y = y;
    const actions: GestureAction[] = [];

    if (this.pointers.size === 1) {
      if (this.mode === "single" || this.mode === "edge") actions.push(...this.finishSingle(p, t));
      this.pointers.delete(id);
      this.mode = null;
      this.pinchPrev = null;
      actions.push({ type: "cursor", point: null }, { type: "end" });
      return actions;
    }

    // Un des deux doigts se lève : on continue avec l'autre, sans tap ni swipe.
    this.pointers.delete(id);
    this.mode = "settling";
    this.pinchPrev = null;
    const [rest] = this.pointers.values();
    return [this.cursorAt(rest.x, rest.y)];
  }

  /** Pointeur annulé par le système : on abandonne le geste sans action. */
  cancel(id: number): GestureAction[] {
    if (!this.pointers.delete(id)) return [];
    if (this.pointers.size > 0) {
      this.mode = "settling";
      this.pinchPrev = null;
      return [];
    }
    this.mode = null;
    this.pinchPrev = null;
    return [{ type: "cursor", point: null }, { type: "end" }];
  }

  // --- Détails ----------------------------------------------------------

  private finishSingle(p: Pointer, t: number): GestureAction[] {
    const dx = p.x - p.startX;
    const dy = p.y - p.startY;
    const duration = t - p.startT;
    const c = this.config;

    // Tap (et double tap = réinitialisation)
    if (Math.hypot(dx, dy) <= c.tapSlopPx && duration <= c.tapMaxMs) {
      const prev = this.lastTap;
      if (
        prev &&
        t - prev.t <= c.doubleTapMs &&
        Math.hypot(p.x - prev.x, p.y - prev.y) <= c.doubleTapSlopPx
      ) {
        this.lastTap = null;
        return [{ type: "reset" }];
      }
      this.lastTap = { x: p.x, y: p.y, t };
      return [];
    }
    this.lastTap = null;

    // Bande latérale : swipe vertical = page précédente / suivante (PDF de plusieurs pages)
    if (this.mode === "edge") {
      if (Math.abs(dy) >= c.edgeSwipeMinPx && Math.abs(dy) >= Math.abs(dx) * c.swipeDirectionRatio) {
        return [{ type: "page", delta: dy > 0 ? 1 : -1 }];
      }
      return [];
    }

    // Swipe horizontal à zoom 1 : vers la gauche = document suivant (comme on tourne une page).
    // Un kneeboard = un document dans l'immense majorité des cas.
    if (
      !this.isZoomed() &&
      duration <= c.swipeMaxMs &&
      Math.abs(dx) >= c.swipeMinPx &&
      Math.abs(dx) >= Math.abs(dy) * c.swipeDirectionRatio
    ) {
      return [{ type: "document", delta: dx < 0 ? 1 : -1 }];
    }
    return [];
  }

  private movePinch(): GestureAction[] {
    const prev = this.pinchPrev;
    const next = this.pinchMetrics();
    this.pinchPrev = next;
    if (!prev || prev.dist <= 0 || next.dist <= 0) return [];

    const { width, height } = this.surface;
    let view = this.getView();
    // Zoom autour du point focal courant, puis déplacement du point focal.
    view = zoomAt(view, { x: next.mid.x / width, y: next.mid.y / height }, next.dist / prev.dist, this.config);
    view = panBy(view, (next.mid.x - prev.mid.x) / width, (next.mid.y - prev.mid.y) / height, this.config);
    return [{ type: "view", view }, this.cursorAt(next.mid.x, next.mid.y, view)];
  }

  private pinchMetrics() {
    const [a, b] = [...this.pointers.values()];
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  private panAction(dxPx: number, dyPx: number): GestureAction {
    const view = panBy(this.getView(), dxPx / this.surface.width, dyPx / this.surface.height, this.config);
    return { type: "view", view };
  }

  private cursorAt(x: number, y: number, view: ViewTransform = this.getView()): GestureAction {
    return {
      type: "cursor",
      point: screenToPage(view, { x: x / this.surface.width, y: y / this.surface.height }),
    };
  }

  private isZoomed(): boolean {
    return this.getView().zoom > this.config.zoomMin + this.config.zoomEpsilon;
  }

  private isInEdge(x: number): boolean {
    return x <= this.config.edgeWidthPx || x >= this.surface.width - this.config.edgeWidthPx;
  }

  private movedBeyond(p: Pointer, slop: number): boolean {
    return Math.hypot(p.x - p.startX, p.y - p.startY) > slop;
  }
}
