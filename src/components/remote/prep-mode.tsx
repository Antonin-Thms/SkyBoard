"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Maximize, Moon, PenLine } from "lucide-react";
import { CachedThumbnail } from "@/components/cached-thumbnail";
import { Menu, type MenuItem } from "@/components/ui/menu";
import type { RemoteDocument } from "@/lib/remote/types";

interface PrepModeProps {
  documents: RemoteDocument[];
  current: RemoteDocument | null;
  page: number;
  zoomed: boolean;
  /** Téléphone : mise en page resserrée, commandes en bas d'écran */
  compact?: boolean;
  onSelect: (doc: RemoteDocument) => void;
  onStepPage: (delta: number) => void;
  onStepDocument: (delta: number) => void;
  onResetZoom: () => void;
  night: boolean;
  onToggleNight: () => void;
  /** Ouvre l'éditeur d'annotations sur la page affichée */
  onAnnotate: () => void;
}

const two = (n: number) => String(n).padStart(2, "0");
const square =
  "flex size-14 shrink-0 items-center justify-center rounded-[2px] border border-line-strong bg-surface text-fg transition hover:bg-raised active:scale-[0.97] disabled:opacity-40";

/** Mode préparation : on regarde l'écran. Barre d'instrument + grille de miniatures. */
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
  onAnnotate,
}: PrepModeProps) {
  const index = current ? documents.findIndex((d) => d.id === current.id) : -1;
  const multiPage = !!current && current.pageCount > 1;
  const single = documents.length < 2;

  const counter = (
    <div className={compact ? "text-right" : "flex flex-col items-center justify-center"}>
      <div className={`numeric leading-none tracking-wide ${compact ? "text-[26px]" : "text-[34px]"}`}>
        {index >= 0 ? two(index + 1) : "--"}
        <span className="text-disabled">/</span>
        {two(documents.length)}
      </div>
      {multiPage && (
        <div className="numeric mt-1 text-[11px] tracking-[0.12em] text-muted">
          PAGE {page}/{current.pageCount}
        </div>
      )}
    </div>
  );

  const title = (
    <div className="min-w-0">
      <div className="label-caps flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-accent" />
        Dans le casque
      </div>
      <div className={`mt-0.5 truncate font-medium ${compact ? "text-base" : "text-xl"}`}>
        {current ? current.name : "Aucun document"}
      </div>
    </div>
  );

  // Téléphone : actions secondaires dans un menu.
  const moreItems: MenuItem[] = [
    { label: night ? "Mode nuit : activé" : "Mode nuit", icon: <Moon size={16} strokeWidth={1.75} />, onSelect: onToggleNight },
    ...(multiPage
      ? [
          { label: "Page précédente", icon: <ChevronUp size={16} strokeWidth={1.75} />, onSelect: () => onStepPage(-1), disabled: page <= 1 },
          { label: "Page suivante", icon: <ChevronDown size={16} strokeWidth={1.75} />, onSelect: () => onStepPage(1), disabled: page >= current.pageCount },
        ]
      : []),
    ...(zoomed ? [{ label: "Zoom 1:1", icon: <Maximize size={16} strokeWidth={1.75} />, onSelect: onResetZoom }] : []),
  ];

  return (
    <div className="space-y-4">
      {compact ? (
        <section aria-label="Dans le casque" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border border-line bg-raised px-3.5 py-3">
          {title}
          {counter}
        </section>
      ) : (
        <section aria-label="Dans le casque" className="flex flex-wrap items-stretch border border-line bg-raised">
          <div className="flex min-w-0 flex-1 items-center px-5 py-4">{title}</div>
          <div className="flex items-center border-x border-line px-6">{counter}</div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button type="button" className={square} aria-label="Document précédent" onClick={() => onStepDocument(-1)} disabled={single}>
              <ChevronLeft size={22} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="flex size-14 shrink-0 items-center justify-center rounded-[2px] bg-accent text-on-accent transition hover:bg-accent-hover active:scale-[0.97] disabled:opacity-40"
              aria-label="Document suivant"
              onClick={() => onStepDocument(1)}
              disabled={single && !!current}
            >
              <ChevronRight size={22} strokeWidth={2.25} />
            </button>
            {multiPage && (
              <>
                <span className="mx-1 h-10 w-px bg-line-strong" />
                <button type="button" className={`${square} w-12`} aria-label="Page précédente" onClick={() => onStepPage(-1)} disabled={page <= 1}>
                  <ChevronUp size={22} strokeWidth={1.75} />
                </button>
                <button type="button" className={`${square} w-12`} aria-label="Page suivante" onClick={() => onStepPage(1)} disabled={page >= current.pageCount}>
                  <ChevronDown size={22} strokeWidth={1.75} />
                </button>
              </>
            )}
            <span className="mx-1 h-10 w-px bg-line-strong" />
            {current && (
              <button type="button" className={`${square} w-auto gap-2 px-4 text-sm`} onClick={onAnnotate} title="Dessiner sur la page affichée (visible en direct dans le casque)">
                <PenLine size={20} strokeWidth={1.75} />
                Annoter
              </button>
            )}
            <button
              type="button"
              aria-pressed={night}
              aria-label="Mode nuit"
              title="Atténue la page dans le casque (vol de nuit)"
              className={night ? `${square} border-accent bg-accent-subtle text-accent` : square}
              onClick={onToggleNight}
            >
              <Moon size={20} strokeWidth={1.75} />
            </button>
            {zoomed && (
              <button type="button" className={`${square} w-auto gap-2 px-4 text-sm`} onClick={onResetZoom}>
                <Maximize size={18} strokeWidth={1.75} />
                Zoom 1:1
              </button>
            )}
          </div>
        </section>
      )}

      <ul className={`grid gap-x-3 gap-y-4 ${compact ? "grid-cols-2" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"}`}>
        {documents.map((doc) => {
          const active = doc.id === current?.id;
          return (
            <li key={doc.id}>
              <button type="button" onClick={() => onSelect(doc)} aria-current={active ? "true" : undefined} className="block w-full text-left transition active:scale-[0.97]">
                <span
                  className={`relative block aspect-[3/4] w-full overflow-hidden ${
                    doc.type === "application/pdf" ? "bg-paper" : "bg-sunken"
                  } ${active ? "outline outline-2 outline-offset-[3px] outline-accent" : ""}`}
                >
                  {doc.thumbnailUrl ? (
                    <CachedThumbnail docId={doc.id} url={doc.thumbnailUrl} rotation={doc.rotation} />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-subtle">
                      {doc.type === "application/pdf" ? "PDF" : "Image"}
                    </span>
                  )}
                  {doc.pageCount > 1 && (
                    <span className="numeric absolute bottom-1.5 right-1.5 bg-surface/85 px-1.5 text-[11px] tracking-wider text-slate-300">
                      {doc.pageCount} P
                    </span>
                  )}
                </span>
                <span className={`block truncate pt-2 text-[13px] ${active ? "text-accent" : "text-slate-300"}`}>{doc.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Téléphone : commandes principales sous le pouce, au-dessus de la barre d'onglets */}
      {compact && (
        <>
          <div className="h-20" aria-hidden="true" />
          <nav
            aria-label="Commandes"
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 grid grid-cols-[56px_minmax(0,1fr)_56px_56px] gap-2 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur"
          >
            <button type="button" className={square} aria-label="Document précédent" onClick={() => onStepDocument(-1)} disabled={single}>
              <ChevronLeft size={22} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="flex h-14 items-center justify-center gap-2 rounded-[2px] bg-accent text-[15px] font-semibold text-on-accent transition active:scale-[0.98] disabled:opacity-40"
              onClick={() => onStepDocument(1)}
              disabled={single && !!current}
            >
              Suivant
              <ChevronRight size={20} strokeWidth={2.25} />
            </button>
            <button type="button" className={square} aria-label="Annoter" onClick={onAnnotate} disabled={!current}>
              <PenLine size={20} strokeWidth={1.75} />
            </button>
            <Menu label="Plus d'actions" items={moreItems} side="top" triggerClassName={square} />
          </nav>
        </>
      )}
    </div>
  );
}
