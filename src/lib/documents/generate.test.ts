import { describe, expect, it } from "vitest";
import { normalizeRamrodChar, parseChecklistItems, ramrodDuplicates, splitRamrodChars } from "./generate";

describe("parseChecklistItems", () => {
  it("une ligne = un élément, puces et numéros retirés", () => {
    expect(parseChecklistItems("- Batterie ON\n\n2) APU START\n[ ] Canopy CLOSED\n• Radio 251.0")).toEqual([
      "Batterie ON",
      "APU START",
      "Canopy CLOSED",
      "Radio 251.0",
    ]);
  });
});

describe("RAMROD", () => {
  it("une case garde le dernier caractère tapé, en majuscule", () => {
    expect(normalizeRamrodChar("b")).toBe("B");
    expect(normalizeRamrodChar("Ae")).toBe("E");
    expect(normalizeRamrodChar(" ")).toBe("");
    expect(normalizeRamrodChar("é")).toBe("É");
  });

  it("un mot collé remplit les cases, 10 au plus, sans espaces", () => {
    expect(splitRamrodChars("blackhorse")).toEqual(["B", "L", "A", "C", "K", "H", "O", "R", "S", "E"]);
    expect(splitRamrodChars("ram rod")).toEqual(["R", "A", "M", "R", "O", "D"]);
    expect(splitRamrodChars("ABCDEFGHIJKL")).toHaveLength(10);
  });

  it("signale les caractères en double, en ignorant les cases vides", () => {
    expect(ramrodDuplicates(["R", "A", "M", "R", "O", "D", "", ""])).toEqual(["R"]);
    expect(ramrodDuplicates(splitRamrodChars("blackhorse"))).toEqual([]);
  });
});
