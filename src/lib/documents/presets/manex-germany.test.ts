import { describe, expect, it } from "vitest";
import { AIRBASE_KEYS, parseRows, STATION_KEYS, SUPPORT_KEYS, TACTICAL_LIMITS } from "../tactical";
import { MANEX_GERMANY } from "./manex-germany";

describe("listes MANEX Germany", () => {
  it("passent la validation des listes enregistrées, sans rien tronquer", () => {
    expect(parseRows(MANEX_GERMANY.airbases, AIRBASE_KEYS, TACTICAL_LIMITS.refs)).toEqual(MANEX_GERMANY.airbases);
    expect(parseRows(MANEX_GERMANY.stations, STATION_KEYS, TACTICAL_LIMITS.refs)).toEqual(MANEX_GERMANY.stations);
    expect(parseRows(MANEX_GERMANY.support, SUPPORT_KEYS, TACTICAL_LIMITS.refs)).toEqual(MANEX_GERMANY.support);
  });

  it("COMPLAN : canaux uniques, fréquences au format 000.000", () => {
    const codes = MANEX_GERMANY.stations.map((s) => s.code).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
    for (const s of MANEX_GERMANY.stations) expect(s.freq).toMatch(/^\d{3}\.\d{3}$/);
  });
});
