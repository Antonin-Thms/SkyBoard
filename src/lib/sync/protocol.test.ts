import { describe, expect, it } from "vitest";
import { INITIAL_VIEW_STATE, parseViewState, rotateBy } from "./protocol";

const valid = { docId: "abc", page: 2, zoom: 1.5, panX: 0.1, panY: -0.2, seq: 7, ts: 1700000000000 };

describe("parseViewState", () => {
  it("accepte un état valide", () => {
    expect(parseViewState(valid)).toEqual({ ...valid, rotation: 0, cursor: null });
    expect(parseViewState(INITIAL_VIEW_STATE)).toEqual(INITIAL_VIEW_STATE);
  });

  it("garde un curseur valide", () => {
    expect(parseViewState({ ...valid, cursor: { x: 0.5, y: 0.25 } })?.cursor).toEqual({ x: 0.5, y: 0.25 });
    expect(parseViewState({ ...valid, cursor: { x: "a" } })?.cursor).toBeNull();
  });

  it("rejette les états invalides", () => {
    expect(parseViewState(null)).toBeNull();
    expect(parseViewState("x")).toBeNull();
    expect(parseViewState({ ...valid, page: 0 })).toBeNull();
    expect(parseViewState({ ...valid, page: 1.5 })).toBeNull();
    expect(parseViewState({ ...valid, zoom: 0 })).toBeNull();
    expect(parseViewState({ ...valid, panX: Number.NaN })).toBeNull();
    expect(parseViewState({ ...valid, docId: 42 })).toBeNull();
    expect(parseViewState({ ...valid, docId: "x".repeat(65) })).toBeNull();
    expect(parseViewState({ ...valid, seq: undefined })).toBeNull();
  });
});

describe("rotation", () => {
  it("est validée, 0 par défaut pour les anciens états", () => {
    expect(parseViewState({ ...valid, rotation: 270 })?.rotation).toBe(270);
    expect(parseViewState(valid)?.rotation).toBe(0);
    expect(parseViewState({ ...valid, rotation: 45 })).toBeNull();
  });

  it("tourne par pas de 90°", () => {
    expect(rotateBy(0, 1)).toBe(90);
    expect(rotateBy(270, 1)).toBe(0);
    expect(rotateBy(0, -1)).toBe(270);
    expect(rotateBy(90, 2)).toBe(270);
  });
});
