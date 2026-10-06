import { describe, expect, it } from "vitest";
import { checkFile, defaultDocumentName, MAX_UPLOAD_BYTES, sniffMimeType } from "./file-type";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("sniffMimeType", () => {
  it("reconnaît PDF, PNG et JPEG", () => {
    expect(sniffMimeType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMimeType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("rejette le reste", () => {
    expect(sniffMimeType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffMimeType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffMimeType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffMimeType(bytes())).toBeNull();
  });
});

describe("checkFile", () => {
  it("accepte un PDF valide", async () => {
    expect(await checkFile(new Blob(["%PDF-1.4 ..."]))).toEqual({ ok: true, mime: "application/pdf" });
  });

  it("rejette un fichier renommé en .pdf", async () => {
    const res = await checkFile(new Blob(["<html></html>"]));
    expect(res.ok).toBe(false);
  });

  it("rejette un fichier vide ou trop gros", async () => {
    expect((await checkFile(new Blob([]))).ok).toBe(false);
    const big = { size: MAX_UPLOAD_BYTES + 1, slice: () => new Blob(["%PDF-"]) } as unknown as Blob;
    expect((await checkFile(big)).ok).toBe(false);
  });
});

describe("defaultDocumentName", () => {
  it("retire l'extension", () => {
    expect(defaultDocumentName("Checklist F-16.pdf")).toBe("Checklist F-16");
    expect(defaultDocumentName("carte.v2.jpeg")).toBe("carte.v2");
    expect(defaultDocumentName(".pdf")).toBe("Document");
  });
});
