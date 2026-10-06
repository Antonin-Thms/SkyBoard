"use client";

import { CachedThumbnail } from "@/components/cached-thumbnail";
import { EmptyState } from "@/components/ui/empty-state";
import type { DocumentSummary } from "@/lib/documents/server-types";

/** Documents d'un dossier partagé par un coéquipier : consultation seulement. */
export function SharedDocumentGrid({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0) {
    return <EmptyState title="Rien ici pour l'instant" text="Ce dossier partagé est encore vide." />;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-9 lg:grid-cols-4">
      {documents.map((d) => (
        <li key={d.id} className="flex flex-col gap-2.5">
          <div
            className={`relative aspect-[3/4] overflow-hidden ${d.type === "application/pdf" ? "bg-paper" : "bg-sunken"}`}
          >
            {d.thumbnailUrl ? (
              <CachedThumbnail docId={d.id} url={d.thumbnailUrl} rotation={d.rotation} />
            ) : (
              <div className="flex h-full items-center justify-center text-subtle">
                {d.type === "application/pdf" ? "PDF" : "Image"}
              </div>
            )}
            {d.pageCount > 1 && (
              <span className="numeric absolute bottom-2 right-2 bg-surface/85 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-slate-300">
                {d.pageCount} p
              </span>
            )}
          </div>
          <p className="truncate text-[15px] font-medium" title={d.name}>
            {d.name}
          </p>
        </li>
      ))}
    </ul>
  );
}
