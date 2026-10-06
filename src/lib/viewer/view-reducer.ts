import type { Rotation } from "@/lib/database.types";
import { INITIAL_VIEW_STATE, type ViewState } from "@/lib/sync/protocol";
import { isNewer } from "@/lib/sync/state";

export type ViewAction =
  /** État reçu (Realtime ou dernier état persisté) : appliqué s'il est plus récent. */
  | { type: "remote"; state: ViewState }
  /** Navigation locale (clavier, tests sur PC) : remplacée au prochain état distant. */
  | { type: "local"; docId: string; page: number; rotation?: Rotation };

export function viewReducer(current: ViewState | null, action: ViewAction): ViewState | null {
  switch (action.type) {
    case "remote":
      return isNewer(action.state, current) ? action.state : current;
    case "local":
      return {
        ...(current ?? INITIAL_VIEW_STATE),
        docId: action.docId,
        page: action.page,
        rotation: action.rotation,
        zoom: 1,
        panX: 0,
        panY: 0,
      };
  }
}
