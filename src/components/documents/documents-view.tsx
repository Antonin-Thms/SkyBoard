"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { pruneThumbnails } from "@/lib/documents/thumb-cache";
import type { FolderSummary } from "@/lib/documents/folders";
import { matchesFilter, parseFolderFilter } from "@/lib/documents/folders";
import type { DocumentSummary } from "@/lib/documents/server-types";
import { DocumentGrid, type DocumentItem } from "./document-grid";
import { DocumentUploader } from "./document-uploader";
import { FolderBar } from "./folder-bar";
import { SharedDocumentGrid } from "./shared-document-grid";

interface DocumentsViewProps {
  userId: string;
  documents: DocumentSummary[];
  folders: FolderSummary[];
  /** Escadrons de l'utilisateur (partage d'un dossier) */
  squadrons: { id: string; name: string }[];
  nextSortOrder: number;
}

/** Page Documents, filtrée par dossier dans le navigateur (changement instantané). */
export function DocumentsView({ userId, documents, folders, squadrons, nextSortOrder }: DocumentsViewProps) {
  const params = useSearchParams();

  // Retire du cache navigateur les miniatures des documents supprimés.
  const docIds = documents.map((d) => d.id).join(",");
  useEffect(() => {
    void pruneThumbnails(new Set(docIds.split(",").filter(Boolean)));
  }, [docIds]);
  const filter = parseFolderFilter(
    params.get("folder") ?? undefined,
    folders.map((f) => f.id),
  );

  const items: DocumentItem[] = documents
    .filter((d) => matchesFilter(d, filter))
    .map(({ id, name, type, pageCount, thumbnailUrl, folderId, rotation }) => ({
      id,
      name,
      type,
      pageCount,
      thumbnailUrl,
      folderId,
      rotation,
    }));
  const currentFolder = filter.kind === "folder" ? folders.find((f) => f.id === filter.id) : undefined;
  const contextLabel =
    filter.kind === "all"
      ? "Tous les documents"
      : filter.kind === "common"
        ? "Communs"
        : currentFolder?.readOnly
          ? `${currentFolder.name} · escadron ${currentFolder.squadronName ?? ""}`
          : (currentFolder?.name ?? "");
  const own = documents.filter((d) => !d.readOnly);
  const folderCounts = folders.map((f) => ({
    ...f,
    count: documents.filter((d) => d.folderId === f.id).length,
  }));
  // Remonte la grille quand le filtre ou la liste change (sélection remise à zéro).
  const gridKey = `${JSON.stringify(filter)}|${items.map((i) => `${i.id}:${i.name}:${i.folderId}`).join("|")}`;

  return (
    <>
      <div>
        <div className="label-caps">{contextLabel}</div>
        <h1 className="mt-1 text-3xl font-medium">Documents</h1>
      </div>

      <FolderBar
        folders={folderCounts}
        filter={filter}
        totalCount={own.length}
        commonCount={own.filter((d) => d.folderId === null).length}
        squadrons={squadrons}
      />

      {currentFolder?.readOnly ? (
        // Dossier d'un coéquipier : consultation seulement.
        <SharedDocumentGrid documents={documents.filter((d) => d.folderId === currentFolder.id)} />
      ) : (
        <>
          {/* Les envois vont dans le dossier affiché (Communs pour « Tous » et « Communs »). */}
          <DocumentUploader
            userId={userId}
            nextSortOrder={nextSortOrder}
            folderId={currentFolder?.id ?? null}
            folderName={currentFolder?.name ?? null}
          />

          <DocumentGrid key={gridKey} initialItems={items} folders={folders.filter((f) => !f.readOnly)} />
        </>
      )}
    </>
  );
}
