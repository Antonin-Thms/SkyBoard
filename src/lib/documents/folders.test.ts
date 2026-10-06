import { describe, expect, it } from "vitest";
import { isVisibleInActiveFolder, matchesFilter, parseFolderFilter } from "./folders";

describe("dossier actif", () => {
  it("sans dossier actif : tout est visible", () => {
    expect(isVisibleInActiveFolder("a", null)).toBe(true);
    expect(isVisibleInActiveFolder(null, null)).toBe(true);
  });

  it("dossier actif : ses documents + les communs", () => {
    expect(isVisibleInActiveFolder("a", "a")).toBe(true);
    expect(isVisibleInActiveFolder(null, "a")).toBe(true);
    expect(isVisibleInActiveFolder("b", "a")).toBe(false);
  });
});

describe("filtre de la page Documents", () => {
  it("filtre", () => {
    expect(matchesFilter("a", { kind: "all" })).toBe(true);
    expect(matchesFilter(null, { kind: "common" })).toBe(true);
    expect(matchesFilter("a", { kind: "common" })).toBe(false);
    expect(matchesFilter("a", { kind: "folder", id: "a" })).toBe(true);
    expect(matchesFilter(null, { kind: "folder", id: "a" })).toBe(false);
  });

  it("lit l'URL en ignorant les dossiers inconnus", () => {
    expect(parseFolderFilter("common", [])).toEqual({ kind: "common" });
    expect(parseFolderFilter("a", ["a"])).toEqual({ kind: "folder", id: "a" });
    expect(parseFolderFilter("zz", ["a"])).toEqual({ kind: "all" });
    expect(parseFolderFilter(undefined, ["a"])).toEqual({ kind: "all" });
  });
});
