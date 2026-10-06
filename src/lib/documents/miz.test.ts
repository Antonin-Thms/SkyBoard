import { describe, expect, it } from "vitest";
import { findKneeboardEntries, isMizFileName, kneeboardDocumentName } from "./miz";

describe("findKneeboardEntries", () => {
  const paths = [
    "mission",
    "options",
    "l10n/DEFAULT/briefing.jpg",
    "KNEEBOARD/IMAGES/10-comms.png",
    "KNEEBOARD/IMAGES/2-airfields.jpg",
    "KNEEBOARD/F-16C_50/IMAGES/01_ramp.JPEG",
    "KNEEBOARD/F-16C_50/IMAGES/sub/02_taxi.png",
    "KNEEBOARD/IMAGES/readme.txt",
    "Kneeboard\\FA-18C_hornet\\images\\card.png",
    "KNEEBOARD/IMAGES/",
  ];

  it("trouve les images communes et par appareil, sans le reste", () => {
    const entries = findKneeboardEntries(paths);
    expect(entries.map((e) => e.baseName)).toEqual(["2-airfields", "10-comms", "01_ramp", "02_taxi", "card"]);
    expect(entries.map((e) => e.aircraft)).toEqual([null, null, "F-16C_50", "F-16C_50", "FA-18C_hornet"]);
  });

  it("garde le chemin d'origine pour l'extraction", () => {
    expect(findKneeboardEntries(["Kneeboard\\FA-18C_hornet\\images\\card.png"])[0].path).toBe(
      "Kneeboard\\FA-18C_hornet\\images\\card.png",
    );
  });

  it("ne renvoie rien sans kneeboard", () => {
    expect(findKneeboardEntries(["mission", "l10n/DEFAULT/image.png"])).toEqual([]);
  });
});

describe("noms", () => {
  it("reconnaît les .miz", () => {
    expect(isMizFileName("Op Red Flag.MIZ")).toBe(true);
    expect(isMizFileName("carte.pdf")).toBe(false);
  });

  it("construit le nom du document", () => {
    expect(
      kneeboardDocumentName("Op Red Flag.miz", { path: "", aircraft: "F-16C_50", baseName: "01_ramp" }),
    ).toBe("Op Red Flag · F-16C_50 · 01_ramp");
    expect(kneeboardDocumentName("M.miz", { path: "", aircraft: null, baseName: "comms" })).toBe("M · comms");
  });
});
