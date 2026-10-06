"use client";

import { CachedThumbnail } from "@/components/cached-thumbnail";
import type { RemoteDocument } from "@/lib/remote/types";

interface PrepModeProps {
  documents: RemoteDocument[];
  current: RemoteDocument | null;
  page: number;
  zoomed: boolean;
  /** Téléphone : mise en page resserrée */
  compact?: boolean;
  onSelect: (doc: RemoteDocument) => void;
  onStepPage: (delta: number) => void;
  onStepDocument: (delta: number) => void;
  onResetZoom: () => void;
  night: boolean;
  onToggleNight: () => void;
}

/** Mode préparation : on regarde l'écran, grille de miniatures et gros boutons. */
export function PrepMode({
  documents,
  current,
  page,
  zoomed,
  compact = false,
  onSelect,
  onStepPage,
  onStepDocument,
  onResetZoom,
  night,
  onToggleNight,
}: PrepModeProps) {
  return (
    <div className="space-y-4">
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 ${
          compact ? "sticky top-0 z-10 bg-slate-900" : ""
        }`}
      >
        <div className={`min-w-0 ${compact ? "basis-full" : "flex-1"}`}>
          <p className="text-xs text-slate-500">Dans le casque</p>
          <p className="truncate font-medium">{current ? current.name : "Aucun document"}</p>
          {current && (
            <p className="text-sm text-slate-400">
              Document {documents.findIndex((d) => d.id === current.id) + 1} / {documents.length}
              {current.pageCount > 1 && ` · page ${page} / ${current.pageCount}`}
            </p>
          )}
        </div>
        {/* Navigation principale : un kneeboard = un document. */}
        <div className={`flex gap-2 ${compact ? "flex-1 [&>button]:flex-1" : ""}`}>
          <button
            type="button"
            className="btn-secondary h-12 min-w-12 text-lg"
            aria-label="Document précédent"
            onClick={() => onStepDocument(-1)}
            disabled={documents.length < 2}
          >
            ◀
          </button>
          <button
            type="button"
            className="btn-primary h-12 min-w-12 text-lg"
            aria-label="Document suivant"
            onClick={() => onStepDocument(1)}
            disabled={documents.length < 2 && !!current}
          >
            ▶
          </button>
        </div>
        {/* Pages : seulement pour les documents de plusieurs pages. */}
        {current && current.pageCount > 1 && (
          <div className={`flex gap-2 ${compact ? "flex-1 [&>button]:flex-1" : ""}`}>
            <button
              type="button"
              className="btn-secondary h-12 whitespace-nowrap px-3 text-sm"
              onClick={() => onStepPage(-1)}
              disabled={page <= 1}
            >
              ▲ Page
            </button>
            <button
              type="button"
              className="btn-secondary h-12 whitespace-nowrap px-3 text-sm"
              onClick={() => onStepPage(1)}
              disabled={page >= current.pageCount}
            >
              Page ▼
            </button>
          </div>
        )}
        <button
          type="button"
          aria-pressed={night}
          className={`h-12 whitespace-nowrap px-3 text-sm ${night ? "btn-primary" : "btn-secondary"}`}
          onClick={onToggleNight}
          title="Atténue la page dans le casque (vol de nuit)"
        >
          ☾ Nuit
        </button>
        {zoomed && (
          <button type="button" className="btn-secondary h-12 whitespace-nowrap px-3 text-sm" onClick={onResetZoom}>
            Zoom 1:1
          </button>
        )}
      </div>

      <ul
        className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"}`}
      >
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
                    <CachedThumbnail docId={doc.id} url={doc.thumbnailUrl} rotation={doc.rotation} />
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
