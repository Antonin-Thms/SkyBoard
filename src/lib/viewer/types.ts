import type { DocumentMimeType } from "@/lib/database.types";
import type { ViewState } from "@/lib/sync/protocol";

export interface ViewerDocument {
  id: string;
  name: string;
  type: DocumentMimeType;
  pageCount: number;
  /** URL signée à durée limitée (voir expiresAt) */
  url: string;
}

/** Réponse de GET /api/viewer/[token]. */
export interface ViewerPayload {
  cockpit: { name: string };
  /** Dossier actif (null : tous les documents) */
  folder: { name: string } | null;
  /** Nom du canal Realtime à rejoindre */
  channel: string;
  /** Dernier état persisté (viewer qui démarre seul) */
  lastState: ViewState | null;
  documents: ViewerDocument[];
  /** Expiration des URLs signées (ms epoch) */
  expiresAt: number;
}
