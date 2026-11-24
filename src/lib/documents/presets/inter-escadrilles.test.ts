import { describe, expect, it } from "vitest";
import { AIRBASE_KEYS, parseRows, STATION_KEYS, SUPPORT_KEYS, TACTICAL_LIMITS } from "../tactical";
import { INTER_ESCADRILLES_NOV26 as P } from "./inter-escadrilles";

describe("listes Inter-escadrilles DJS Nov 26", () => {
  it("passent la validation des listes enregistrées, sans rien tronquer", () => {
    expect(parseRows(P.airbases, AIRBASE_KEYS, TACTICAL_LIMITS.refs)).toEqual(P.airbases);
    expect(parseRows(P.stations, STATION_KEYS, TACTICAL_LIMITS.refs)).toEqual(P.stations);
    expect(parseRows(P.support, SUPPORT_KEYS, TACTICAL_LIMITS.refs)).toEqual(P.support);
  });

  it("fréquences du briefing : 000.000 (AM) ou FM nn", () => {
    for (const s of P.stations) expect(s.freq).toMatch(/^(\d{3}\.\d{3}( AM)?|FM \d{2})$/);
    expect(P.stations.find((s) => s.name.startsWith("DAGGER 51"))?.freq).toBe("338.725");
  });
});
