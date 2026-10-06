import type { DocumentMimeType, Rotation } from "@/lib/database.types";

/** Document tel que listé pour les pages (miniature signée comprise). */
export interface DocumentSummary {
  id: string;
  name: string;
  type: DocumentMimeType;
  pageCount: number;
  sortOrder: number;
  folderId: string | null;
  rotation: Rotation;
  /** Partagé par un autre pilote de l'escadron : lecture seule */
  readOnly: boolean;
  thumbnailUrl: string | null;
}
