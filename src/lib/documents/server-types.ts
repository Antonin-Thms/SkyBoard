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
  thumbnailUrl: string | null;
}
