import { describe, expect, it } from "vitest";
import { parseGeneratedSource, sourceGroup } from "./generated";
import { AIRBASE_KEYS, cleanTacticalSheet, emptyTacticalSheet, isBlank, parsePastedRows, wingmanTacan, withWingmenTacan } from "./tactical";

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
    header: { callsign: "DAGGER 31", pri: "U12", aux: "V9", mission: "BVR TRAINING", weather: "", time: "" },
    airbases: { dep: { name: "ETAD", tacan: "32X", vhf: "", uhf: "U12", elev: "984", runway: "05/23", ils: "109.15" } },
    flight: [{ pilot: "Kepyyy", helmet: "HMCS", tacan: "31Y", laser: "1688", stn: "6031", tail: "90-0816", notes: "" }],
    loadout: { aa: "AIM-120C", ag: "", pod: "TGP", tanks: "2xFT" },
    com1: [{ code: "U12", name: "ETAD TWR", freq: "251.950" }],
    ramrod: ["B", "E"],
    rtba: [{ wp: "W1", offset: "0:00" }],
    notes: "Bingo 3.0",
  };

  it("lit une fiche : lignes fixes complétées, sections absentes vides", () => {
    const parsed = parseGeneratedSource(base);
    expect(parsed).toMatchObject({ kind: "tactical", header: base.header, loadout: base.loadout, notes: "Bingo 3.0" });
    if (parsed?.kind !== "tactical") throw new Error("type");
    expect(parsed.flight).toHaveLength(4);
    expect(parsed.com1[0]).toEqual(base.com1[0]);
    // Radios et objectifs : autant de lignes que saisies (absentes : aucune).
    expect(parsed.com2).toHaveLength(0);
    expect(parsed.targets).toHaveLength(0);
    expect(parsed.airbases.arr.name).toBe("");
    expect(parsed.ramrod).toHaveLength(10);
  });

  it("convertit une fiche de la première version : navigation, fréquences et codes passent dans les notes", () => {
    const v1 = {
      kind: "tactical",
      title: "Ancienne",
      group: GROUP,
      part: 1,
      ramrod: ["B"],
      navaids: [{ name: "CVN-73", tacan: "73X", ils: "11", freq: "305.000" }],
      freqs: [{ name: "AWACS", freq: "251.000" }],
      codes: [{ name: "GBU-12", code: "1688" }],
      rtba: [{ wp: "W1", offset: "1:35" }],
      notes: "Bingo",
    };
    const parsed = parseGeneratedSource(v1);
    if (parsed?.kind !== "tactical") throw new Error("type");
    expect(parsed.notes).toBe("CVN-73 · TCN 73X · ILS 11 · 305.000\nAWACS · 251.000\nGBU-12 · 1688\nBingo");
    expect(parsed.ramrod[0]).toBe("B");
    expect(parsed.rtba).toEqual(v1.rtba);
  });

  it("support : lu s'il est présent, vide pour une fiche créée avant son ajout", () => {
    const support = [{ role: "TKR", type: "KC135", callsign: "SHELL 21", uhf: "241.5", vhf: "", tacan: "21X", alt: "FL190", notes: "" }];
    const parsed = parseGeneratedSource({ ...base, support });
    expect(parsed).toMatchObject({ support });
    expect(parseGeneratedSource(base)).toMatchObject({ support: [] });
    expect(parseGeneratedSource({ ...base, support: [{ role: 1 }] })).toBeNull();
  });

  it("refuse une forme inattendue", () => {
    expect(parseGeneratedSource({ ...base, flight: "x" })).toBeNull();
    expect(parseGeneratedSource({ ...base, flight: Array(5).fill({}) })).toBeNull();
    expect(parseGeneratedSource({ ...base, header: { callsign: 3 } })).toBeNull();
    expect(parseGeneratedSource({ ...base, group: "x" })).toBeNull();
  });

  it("nettoyage : espaces coupés, lignes RTBA vides retirées", () => {
    const s = emptyTacticalSheet(["A"]);
    s.header.callsign = " DAGGER 31 ";
    s.rtba = [{ wp: " W1 ", offset: "0:00" }, { wp: "", offset: " " }];
    const clean = cleanTacticalSheet(s);
    expect(clean.header.callsign).toBe("DAGGER 31");
    expect(clean.rtba).toEqual([{ wp: "W1", offset: "0:00" }]);
  });

  it("collage depuis Excel : tabulations ou « ; », colonnes dans l'ordre", () => {
    expect(parsePastedRows("ETAD\t32X\t\tU12\t984\t05/23\t109.15\n\nETAR;81X", AIRBASE_KEYS)).toEqual([
      { name: "ETAD", tacan: "32X", vhf: "", uhf: "U12", elev: "984", runway: "05/23", ils: "109.15" },
      { name: "ETAR", tacan: "81X", vhf: "", uhf: "", elev: "", runway: "", ils: "" },
    ]);
  });

  it("groupe : checklist et fiche tactique en ont un, pas l'ancienne table RAMROD", () => {
    expect(sourceGroup(parseGeneratedSource(base)!)).toBe(GROUP);
    expect(sourceGroup({ kind: "ramrod", title: "R", chars: [] })).toBeNull();
  });
});

describe("TACAN des ailiers", () => {
  it("leader + 63, même bande ; au-delà de 63 on retire 63", () => {
    expect(wingmanTacan("61Y")).toBe("124Y");
    expect(wingmanTacan("1x")).toBe("64X");
    expect(wingmanTacan("63Y")).toBe("126Y");
    expect(wingmanTacan("70X")).toBe("7X");
    expect(wingmanTacan(" 31 y ")).toBe("94Y");
  });

  it("vide si le canal du leader n'est pas valide", () => {
    for (const v of ["", "0X", "127Y", "61", "61Z", "abc"]) expect(wingmanTacan(v)).toBe("");
  });

  it("appliqué aux ailiers dont la ligne est remplie", () => {
    const s = emptyTacticalSheet();
    s.flight[0] = { ...s.flight[0], pilot: "Lead", tacan: "61Y" };
    s.flight[1] = { ...s.flight[1], pilot: "Two", tacan: "12X" };
    s.flight[2] = { ...s.flight[2], tail: "411" };
    const flight = withWingmenTacan(s.flight);
    expect(flight.map((m) => m.tacan)).toEqual(["61Y", "124Y", "124Y", ""]);
  });
});

describe("sections vides", () => {
  it("vides si aucune case n'est remplie (espaces ignorés)", () => {
    expect(isBlank({ a: "", b: " " }, { c: "" })).toBe(true);
    expect(isBlank({ a: "" }, { c: "U12" })).toBe(false);
    expect(isBlank()).toBe(true);
  });
});
