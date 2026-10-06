import { describe, expect, it } from "vitest";
import { expandRect, rectContains, tileIsSufficient, visiblePageRect } from "./detail";

const page = { width: 600, height: 800 };
const container = { width: 1000, height: 800 };

describe("visiblePageRect", () => {
  it("zoom 1 : toute la page est visible", () => {
    expect(visiblePageRect({ zoom: 1, panX: 0, panY: 0 }, page, container)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("zoom 4 centré : le quart central (en hauteur)", () => {
    const r = visiblePageRect({ zoom: 4, panX: 0, panY: 0 }, page, container)!;
    expect(r.height).toBeCloseTo(0.25);
    expect(r.y).toBeCloseTo(0.375);
    // la fenêtre est plus large que la page : plus de largeur visible
    expect(r.width).toBeCloseTo(1000 / (600 * 4));
  });

  it("suit le déplacement", () => {
    const r = visiblePageRect({ zoom: 4, panX: 0.3, panY: -0.3 }, page, container)!;
    expect(r.y + r.height / 2).toBeCloseTo(0.8);
    expect(r.x).toBe(0);
  });
});

describe("expandRect", () => {
  it("ajoute une marge bornée à la page", () => {
    const e = expandRect({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, 0.5);
    expect(e.x).toBeCloseTo(0.3);
    expect(e.y).toBeCloseTo(0.3);
    expect(e.width).toBeCloseTo(0.4);
    expect(e.height).toBeCloseTo(0.4);
    const r = expandRect({ x: 0.9, y: 0, width: 0.1, height: 0.1 }, 1);
    expect(r.x + r.width).toBe(1);
    expect(r.y).toBe(0);
  });
});

describe("tileIsSufficient", () => {
  const visible = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 };
  it("garde une tuile qui couvre la zone à une résolution suffisante", () => {
    const tile = { rect: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 }, zoom: 4 };
    expect(rectContains(tile.rect, visible)).toBe(true);
    expect(tileIsSufficient(tile, visible, 4)).toBe(true);
    expect(tileIsSufficient(tile, visible, 3)).toBe(true); // dézoom : la tuile reste nette
  });

  it("re-rend si on sort de la tuile ou si on zoome nettement plus", () => {
    const tile = { rect: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 }, zoom: 4 };
    expect(tileIsSufficient(tile, { ...visible, x: 0.6 }, 4)).toBe(false);
    expect(tileIsSufficient(tile, visible, 6)).toBe(false);
    expect(tileIsSufficient(null, visible, 2)).toBe(false);
  });
});
