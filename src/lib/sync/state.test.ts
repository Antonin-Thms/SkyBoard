import { describe, expect, it } from "vitest";
import { INITIAL_VIEW_STATE, type ViewState } from "./protocol";
import { isNewer, nextSeq, selectDocument, stepDocument, stepPage } from "./state";

const docs = [
  { id: "a", pageCount: 3 },
  { id: "b", pageCount: 1 },
  { id: "c", pageCount: 10 },
];
const base: ViewState = { ...INITIAL_VIEW_STATE, docId: "a", page: 2, zoom: 3, panX: 0.2, panY: -0.1, seq: 5 };

describe("nextSeq", () => {
  it("est strictement croissant", () => {
    expect(nextSeq(10, 5)).toBe(11);
    expect(nextSeq(10, 1000)).toBe(1000);
  });

  it("une remote rechargée repart au-dessus", () => {
    const before = nextSeq(0, 1_700_000_000_000);
    const burst = Array.from({ length: 50 }).reduce<number>((s) => nextSeq(s, 1_700_000_000_000), before);
    // rechargement 1 s plus tard, compteur perdu
    expect(nextSeq(0, 1_700_000_001_000)).toBeGreaterThan(burst);
  });
});

describe("isNewer", () => {
  it("compare les séquences", () => {
    expect(isNewer(base, null)).toBe(true);
    expect(isNewer({ ...base, seq: 6 }, base)).toBe(true);
    expect(isNewer({ ...base, seq: 5 }, base)).toBe(false);
    expect(isNewer({ ...base, seq: 4 }, base)).toBe(false);
  });
});

describe("selectDocument", () => {
  it("reprend la dernière page vue et remet le zoom à zéro", () => {
    const s = selectDocument(base, docs[2], { c: 7 });
    expect(s).toMatchObject({ docId: "c", page: 7, zoom: 1, panX: 0, panY: 0 });
  });

  it("borne la page mémorisée", () => {
    expect(selectDocument(base, docs[0], { a: 99 }).page).toBe(3);
    expect(selectDocument(base, docs[1], {}).page).toBe(1);
  });
});

describe("stepPage", () => {
  it("avance, recule, et s'arrête en butée", () => {
    expect(stepPage(base, docs[0], 1)).toMatchObject({ page: 3, zoom: 1 });
    expect(stepPage(base, docs[0], -1)?.page).toBe(1);
    expect(stepPage({ ...base, page: 3 }, docs[0], 1)).toBeNull();
    expect(stepPage({ ...base, page: 1 }, docs[0], -1)).toBeNull();
  });
});

describe("stepDocument", () => {
  it("boucle sur la liste", () => {
    expect(stepDocument(base, docs, 1, {})?.docId).toBe("b");
    expect(stepDocument(base, docs, -1, {})?.docId).toBe("c");
    expect(stepDocument({ ...base, docId: "c" }, docs, 1, {})?.docId).toBe("a");
  });

  it("part du premier document si aucun n'est affiché", () => {
    expect(stepDocument({ ...base, docId: null }, docs, 1, {})?.docId).toBe("a");
  });

  it("ne fait rien avec un seul document ou aucun", () => {
    expect(stepDocument(base, [docs[0]], 1, {})).toBeNull();
    expect(stepDocument(base, [], 1, {})).toBeNull();
  });
});
