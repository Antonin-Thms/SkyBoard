import { describe, expect, it } from "vitest";
import { parseChecklistItems } from "./generate";

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
