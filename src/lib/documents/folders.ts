/**
 * Dossiers : un document appartient à au plus un dossier. Les documents
 * sans dossier (« Communs ») sont toujours visibles. Le dossier actif d'un
 * cockpit (null = tous) détermine les documents affichés et pilotés.
 */
export interface FolderSummary {
  id: string;
  name: string;
  /** Escadrille avec laquelle le dossier est partagé (le sien ou celui d'un autre) */
  squadronId?: string | null;
  squadronName?: string | null;
  /** Dossier d'un autre pilote, partagé avec une de mes escadrilles : lecture seule */
  readOnly?: boolean;
}

/** Document vu pour le filtrage (readOnly : partagé par un autre pilote). */
export interface FolderedDoc {
  folderId: string | null;
  readOnly?: boolean;
}

/** Filtre « Documents » : tous, communs seulement, ou un dossier. */
export type FolderFilter = { kind: "all" } | { kind: "common" } | { kind: "folder"; id: string };

/**
 * Documents visibles pour un cockpit selon son dossier actif. Les documents
 * partagés par d'autres pilotes n'apparaissent que si leur dossier est actif.
 */
export function isVisibleInActiveFolder(doc: FolderedDoc, activeFolderId: string | null): boolean {
  if (doc.readOnly) return doc.folderId !== null && doc.folderId === activeFolderId;
  return activeFolderId === null || doc.folderId === null || doc.folderId === activeFolderId;
}

/** Documents affichés par un filtre de la page Documents. */
export function matchesFilter(doc: FolderedDoc, filter: FolderFilter): boolean {
  switch (filter.kind) {
    case "all":
      // « Tous » : mes documents (ceux de l'escadrille sont dans leur dossier).
      return !doc.readOnly;
    case "common":
      return !doc.readOnly && doc.folderId === null;
    case "folder":
      return doc.folderId === filter.id;
  }
}

/** Lecture du filtre depuis l'URL (?folder=common | <uuid>). */
export function parseFolderFilter(value: unknown, folderIds: string[]): FolderFilter {
  if (value === "common") return { kind: "common" };
  if (typeof value === "string" && folderIds.includes(value)) return { kind: "folder", id: value };
  return { kind: "all" };
}
