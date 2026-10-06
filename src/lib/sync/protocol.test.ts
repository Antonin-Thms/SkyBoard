import { describe, expect, it } from "vitest";
import { INITIAL_VIEW_STATE, isRotation, MAX_SEQ_AHEAD_MS, parseViewState, rotateBy } from "./protocol";

const valid = { docId: "abc", page: 2, zoom: 1.5, panX: 0.1, panY: -0.2, seq: 7, ts: 1700000000000 };

describe("parseViewState", () => {
  it("accepte un état valide", () => {
    expect(parseViewState(valid)).toEqual({ ...valid, cursor: null });
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

  it("rejette les valeurs démesurées d'un message forgé", () => {
    const now = 1_700_000_000_000;
    // Un seq très en avance ferait ignorer tous les états légitimes suivants.
    expect(parseViewState({ ...valid, seq: 1e300 }, now)).toBeNull();
    expect(parseViewState({ ...valid, seq: now + MAX_SEQ_AHEAD_MS + 1 }, now)).toBeNull();
    expect(parseViewState({ ...valid, seq: now + 1000 }, now)).not.toBeNull();
    expect(parseViewState({ ...valid, seq: 1.5 }, now)).toBeNull();
    expect(parseViewState({ ...valid, seq: -1 }, now)).toBeNull();
    expect(parseViewState({ ...valid, zoom: 1e9 }, now)).toBeNull();
    expect(parseViewState({ ...valid, panX: 50 }, now)).toBeNull();
    expect(parseViewState({ ...valid, cursor: { x: 1e9, y: 0 } }, now)?.cursor).toBeNull();
  });
});

describe("rotation", () => {
  it("valide les angles", () => {
    expect(isRotation(270)).toBe(true);
    expect(isRotation(45)).toBe(false);
  });

  it("ignore un champ rotation des anciens états persistés", () => {
    expect(parseViewState({ ...valid, rotation: 90 })).toEqual({ ...valid, cursor: null });
  });

  it("tourne par pas de 90°", () => {
    expect(rotateBy(0, 1)).toBe(90);
    expect(rotateBy(270, 1)).toBe(0);
    expect(rotateBy(0, -1)).toBe(270);
    expect(rotateBy(90, 2)).toBe(270);
  });
});
