import { describe, expect, it } from "vitest";
import { EMPTY, emptyDigits, formatTime, parseLeg, parseSlot, passTimes, slotSeconds, stepDigit } from "./model";

describe("réglage du slot", () => {
  it("chiffre vide : ↑ donne 0, ↓ donne le max ; boucle dans les bornes", () => {
    expect(stepDigit(emptyDigits(), 0, 1)[0]).toBe(0);
    expect(stepDigit(emptyDigits(), 0, -1)[0]).toBe(2);
    expect(stepDigit([2, ...emptyDigits().slice(1)], 0, 1)[0]).toBe(0);
    expect(stepDigit([1, 2, 5, 9, 5, 9], 2, 1)[2]).toBe(0);
    expect(stepDigit([1, 2, 0, 9, 5, 9], 3, 1)[3]).toBe(0);
  });

  it("heures 20-23 : l'unité est bornée à 3", () => {
    expect(stepDigit([2, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], 1, -1)[1]).toBe(3);
    expect(stepDigit([1, 8, 0, 0, 0, 0], 0, 1)).toEqual([2, 3, 0, 0, 0, 0]);
  });

  it("slot complet en secondes, sinon null", () => {
    expect(slotSeconds([1, 2, 3, 5, 0, 0])).toBe(12 * 3600 + 35 * 60);
    expect(slotSeconds([1, 2, 3, 5, 0, EMPTY])).toBeNull();
  });
});

describe("temps de passage", () => {
  it("lit les T+", () => {
    expect(parseLeg("1:35")).toBe(95);
    expect(parseLeg("+01:35")).toBe(95);
    expect(parseLeg("1:02:30")).toBe(3750);
    expect(parseLeg("90")).toBe(90);
    expect(parseLeg("1:75")).toBeNull();
    expect(parseLeg("abc")).toBeNull();
  });

  it("WP0 = T0 + T+0, puis cumul des branches", () => {
    const slot = slotSeconds([1, 2, 3, 5, 0, 0]);
    expect(passTimes(slot, ["0:00", "1:35", "1:10"])).toEqual(["12:35:00", "12:36:35", "12:37:45"]);
  });

  it("slot incomplet ou T+ illisible : cases vides", () => {
    expect(passTimes(null, ["0:00", "1:35"])).toEqual(["", ""]);
    expect(passTimes(0, ["0:00", "x", "1:00"])).toEqual(["00:00:00", "", ""]);
    expect(formatTime(86400 + 61)).toBe("00:01:01");
  });

  it("lecture prudente de l'état", () => {
    expect(parseSlot({ docId: "a", digits: [1, 2, 3, 5, 0, 0], edit: 2 })).toEqual({ docId: "a", digits: [1, 2, 3, 5, 0, 0], edit: 2 });
    expect(parseSlot({ docId: "a", digits: [1, 2, 3], edit: null })).toBeNull();
    expect(parseSlot({ docId: "a", digits: [1, 2, 3, 5, 0, 12], edit: null })).toBeNull();
    expect(parseSlot({ docId: "a", digits: [1, 2, 3, 5, 0, 0], edit: 6 })).toBeNull();
  });
});
