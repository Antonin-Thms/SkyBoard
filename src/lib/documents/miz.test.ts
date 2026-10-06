import { describe, expect, it } from "vitest";
import { findKneeboardEntries, isMizFileName, kneeboardDocumentName } from "./miz";

describe("findKneeboardEntries", () => {
  const paths = [
    "mission",
    "options",
    "track",
    "track_data/1",
    "l10n/DEFAULT/carte-zone.jpg",
    "l10n/DEFAULT/radio.ogg",
    "l10n/FR/carte-zone.jpg",
    "l10n/FR/fr-only.png",
    "KNEEBOARD/IMAGES/10-comms.png",
    "KNEEBOARD/IMAGES/2-airfields.jpg",
    "KNEEBOARD/F-16C_50/IMAGES/01_ramp.JPEG",
    "KNEEBOARD/F-16C_50/IMAGES/sub/02_taxi.png",
    "KNEEBOARD/IMAGES/readme.txt",
    "Kneeboard\\FA-18C_hornet\\images\\card.png",
    "KNEEBOARD/IMAGES/",
  ];

  it("trouve les kneeboards puis les images de briefing, sans le reste", () => {
    const entries = findKneeboardEntries(paths);
    expect(entries.map((e) => `${e.kind}:${e.aircraft ?? "-"}:${e.baseName}`)).toEqual([
      "kneeboard:-:2-airfields",
      "kneeboard:-:10-comms",
      "kneeboard:F-16C_50:01_ramp",
      "kneeboard:F-16C_50:02_taxi",
      "kneeboard:FA-18C_hornet:card",
      "briefing:-:carte-zone",
      "briefing:-:fr-only",
    ]);
  });

  it("garde l'image de briefing de la langue DEFAULT en cas de doublon", () => {
    const e = findKneeboardEntries(["l10n/FR/carte.jpg", "l10n/DEFAULT/carte.jpg"]);
    expect(e.map((x) => x.path)).toEqual(["l10n/DEFAULT/carte.jpg"]);
  });

  it("garde le chemin d'origine pour l'extraction", () => {
    expect(findKneeboardEntries(["Kneeboard\\FA-18C_hornet\\images\\card.png"])[0].path).toBe(
      "Kneeboard\\FA-18C_hornet\\images\\card.png",
    );
  });

  it("ne renvoie rien sans image", () => {
    expect(findKneeboardEntries(["mission", "track", "l10n/DEFAULT/sound.ogg"])).toEqual([]);
  });
});

describe("noms", () => {
  it("reconnaît missions et tracks", () => {
    expect(isMizFileName("Op Red Flag.MIZ")).toBe(true);
    expect(isMizFileName("server-20261007.trk")).toBe(true);
    expect(isMizFileName("carte.pdf")).toBe(false);
  });

  it("construit le nom du document", () => {
    expect(
      kneeboardDocumentName("Op Red Flag.miz", { path: "", kind: "kneeboard", aircraft: "F-16C_50", baseName: "01_ramp" }),
    ).toBe("Op Red Flag · F-16C_50 · 01_ramp");
    expect(
      kneeboardDocumentName("srv.trk", { path: "", kind: "briefing", aircraft: null, baseName: "carte" }),
    ).toBe("srv · Briefing · carte");
    expect(kneeboardDocumentName("M.miz", { path: "", kind: "kneeboard", aircraft: null, baseName: "comms" })).toBe("M · comms");
  });
});
