import { describe, expect, it } from "vitest";
import { fileName } from "./file-name";

describe("nom de fichier téléchargé", () => {
  it("sans accents ni caractères interdits", () => {
    expect(fileName("Démarrage F-16 (2-2)", "png")).toBe("Demarrage F-16 (2-2).png");
    expect(fileName('Fiche: BVR / "Nord"', "pdf")).toBe("Fiche BVR Nord.pdf");
    expect(fileName("   ", "png")).toBe("kneeboard.png");
  });
});
