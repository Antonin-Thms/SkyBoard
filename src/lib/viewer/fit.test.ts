import { describe, expect, it } from "vitest";
import { capRenderScale, clampPage, fitScale } from "./fit";

describe("fitScale", () => {
  it("ajuste une page portrait dans une fenêtre paysage (limité par la hauteur)", () => {
    expect(fitScale({ width: 1600, height: 900 }, { width: 595, height: 842 })).toBeCloseTo(900 / 842);
  });

  it("ajuste une page paysage dans une fenêtre portrait (limité par la largeur)", () => {
    expect(fitScale({ width: 800, height: 1200 }, { width: 1000, height: 500 })).toBe(0.8);
  });

  it("renvoie 0 pour des tailles nulles", () => {
    expect(fitScale({ width: 0, height: 900 }, { width: 10, height: 10 })).toBe(0);
    expect(fitScale({ width: 100, height: 100 }, { width: 0, height: 10 })).toBe(0);
  });
});

describe("capRenderScale", () => {
  it("ne change rien sous la limite", () => {
    expect(capRenderScale({ width: 100, height: 100 }, 2, 1e6)).toBe(2);
  });

  it("réduit l'échelle au-delà de la limite", () => {
    const s = capRenderScale({ width: 1000, height: 1000 }, 10, 4e6);
    expect(s).toBeCloseTo(2);
    expect(1000 * 1000 * s * s).toBeLessThanOrEqual(4e6 + 1);
  });
});

describe("clampPage", () => {
  it("borne la page", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
    expect(clampPage(Number.NaN, 5)).toBe(1);
    expect(clampPage(2, 0)).toBe(1);
  });
});
