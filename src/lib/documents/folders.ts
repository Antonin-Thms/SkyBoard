/**
 * Dossiers : un document appartient à au plus un dossier. Les documents
 * sans dossier (« Communs ») sont toujours visibles. Le dossier actif d'un
 * cockpit (null = tous) détermine les documents affichés et pilotés.
 */
export interface FolderSummary {
  id: string;
  name: string;
}

/** Filtre « Documents » : tous, communs seulement, ou un dossier. */
export type FolderFilter = { kind: "all" } | { kind: "common" } | { kind: "folder"; id: string };

/** Documents visibles pour un cockpit selon son dossier actif. */
export function isVisibleInActiveFolder(docFolderId: string | null, activeFolderId: string | null): boolean {
  return activeFolderId === null || docFolderId === null || docFolderId === activeFolderId;
}

/** Documents affichés par un filtre de la page Documents. */
export function matchesFilter(docFolderId: string | null, filter: FolderFilter): boolean {
  switch (filter.kind) {
    case "all":
      return true;
    case "common":
      return docFolderId === null;
    case "folder":
      return docFolderId === filter.id;
  }
}

/** Lecture du filtre depuis l'URL (?folder=common | <uuid>). */
export function parseFolderFilter(value: unknown, folderIds: string[]): FolderFilter {
  if (value === "common") return { kind: "common" };
  if (typeof value === "string" && folderIds.includes(value)) return { kind: "folder", id: value };
  return { kind: "all" };
}
