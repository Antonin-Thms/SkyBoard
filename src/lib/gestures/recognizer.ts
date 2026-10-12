import type { NormalizedPoint } from "@/lib/sync/protocol";
import { GESTURE_CONFIG, type GestureConfig } from "./constants";
import { panBy, screenToPage, zoomAt, type ViewTransform } from "./transform";

/** Actions produites par le reconnaisseur, appliquées par la remote. */
export type GestureAction =
  | { type: "view"; view: ViewTransform }
  | { type: "document"; delta: 1 | -1 }
  /** Favori suivant (swipe vers le haut) / précédent (vers le bas) */
  | { type: "favorite"; delta: 1 | -1 }
  | { type: "reset" }
  /** Point de la page sous le doigt (null : plus de doigt) */
  | { type: "cursor"; point: NormalizedPoint | null }
  /** Crayon activé / désactivé (appui long sans bouger) */
  | { type: "pen"; on: boolean }
  /** Crayon : trait commencé, prolongé, terminé ou abandonné (point de la page affichée) */
  | { type: "ink"; phase: "start" | "move"; point: NormalizedPoint }
  | { type: "ink"; phase: "end" | "cancel" }
  /** Crayon : pointe posée (le casque montre où le trait va partir) ou relevée */
  | { type: "inkArmed"; armed: boolean }
  /** Crayon : annuler le dernier trait (tap à deux doigts) */
  | { type: "undo" }
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
  /** Plus grand écart depuis l'appui (appui long, tap à deux doigts) */
  maxMove: number;
  /** Crayon : dernière position où le doigt s'est arrêté, et depuis quand */
  stillX: number;
  stillY: number;
  stillT: number;
}

type Mode =
  /** Un doigt, en attente : tap, swipe (document / favori) ou pan selon la suite */
  | "single"
  /** Un doigt qui déplace la page zoomée */
  | "pan"
  /** Crayon : un doigt vise (le curseur suit dans le casque), rien ne s'écrit */
  | "ink-aim"
  /** Crayon : doigt arrêté assez longtemps, pointe posée : le prochain mouvement écrit */
  | "ink-armed"
  /** Crayon : trait en cours */
  | "ink"
  /** Deux doigts : pincement + déplacement */
  | "pinch"
  /** Geste multi-doigts terminé partiellement, ou appui long consommé : on attend que tout soit levé */
  | "settling";

/**
 * Reconnaissance des gestes du mode vol à partir de Pointer Events.
 * Pure (aucune dépendance au DOM) : les positions sont en px CSS de la
 * surface, le temps en ms. `getView` fournit la vue courante.
 *
 * Crayon : un appui long sans bouger (n'importe où) l'active ou le désactive.
 * Crayon actif (« viser, puis écrire », utilisable sans regarder) : le doigt
 * posé déplace seulement le curseur du casque ; arrêté `inkArmMs`, il pose la
 * pointe (le casque le montre) et le mouvement suivant écrit à cet endroit.
 * Deux doigts zooment / déplacent, un tap à deux doigts annule le dernier
 * trait ; les swipes sont désactivés.
 * Appui long et pointe posée sont détectés par `poll`, appelé régulièrement
 * par un minuteur de l'interface tant qu'un doigt est posé.
 */
export class GestureRecognizer {
  private pointers = new Map<number, Pointer>();
  private mode: Mode | null = null;
  private lastTap: { x: number; y: number; t: number } | null = null;
  private pinchPrev: { dist: number; mid: { x: number; y: number } } | null = null;
  /** Début du geste à deux doigts (tap à deux doigts) */
  private pinchStartT = 0;
  private config: GestureConfig;
  private penOn = false;
  /** Appui long consommé : plus rien jusqu'au relâcher de tous les doigts. */
  private holdConsumed = false;
  /** Point où la pointe est posée (mode ink-armed) */
  private armed: { x: number; y: number } | null = null;

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

  get pen(): boolean {
    return this.penOn;
  }

  /** Force l'état du crayon (ex. sortie du mode vol). */
  setPen(on: boolean) {
    this.penOn = on;
  }

  down(id: number, x: number, y: number, t: number): GestureAction[] {
    if (this.pointers.size >= 2) return []; // 3e doigt et plus : ignorés
    this.pointers.set(id, { x, y, startX: x, startY: y, startT: t, maxMove: 0, stillX: x, stillY: y, stillT: t });

    if (this.pointers.size === 1) {
      if (this.penOn) this.mode = "ink-aim";
      else this.mode = "single";
      return [this.cursorAt(x, y)];
    }

    // Deuxième doigt : pincement (annule tap / swipe / trait en cours).
    const actions: GestureAction[] = [];
    if (this.mode === "ink") actions.push({ type: "ink", phase: "cancel" });
    actions.push(...this.disarm());
    // Après un appui long consommé, plus rien jusqu'au relâcher complet.
    this.mode = this.holdConsumed ? "settling" : "pinch";
    this.lastTap = null;
    this.pinchStartT = t;
    this.pinchPrev = this.pinchMetrics();
    const mid = this.pinchPrev.mid;
    actions.push(this.cursorAt(mid.x, mid.y));
    return actions;
  }

  move(id: number, x: number, y: number, t: number): GestureAction[] {
    const p = this.pointers.get(id);
    if (!p) return [];
    // Le doigt repart : nouvelle position d'arrêt (pointe posée après `inkArmMs` immobile).
    if (Math.hypot(x - p.stillX, y - p.stillY) > this.config.inkArmSlopPx) {
      p.stillX = x;
      p.stillY = y;
      p.stillT = t;
    }
    const prevX = p.x;
    const prevY = p.y;
    p.x = x;
    p.y = y;
    p.maxMove = Math.max(p.maxMove, Math.hypot(x - p.startX, y - p.startY));

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

      case "ink-aim":
        return [this.cursorAt(x, y)];

      case "ink-armed": {
        const a = this.armed!;
        if (Math.hypot(x - a.x, y - a.y) <= this.config.inkStartSlopPx) return [this.cursorAt(x, y)];
        // Le trait part de l'endroit visé (là où la pointe a été posée).
        this.mode = "ink";
        return [
          this.cursorAt(x, y),
          { type: "ink", phase: "start", point: this.pageAt(a.x, a.y) },
          { type: "ink", phase: "move", point: this.pageAt(x, y) },
        ];
      }

      case "ink":
        return [this.cursorAt(x, y), { type: "ink", phase: "move", point: this.pageAt(x, y) }];

      case "settling":
        // Après un pincement, le doigt restant déplace la page si elle est zoomée.
        if (this.pointers.size === 1 && this.isZoomed() && !this.holdConsumed) {
          return [this.panAction(x - prevX, y - prevY), this.cursorAt(x, y)];
        }
        return [this.cursorAt(x, y)];

      default:
        return [this.cursorAt(x, y)];
    }
  }

  /**
   * À appeler régulièrement (minuteur) tant qu'un doigt est posé :
   * - appui long (un doigt immobile depuis l'appui, `penHoldMs`) → bascule le crayon ;
   * - crayon, doigt arrêté `inkArmMs` → pointe posée à cet endroit.
   */
  poll(t: number): GestureAction[] {
    if (this.pointers.size !== 1) return [];
    if (this.mode !== "single" && this.mode !== "ink-aim" && this.mode !== "ink-armed") return [];
    const [p] = this.pointers.values();
    if (p.maxMove <= this.config.penHoldSlopPx && t - p.startT >= this.config.penHoldMs) {
      const actions = this.disarm();
      this.penOn = !this.penOn;
      this.mode = "settling";
      this.holdConsumed = true;
      this.lastTap = null;
      return [...actions, { type: "pen", on: this.penOn }];
    }
    if (this.mode === "ink-aim" && t - p.stillT >= this.config.inkArmMs) {
      this.mode = "ink-armed";
      this.armed = { x: p.x, y: p.y };
      return [{ type: "inkArmed", armed: true }];
    }
    return [];
  }

  up(id: number, x: number, y: number, t: number): GestureAction[] {
    const p = this.pointers.get(id);
    if (!p) return [];
    p.x = x;
    p.y = y;
    const actions: GestureAction[] = [];

    if (this.pointers.size === 1) {
      if (this.mode === "single") actions.push(...this.finishSingle(p, t));
      if (this.mode === "ink") actions.push({ type: "ink", phase: "end" });
      if (this.mode === "ink-armed" && this.armed) {
        // Pointe posée puis levée sans bouger : un point (décimales, ponctuation…).
        const point = this.pageAt(this.armed.x, this.armed.y);
        actions.push({ type: "ink", phase: "start", point }, { type: "ink", phase: "end" });
      }
      // ink-aim : doigt levé sans s'arrêter → rien n'est écrit.
      actions.push(...this.disarm());
      this.pointers.delete(id);
      this.mode = null;
      this.pinchPrev = null;
      this.holdConsumed = false;
      actions.push({ type: "cursor", point: null }, { type: "end" });
      return actions;
    }

    // Tap à deux doigts (crayon actif) : annuler le dernier trait.
    if (
      this.penOn &&
      this.mode === "pinch" &&
      t - this.pinchStartT <= this.config.twoFingerTapMs &&
      [...this.pointers.values()].every((q) => q.maxMove <= this.config.tapSlopPx)
    ) {
      actions.push({ type: "undo" });
    }

    // Un des deux doigts se lève : on continue avec l'autre, sans tap ni swipe.
    this.pointers.delete(id);
    this.mode = "settling";
    this.pinchPrev = null;
    const [rest] = this.pointers.values();
    actions.push(this.cursorAt(rest.x, rest.y));
    return actions;
  }

  /** Pointeur annulé par le système : on abandonne le geste sans action. */
  cancel(id: number): GestureAction[] {
    if (!this.pointers.delete(id)) return [];
    const actions: GestureAction[] = this.mode === "ink" ? [{ type: "ink", phase: "cancel" }] : [];
    actions.push(...this.disarm());
    if (this.pointers.size > 0) {
      this.mode = "settling";
      this.pinchPrev = null;
      return actions;
    }
    this.mode = null;
    this.pinchPrev = null;
    this.holdConsumed = false;
    return [...actions, { type: "cursor", point: null }, { type: "end" }];
  }

  // --- Détails ----------------------------------------------------------

  /** Relève la pointe (fin de trait, second doigt, crayon désactivé…). */
  private disarm(): GestureAction[] {
    if (!this.armed) return [];
    this.armed = null;
    return [{ type: "inkArmed", armed: false }];
  }

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

    // Swipes à zoom 1 (un kneeboard = un document dans l'immense majorité des cas) :
    // - horizontal : vers la gauche = document suivant (comme on tourne une page) ;
    // - vertical : vers le haut = favori suivant, vers le bas = précédent.
    if (this.isZoomed() || duration > c.swipeMaxMs) return [];
    if (Math.abs(dx) >= c.swipeMinPx && Math.abs(dx) >= Math.abs(dy) * c.swipeDirectionRatio) {
      return [{ type: "document", delta: dx < 0 ? 1 : -1 }];
    }
    if (Math.abs(dy) >= c.swipeMinPx && Math.abs(dy) >= Math.abs(dx) * c.swipeDirectionRatio) {
      return [{ type: "favorite", delta: dy < 0 ? 1 : -1 }];
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

  /** Point de la page (affichée) sous une position de la surface. */
  private pageAt(x: number, y: number, view: ViewTransform = this.getView()): NormalizedPoint {
    return screenToPage(view, { x: x / this.surface.width, y: y / this.surface.height });
  }

  private cursorAt(x: number, y: number, view: ViewTransform = this.getView()): GestureAction {
    return { type: "cursor", point: this.pageAt(x, y, view) };
  }

  private isZoomed(): boolean {
    return this.getView().zoom > this.config.zoomMin + this.config.zoomEpsilon;
  }

  private movedBeyond(p: Pointer, slop: number): boolean {
    return Math.hypot(p.x - p.startX, p.y - p.startY) > slop;
  }
}
