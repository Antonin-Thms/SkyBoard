"use client";

import { CachedThumbnail } from "@/components/cached-thumbnail";
import type { DocumentSummary } from "@/lib/documents/server-types";

/** Documents d'un dossier partagé par un coéquipier : consultation seulement. */
export function SharedDocumentGrid({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0) {
    return <p className="border border-slate-800 p-8 text-center text-slate-500">Ce dossier partagé est vide.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {documents.map((d) => (
        <li key={d.id} className="flex flex-col gap-2.5">
          <div className="relative aspect-[3/4] overflow-hidden bg-[#e9e6df]">
            {d.thumbnailUrl ? (
              <CachedThumbnail docId={d.id} url={d.thumbnailUrl} rotation={d.rotation} />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">
                {d.type === "application/pdf" ? "PDF" : "Image"}
              </div>
            )}
            {d.pageCount > 1 && (
              <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs text-slate-300">
                {d.pageCount} p.
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
