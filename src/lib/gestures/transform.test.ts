import { describe, expect, it } from "vitest";
import {
  clampView,
  clampZoom,
  IDENTITY_VIEW,
  maxPan,
  pageToScreen,
  panBy,
  screenToPage,
  zoomAt,
} from "./transform";

describe("clampZoom", () => {
  it("borne entre 1 et 6", () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(3)).toBe(3);
    expect(clampZoom(10)).toBe(6);
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});

describe("clampView", () => {
  it("pas de déplacement possible à zoom 1", () => {
    expect(clampView({ zoom: 1, panX: 0.3, panY: -0.2 })).toEqual(IDENTITY_VIEW);
  });

  it("limite le déplacement pour garder la page à l'écran", () => {
    expect(maxPan(2)).toBeCloseTo(0.25);
    expect(clampView({ zoom: 2, panX: 0.4, panY: -0.4 })).toEqual({ zoom: 2, panX: 0.25, panY: -0.25 });
    expect(clampView({ zoom: 2, panX: 0.1, panY: 0 })).toEqual({ zoom: 2, panX: 0.1, panY: 0 });
  });

  it("au zoom max, le centre de la fenêtre peut atteindre près du bord de la page", () => {
    const v = clampView({ zoom: 6, panX: 1, panY: 1 });
    // point au centre de l'écran = 0.5 - pan
    expect(0.5 - v.panX).toBeCloseTo(1 / 12);
  });
});

describe("zoomAt", () => {
  it("garde le point focal immobile", () => {
    const view = { zoom: 1.5, panX: 0.05, panY: -0.02 };
    const focal = { x: 0.8, y: 0.3 };
    const before = screenToPage(view, focal);
    const after = screenToPage(zoomAt(view, focal, 1.6), focal);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("zoom centré : pas de déplacement", () => {
    expect(zoomAt(IDENTITY_VIEW, { x: 0.5, y: 0.5 }, 2)).toEqual({ zoom: 2, panX: 0, panY: 0 });
  });

  it("respecte le zoom max", () => {
    expect(zoomAt({ zoom: 5, panX: 0, panY: 0 }, { x: 0.5, y: 0.5 }, 3).zoom).toBe(6);
  });

  it("dézoomer jusqu'à 1 recentre la page", () => {
    expect(zoomAt({ zoom: 2, panX: 0.2, panY: -0.1 }, { x: 0.2, y: 0.9 }, 0.1)).toEqual(IDENTITY_VIEW);
  });
});

describe("panBy", () => {
  it("le contenu suit le doigt : un décalage écran déplace la page du même écart à l'écran", () => {
    const view = { zoom: 2, panX: 0, panY: 0 };
    const p = { x: 0.5, y: 0.5 };
    const before = pageToScreen(view, p);
    const after = pageToScreen(panBy(view, 0.1, -0.05), p);
    expect(after.x - before.x).toBeCloseTo(0.1);
    expect(after.y - before.y).toBeCloseTo(-0.05);
  });

  it("est borné", () => {
    expect(panBy({ zoom: 2, panX: 0, panY: 0 }, 5, 5)).toEqual({ zoom: 2, panX: 0.25, panY: 0.25 });
  });
});

describe("screenToPage / pageToScreen", () => {
  it("sont inverses", () => {
    const view = { zoom: 3.2, panX: 0.1, panY: -0.2 };
    const s = { x: 0.3, y: 0.7 };
    const back = pageToScreen(view, screenToPage(view, s));
    expect(back.x).toBeCloseTo(s.x);
    expect(back.y).toBeCloseTo(s.y);
  });
});
