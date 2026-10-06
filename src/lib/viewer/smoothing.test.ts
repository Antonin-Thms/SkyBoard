import { describe, expect, it } from "vitest";
import { smoothingAlpha, smoothView } from "./smoothing";

const TAU = 70;

describe("smoothingAlpha", () => {
  it("vaut 0 sans temps écoulé et tend vers 1", () => {
    expect(smoothingAlpha(0, TAU)).toBe(0);
    expect(smoothingAlpha(1000, TAU)).toBeGreaterThan(0.99);
  });

  it("est indépendant du nombre d'images par seconde", () => {
    // 2 frames de 8 ms ≡ 1 frame de 16 ms
    const twoSteps = 1 - (1 - smoothingAlpha(8, TAU)) ** 2;
    expect(twoSteps).toBeCloseTo(smoothingAlpha(16, TAU));
  });
});

describe("smoothView", () => {
  it("converge vers la cible sans la dépasser", () => {
    let view = { zoom: 1, panX: 0, panY: 0 };
    const target = { zoom: 4, panX: 0.2, panY: -0.1 };
    let done = false;
    let frames = 0;
    while (!done && frames < 500) {
      const prev = view;
      ({ view, done } = smoothView(view, target, 16, TAU));
      expect(view.zoom).toBeGreaterThanOrEqual(prev.zoom);
      expect(view.zoom).toBeLessThanOrEqual(4);
      frames++;
    }
    expect(done).toBe(true);
    expect(view).toEqual(target);
    // ≈ 1 s pour converger avec tau = 70 ms
    expect(frames).toBeLessThan(80);
  });

  it("interpole le zoom en logarithme (mi-chemin de ×1 à ×4 = ×2)", () => {
    const a = smoothView({ zoom: 1, panX: 0, panY: 0 }, { zoom: 4, panX: 0, panY: 0 }, TAU * Math.LN2, TAU);
    expect(a.view.zoom).toBeCloseTo(2);
  });

  it("reste fluide quand les messages arrivent irrégulièrement (la cible change en cours de route)", () => {
    let view = { zoom: 1, panX: 0, panY: 0 };
    const positions: number[] = [];
    for (let f = 0; f < 60; f++) {
      // cible qui avance par à-coups (messages groupés)
      const target = { zoom: 2, panX: Math.floor(f / 10) * 0.02, panY: 0 };
      ({ view } = smoothView(view, target, 16, TAU));
      positions.push(view.panX);
    }
    const steps = positions.slice(1).map((p, i) => p - positions[i]);
    expect(Math.max(...steps)).toBeLessThan(0.01);
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(0);
  });
});
