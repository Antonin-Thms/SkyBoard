import type { DocumentMimeType } from "@/lib/database.types";
import type { ViewState } from "@/lib/sync/protocol";

export interface RemoteCockpit {
  id: string;
  name: string;
  /** Nom du canal Realtime (calculé côté serveur, le token n'est pas exposé) */
  channel: string;
  lastState: ViewState | null;
}

export interface RemoteDocument {
  id: string;
  name: string;
  type: DocumentMimeType;
  pageCount: number;
  thumbnailUrl: string | null;
}
