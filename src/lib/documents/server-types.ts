import type { DocumentMimeType, Rotation } from "@/lib/database.types";
import type { GeneratedSource } from "./generated";

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
  /** Dans mes favoris (parcourus en mode vol par swipe vertical) */
  favorite: boolean;
  /** Planche créée dans SkyBoard (checklist, RAMROD) : contenu modifiable */
  source: GeneratedSource | null;
  thumbnailUrl: string | null;
}
