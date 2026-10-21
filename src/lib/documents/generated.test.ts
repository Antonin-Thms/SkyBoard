import { describe, expect, it } from "vitest";
import { cleanTactical, emptyTactical, parseGeneratedSource, sourceGroup } from "./generated";

const GROUP = "0f8b6a52-3c1d-4e2f-9a7b-1c2d3e4f5a6b";

describe("parseGeneratedSource", () => {
  it("lit une table RAMROD et complète à 10 cases", () => {
    expect(parseGeneratedSource({ kind: "ramrod", title: "RAMROD", chars: ["B", "L", ""] })).toEqual({
      kind: "ramrod",
      title: "RAMROD",
      chars: ["B", "L", "", "", "", "", "", "", "", ""],
    });
  });

  it("lit une partie de checklist", () => {
    const source = { kind: "checklist", title: "Démarrage", items: ["Batterie — ON"], group: GROUP, part: 2 };
    expect(parseGeneratedSource(source)).toEqual(source);
  });

  it("refuse tout le reste (fichier envoyé, JSON inattendu)", () => {
    expect(parseGeneratedSource(null)).toBeNull();
    expect(parseGeneratedSource([])).toBeNull();
    expect(parseGeneratedSource({ kind: "notes", title: "x" })).toBeNull();
    expect(parseGeneratedSource({ kind: "ramrod", title: 3, chars: [] })).toBeNull();
    expect(parseGeneratedSource({ kind: "ramrod", title: "x", chars: Array(11).fill("A") })).toBeNull();
    expect(parseGeneratedSource({ kind: "checklist", title: "x", items: ["a"], group: "pas-un-uuid", part: 1 })).toBeNull();
    expect(parseGeneratedSource({ kind: "checklist", title: "x", items: ["a"], group: GROUP, part: 0 })).toBeNull();
  });
});

describe("fiche tactique", () => {
  const base = {
    kind: "tactical",
    title: "Fiche",
    group: GROUP,
    part: 1,
    ramrod: ["B", "L"],
    navaids: [{ name: "CVN-73", tacan: "73X", ils: "11", freq: "305.000" }],
    freqs: [{ name: "AWACS", freq: "251.000" }],
    codes: [{ name: "GBU-12", code: "1688" }],
    notes: "Bingo 3.0",
  };

  it("lit une fiche complète (RAMROD complété à 10 cases)", () => {
    const parsed = parseGeneratedSource(base);
    expect(parsed).toMatchObject({ kind: "tactical", navaids: base.navaids, codes: base.codes, notes: "Bingo 3.0" });
    expect(parsed && "ramrod" in parsed ? parsed.ramrod : []).toHaveLength(10);
  });

  it("refuse une forme inattendue", () => {
    expect(parseGeneratedSource({ ...base, navaids: "x" })).toBeNull();
    expect(parseGeneratedSource({ ...base, codes: [{ name: 3 }] })).toBeNull();
    expect(parseGeneratedSource({ ...base, freqs: Array(21).fill({ name: "a", freq: "b" }) })).toBeNull();
    expect(parseGeneratedSource({ ...base, group: "x" })).toBeNull();
  });

  it("nettoyage : lignes vides retirées, espaces coupés", () => {
    const data = emptyTactical(["A"]);
    data.codes = [{ name: " GBU-12 ", code: "1688 " }, { name: "", code: " " }];
    data.notes = "  \n";
    expect(cleanTactical(data)).toMatchObject({ codes: [{ name: "GBU-12", code: "1688" }], notes: "", navaids: [] });
  });

  it("groupe : checklist et fiche tactique en ont un, pas l'ancienne table RAMROD", () => {
    expect(sourceGroup(parseGeneratedSource(base)!)).toBe(GROUP);
    expect(sourceGroup({ kind: "ramrod", title: "R", chars: [] })).toBeNull();
  });
});
