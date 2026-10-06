import { describe, expect, it } from "vitest";
import type { Stroke } from "./model";
import { applyInk, EMPTY_INK, LIVE_STROKE_TTL_MS, pruneLive, strokesForPage } from "./store";

const ink = { color: "#d62828" as const, width: 0.004 };
const done = (id: string): Stroke => ({ id, ...ink, points: [0.1, 0.1, 0.2, 0.2] });

describe("applyInk", () => {
  it("construit un trait en cours puis le valide", () => {
    let s = applyInk(EMPTY_INK, { op: "draw", docId: "d", page: 1, id: "a", ...ink, from: 0, points: [0.1, 0.1] }, 0);
    s = applyInk(s, { op: "draw", docId: "d", page: 1, id: "a", ...ink, from: 1, points: [0.2, 0.2, 0.3, 0.3] }, 10);
    expect(strokesForPage(s, "d:1")[0].points).toEqual([0.1, 0.1, 0.2, 0.2, 0.3, 0.3]);
    s = applyInk(s, { op: "commit", docId: "d", page: 1, stroke: done("a") }, 20);
    expect(s.live).toEqual({});
    expect(strokesForPage(s, "d:1")).toEqual([done("a")]);
  });

  it("tolère un message rejoué", () => {
    let s = applyInk(EMPTY_INK, { op: "draw", docId: "d", page: 1, id: "a", ...ink, from: 0, points: [0.1, 0.1, 0.2, 0.2] }, 0);
    s = applyInk(s, { op: "draw", docId: "d", page: 1, id: "a", ...ink, from: 1, points: [0.2, 0.2, 0.3, 0.3] }, 0);
    expect(strokesForPage(s, "d:1")[0].points).toEqual([0.1, 0.1, 0.2, 0.2, 0.3, 0.3]);
  });

  it("efface des traits, une page ou tout un document", () => {
    let s = EMPTY_INK;
    for (const [id, page] of [["a", 1], ["b", 1], ["c", 2]] as const) {
      s = applyInk(s, { op: "commit", docId: "d", page, stroke: done(id) }, 0);
    }
    s = applyInk(s, { op: "commit", docId: "e", page: 1, stroke: done("x") }, 0);
    expect(strokesForPage(applyInk(s, { op: "erase", docId: "d", page: 1, ids: ["a"] }, 0), "d:1").map((x) => x.id)).toEqual(["b"]);
    expect(strokesForPage(applyInk(s, { op: "clear", docId: "d", page: 1 }, 0), "d:2")).toHaveLength(1);
    const cleared = applyInk(s, { op: "clear", docId: "d", page: null }, 0);
    expect(Object.keys(cleared.pages)).toEqual(["e:1"]);
  });

  it("abandonne un trait en cours resté sans nouvelles", () => {
    const s = applyInk(EMPTY_INK, { op: "draw", docId: "d", page: 1, id: "a", ...ink, from: 0, points: [0.1, 0.1] }, 0);
    expect(pruneLive(s, LIVE_STROKE_TTL_MS - 1)).toBe(s);
    expect(pruneLive(s, LIVE_STROKE_TTL_MS + 1).live).toEqual({});
  });
});
