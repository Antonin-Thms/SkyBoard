import type { DocumentMimeType, Rotation } from "@/lib/database.types";
import type { ViewState } from "@/lib/sync/protocol";

export interface RemoteCockpit {
  id: string;
  name: string;
  /** Nom du canal Realtime (calculé côté serveur, le token n'est pas exposé) */
  channel: string;
  lastState: ViewState | null;
  /** Dossier actif (null : tous les documents) */
  activeFolderId: string | null;
}

export interface RemoteDocument {
  id: string;
  name: string;
  type: DocumentMimeType;
  pageCount: number;
  thumbnailUrl: string | null;
  folderId: string | null;
  rotation: Rotation;
  /** Partagé par un autre pilote de l'escadron */
  readOnly: boolean;
  /** Favori : parcouru en mode vol par swipe vertical */
  favorite: boolean;
}
