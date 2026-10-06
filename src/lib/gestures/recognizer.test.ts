import { describe, expect, it } from "vitest";
import { GESTURE_CONFIG } from "./constants";
import { GestureRecognizer, type GestureAction } from "./recognizer";
import { IDENTITY_VIEW, screenToPage, type ViewTransform } from "./transform";

const W = 1000;
const H = 800;

/** Simule la remote : applique les actions de vue, collecte les autres. */
function setup(initial: ViewTransform = IDENTITY_VIEW) {
  let view = { ...initial };
  const events: GestureAction[] = [];
  const r = new GestureRecognizer({ width: W, height: H }, () => view);
  const run = (actions: GestureAction[]) => {
    for (const a of actions) {
      if (a.type === "view") view = a.view;
      else if (a.type === "reset") view = { ...IDENTITY_VIEW };
      events.push(a);
    }
  };
  let t = 0;
  return {
    r,
    get view() {
      return view;
    },
    /** Actions autres que vue et curseur */
    commands: () => events.filter((e) => e.type !== "view" && e.type !== "cursor"),
    events,
    tick: (ms: number) => (t += ms),
    down: (id: number, x: number, y: number) => run(r.down(id, x, y, t)),
    move: (id: number, x: number, y: number) => run(r.move(id, x, y)),
    up: (id: number, x: number, y: number) => run(r.up(id, x, y, t)),
    /** Glissé d'un doigt en n étapes */
    drag(id: number, from: [number, number], to: [number, number], ms = 200, steps = 10) {
      this.down(id, ...from);
      for (let i = 1; i <= steps; i++) {
        this.tick(ms / steps);
        this.move(id, from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps);
      }
      this.up(id, ...to);
    },
  };
}

describe("swipe de document (zoom = 1)", () => {
  it("swipe vers la gauche = document suivant, vers la droite = précédent", () => {
    const g = setup();
    g.drag(1, [600, 400], [400, 410]);
    g.tick(500);
    g.drag(1, [400, 400], [650, 380]);
    expect(g.commands().filter((c) => c.type === "document")).toEqual([
      { type: "document", delta: 1 },
      { type: "document", delta: -1 },
    ]);
  });

  it("ignore un glissé trop court, trop lent ou trop vertical", () => {
    const g = setup();
    g.drag(1, [500, 400], [470, 400]);
    g.tick(500);
    g.drag(1, [600, 400], [400, 400], 1500);
    g.tick(500);
    g.drag(1, [500, 200], [420, 500]);
    expect(g.commands().filter((c) => c.type === "document")).toEqual([]);
  });

  it("pas de swipe de document quand la page est zoomée : le doigt déplace la page", () => {
    const g = setup({ zoom: 3, panX: 0, panY: 0 });
    g.drag(1, [600, 400], [400, 400]);
    expect(g.commands().filter((c) => c.type === "document")).toEqual([]);
    // le contenu suit le doigt vers la gauche
    expect(g.view.panX).toBeCloseTo(-200 / W / 3);
  });
});

describe("bandes latérales", () => {
  it("swipe vertical dans une bande = page suivante (bas) / précédente (haut)", () => {
    const g = setup();
    g.drag(1, [20, 200], [25, 450]);
    g.tick(500);
    g.drag(1, [W - 20, 600], [W - 30, 300]);
    expect(g.commands().filter((c) => c.type === "page")).toEqual([
      { type: "page", delta: 1 },
      { type: "page", delta: -1 },
    ]);
  });

  it("un swipe vertical hors des bandes ne change pas de page", () => {
    const g = setup();
    g.drag(1, [500, 200], [500, 500]);
    expect(g.commands().filter((c) => c.type === "page")).toEqual([]);
  });

  it("un swipe horizontal parti d'une bande ne change ni page ni document", () => {
    const g = setup();
    g.drag(1, [20, 400], [300, 400]);
    expect(g.commands().filter((c) => c.type === "page" || c.type === "document")).toEqual([]);
  });
});

describe("double tap", () => {
  it("réinitialise zoom et position", () => {
    const g = setup({ zoom: 4, panX: 0.2, panY: -0.1 });
    g.down(1, 500, 400);
    g.tick(80);
    g.up(1, 502, 401);
    g.tick(150);
    g.down(1, 510, 395);
    g.tick(80);
    g.up(1, 510, 395);
    expect(g.commands().some((c) => c.type === "reset")).toBe(true);
    expect(g.view).toEqual(IDENTITY_VIEW);
  });

  it("deux taps trop espacés ne réinitialisent pas", () => {
    const g = setup({ zoom: 2, panX: 0, panY: 0 });
    g.down(1, 500, 400);
    g.tick(80);
    g.up(1, 500, 400);
    g.tick(GESTURE_CONFIG.doubleTapMs + 200);
    g.down(1, 500, 400);
    g.tick(80);
    g.up(1, 500, 400);
    expect(g.commands().some((c) => c.type === "reset")).toBe(false);
  });
});

describe("pincement", () => {
  it("zoome autour du point focal", () => {
    const g = setup();
    const focal = { x: 700 / W, y: 300 / H };
    const pageUnderFocal = screenToPage(g.view, focal);
    g.down(1, 650, 300);
    g.down(2, 750, 300);
    for (let i = 1; i <= 10; i++) {
      g.move(1, 650 - i * 5, 300);
      g.move(2, 750 + i * 5, 300);
    }
    // écart 100 → 200 : zoom ×2
    expect(g.view.zoom).toBeCloseTo(2);
    const after = screenToPage(g.view, focal);
    expect(after.x).toBeCloseTo(pageUnderFocal.x);
    expect(after.y).toBeCloseTo(pageUnderFocal.y);
    g.up(1, 600, 300);
    g.up(2, 800, 300);
    // aucun tap / swipe parasite
    expect(g.commands()).toEqual([{ type: "end" }]);
  });

  it("respecte le zoom max et min", () => {
    const g = setup();
    g.down(1, 490, 400);
    g.down(2, 510, 400);
    g.move(1, 0, 400);
    g.move(2, 1000, 400); // ×50
    expect(g.view.zoom).toBe(GESTURE_CONFIG.zoomMax);
    g.move(1, 499, 400);
    g.move(2, 501, 400); // très petit écart
    expect(g.view.zoom).toBe(GESTURE_CONFIG.zoomMin);
    expect(g.view.panX).toBe(0);
  });

  it("glisser à deux doigts déplace la page zoomée", () => {
    const g = setup({ zoom: 2, panX: 0, panY: 0 });
    g.down(1, 400, 400);
    g.down(2, 600, 400);
    g.move(1, 400, 480);
    g.move(2, 600, 480);
    expect(g.view.zoom).toBeCloseTo(2);
    expect(g.view.panY).toBeGreaterThan(0);
  });

  it("après le pincement, le doigt restant continue de déplacer la page", () => {
    const g = setup();
    g.down(1, 450, 400);
    g.down(2, 550, 400);
    g.move(1, 350, 400);
    g.move(2, 650, 400); // zoom ×3
    g.up(2, 650, 400);
    const before = g.view.panX;
    g.move(1, 300, 400);
    expect(g.view.panX).toBeLessThan(before);
    g.up(1, 300, 400);
    expect(g.commands().filter((c) => c.type === "document")).toEqual([]);
  });
});

describe("fin de geste et curseur", () => {
  it("émet le curseur pendant le geste puis null et end", () => {
    const g = setup();
    g.drag(1, [500, 400], [520, 400]);
    const cursors = g.events.filter((e) => e.type === "cursor");
    expect(cursors[0]).toEqual({ type: "cursor", point: { x: 0.5, y: 0.5 } });
    expect(cursors.at(-1)).toEqual({ type: "cursor", point: null });
    expect(g.events.at(-1)).toEqual({ type: "end" });
  });

  it("le curseur désigne le point de la page sous le doigt", () => {
    const g = setup({ zoom: 2, panX: 0.1, panY: 0 });
    g.down(1, 500, 400);
    const cursor = g.events.find((e) => e.type === "cursor");
    expect(cursor).toEqual({ type: "cursor", point: { x: 0.4, y: 0.5 } });
  });
});
