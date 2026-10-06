"use client";

import type { RemoteDocument } from "@/lib/remote/types";

interface PrepModeProps {
  documents: RemoteDocument[];
  current: RemoteDocument | null;
  page: number;
  onSelect: (doc: RemoteDocument) => void;
  onStepPage: (delta: number) => void;
  onStepDocument: (delta: number) => void;
}

/** Mode préparation : on regarde l'iPad, grille de miniatures et gros boutons. */
export function PrepMode({ documents, current, page, onSelect, onStepPage, onStepDocument }: PrepModeProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">Dans le casque</p>
          <p className="truncate font-medium">{current ? current.name : "Aucun document"}</p>
          {current && (
            <p className="text-sm text-slate-400">
              Page {page} / {current.pageCount}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary h-12 min-w-12 text-lg"
            aria-label="Page précédente"
            onClick={() => onStepPage(-1)}
            disabled={!current || page <= 1}
          >
            ◀
          </button>
          <button
            type="button"
            className="btn-primary h-12 min-w-12 text-lg"
            aria-label="Page suivante"
            onClick={() => onStepPage(1)}
            disabled={!!current && page >= current.pageCount}
          >
            ▶
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary h-12 text-sm"
            onClick={() => onStepDocument(-1)}
            disabled={documents.length < 2}
          >
            ▲ Doc
          </button>
          <button
            type="button"
            className="btn-secondary h-12 text-sm"
            onClick={() => onStepDocument(1)}
            disabled={documents.length < 2}
          >
            Doc ▼
          </button>
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {documents.map((doc) => {
          const active = doc.id === current?.id;
          return (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => onSelect(doc)}
                className={`flex w-full flex-col overflow-hidden rounded-xl border text-left transition active:scale-95 ${
                  active ? "border-sky-500 ring-2 ring-sky-500" : "border-slate-800"
                }`}
              >
                <div className="relative aspect-[3/4] w-full bg-slate-950">
                  {doc.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase
                    <img src={doc.thumbnailUrl} alt="" className="h-full w-full object-contain" draggable={false} />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-slate-600">
                      {doc.type === "application/pdf" ? "PDF" : "Image"}
                    </span>
                  )}
                  {doc.pageCount > 1 && (
                    <span className="absolute bottom-1 right-1 rounded bg-slate-900/80 px-1 text-[10px] text-slate-300">
                      {doc.pageCount} p.
                    </span>
                  )}
                </div>
                <span className="truncate px-2 py-1.5 text-xs">{doc.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
