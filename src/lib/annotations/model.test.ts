import { describe, expect, it } from "vitest";
import type { Rotation } from "@/lib/database.types";
import { parseInkMessage, parseStroke, quantize, strokeHit, toDisplayPoint, toDocumentPoint } from "./model";

const stroke = { id: "abc_123", color: "#d62828" as const, width: 0.004, points: [0.1, 0.2, 0.3, 0.4] };

describe("repères document / affiché", () => {
  it("sont inverses l'un de l'autre pour chaque rotation", () => {
    for (const r of [0, 90, 180, 270] as Rotation[]) {
      const p = { x: 0.2, y: 0.7 };
      const back = toDocumentPoint(toDisplayPoint(p, r), r);
      expect(back.x).toBeCloseTo(p.x);
      expect(back.y).toBeCloseTo(p.y);
    }
  });

  it("tourne dans le sens horaire", () => {
    // Coin haut gauche du document → coin haut droit une fois tourné de 90°.
    expect(toDisplayPoint({ x: 0, y: 0 }, 90)).toEqual({ x: 1, y: 0 });
    expect(toDisplayPoint({ x: 0, y: 0 }, 270)).toEqual({ x: 0, y: 1 });
  });

  it("quantifie et borne", () => {
    expect(quantize(0.123456)).toBe(0.1235);
    expect(quantize(-1)).toBe(0);
    expect(quantize(2)).toBe(1);
  });
});

describe("validation", () => {
  it("accepte un trait valide", () => {
    expect(parseStroke(stroke)).toEqual(stroke);
  });

  it("rejette les traits invalides", () => {
    expect(parseStroke({ ...stroke, color: "red" })).toBeNull();
    expect(parseStroke({ ...stroke, width: 5 })).toBeNull();
    expect(parseStroke({ ...stroke, points: [0.1] })).toBeNull();
    expect(parseStroke({ ...stroke, points: [0.1, 2] })).toBeNull();
    expect(parseStroke({ ...stroke, id: "<script>" })).toBeNull();
    expect(parseStroke({ ...stroke, points: new Array(5000).fill(0.5) })).toBeNull();
  });

  it("valide les messages", () => {
    expect(parseInkMessage({ op: "commit", docId: "d", page: 1, stroke })).not.toBeNull();
    expect(parseInkMessage({ op: "draw", docId: "d", page: 1, id: "a", color: "#111111", width: 0.004, from: 0, points: [0.5, 0.5] })).not.toBeNull();
    expect(parseInkMessage({ op: "draw", docId: "d", page: 1, id: "a", color: "#111111", width: 0.004, from: -1, points: [] })).toBeNull();
    expect(parseInkMessage({ op: "erase", docId: "d", page: 1, ids: ["a", "b"] })).not.toBeNull();
    expect(parseInkMessage({ op: "erase", docId: "d", page: 1, ids: [1] })).toBeNull();
    expect(parseInkMessage({ op: "clear", docId: "d", page: null })).not.toBeNull();
    expect(parseInkMessage({ op: "clear", docId: "d", page: 0 })).toBeNull();
    expect(parseInkMessage({ op: "boom", docId: "d" })).toBeNull();
  });
});

describe("gomme", () => {
  it("touche un trait proche, pas un trait lointain", () => {
    const s = { ...stroke, points: [0.1, 0.1, 0.5, 0.1] };
    expect(strokeHit(s, { x: 0.3, y: 0.11 }, 0.01)).toBe(true);
    expect(strokeHit(s, { x: 0.3, y: 0.3 }, 0.01)).toBe(false);
    expect(strokeHit({ ...stroke, points: [0.5, 0.5] }, { x: 0.505, y: 0.5 }, 0.01)).toBe(true);
  });
});
