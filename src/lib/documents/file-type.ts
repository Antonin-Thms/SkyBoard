import type { DocumentMimeType } from "@/lib/database.types";

/** Taille max d'un fichier (alignée sur file_size_limit du bucket). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const ACCEPTED_MIME_TYPES: readonly DocumentMimeType[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

/** Valeur de l'attribut accept de l'input fichier. */
export const ACCEPT_ATTRIBUTE = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

export const EXTENSION_BY_MIME: Record<DocumentMimeType, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/**
 * Détermine le type réel d'un fichier à partir de ses premiers octets
 * (signature), indépendamment de son extension ou du type annoncé.
 */
export function sniffMimeType(header: Uint8Array): DocumentMimeType | null {
  const startsWith = (sig: number[]) =>
    header.length >= sig.length && sig.every((byte, i) => header[i] === byte);

  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

export type FileCheck =
  | { ok: true; mime: DocumentMimeType }
  | { ok: false; error: string };

/** Vérifie la taille et le type réel d'un fichier avant upload. */
export async function checkFile(file: Blob): Promise<FileCheck> {
  if (file.size === 0) return { ok: false, error: "Fichier vide." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `Fichier trop volumineux (${formatBytes(file.size)}, max ${formatBytes(MAX_UPLOAD_BYTES)}).`,
    };
  }
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const mime = sniffMimeType(header);
  if (!mime) return { ok: false, error: "Type non supporté (PDF, PNG ou JPG uniquement)." };
  return { ok: true, mime };
}

/** Nom affiché par défaut : nom de fichier sans extension, borné à 200 caractères. */
export function defaultDocumentName(fileName: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, "").trim();
  return (base || "Document").slice(0, 200);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
