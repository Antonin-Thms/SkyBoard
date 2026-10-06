/** Événements Broadcast échangés sur le canal d'un cockpit. */
export const SYNC_EVENTS = {
  /** remote → viewers (et autres remotes) : nouvel état */
  state: "state",
  /** viewer → remotes : « envoyez-moi l'état courant » */
  requestState: "request_state",
  /** serveur → viewers : la liste des documents a changé, la recharger */
  documentsChanged: "documents_changed",
} as const;
