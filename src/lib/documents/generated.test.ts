import { describe, expect, it } from "vitest";
import { parseGeneratedSource } from "./generated";

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
