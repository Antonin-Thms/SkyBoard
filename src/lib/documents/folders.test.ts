import { describe, expect, it } from "vitest";
import { isVisibleInActiveFolder, matchesFilter, parseFolderFilter } from "./folders";

const own = (folderId: string | null) => ({ folderId });
const shared = (folderId: string) => ({ folderId, readOnly: true });

describe("dossier actif", () => {
  it("sans dossier actif : tous mes documents", () => {
    expect(isVisibleInActiveFolder(own("a"), null)).toBe(true);
    expect(isVisibleInActiveFolder(own(null), null)).toBe(true);
  });

  it("dossier actif : ses documents + les communs", () => {
    expect(isVisibleInActiveFolder(own("a"), "a")).toBe(true);
    expect(isVisibleInActiveFolder(own(null), "a")).toBe(true);
    expect(isVisibleInActiveFolder(own("b"), "a")).toBe(false);
  });

  it("documents partagés par l'escadrille : seulement si leur dossier est actif", () => {
    expect(isVisibleInActiveFolder(shared("s"), null)).toBe(false);
    expect(isVisibleInActiveFolder(shared("s"), "a")).toBe(false);
    expect(isVisibleInActiveFolder(shared("s"), "s")).toBe(true);
  });
});

describe("filtre de la page Documents", () => {
  it("filtre", () => {
    expect(matchesFilter(own("a"), { kind: "all" })).toBe(true);
    expect(matchesFilter(own(null), { kind: "common" })).toBe(true);
    expect(matchesFilter(own("a"), { kind: "common" })).toBe(false);
    expect(matchesFilter(own("a"), { kind: "folder", id: "a" })).toBe(true);
    expect(matchesFilter(own(null), { kind: "folder", id: "a" })).toBe(false);
  });

  it("documents partagés : seulement dans leur dossier", () => {
    expect(matchesFilter(shared("s"), { kind: "all" })).toBe(false);
    expect(matchesFilter(shared("s"), { kind: "folder", id: "s" })).toBe(true);
  });

  it("lit l'URL en ignorant les dossiers inconnus", () => {
    expect(parseFolderFilter("common", [])).toEqual({ kind: "common" });
    expect(parseFolderFilter("a", ["a"])).toEqual({ kind: "folder", id: "a" });
    expect(parseFolderFilter("zz", ["a"])).toEqual({ kind: "all" });
    expect(parseFolderFilter(undefined, ["a"])).toEqual({ kind: "all" });
  });
});
