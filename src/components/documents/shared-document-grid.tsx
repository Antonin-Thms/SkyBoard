"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { setFavorites } from "@/app/(app)/documents/actions";
import { CachedThumbnail } from "@/components/cached-thumbnail";
import { EmptyState } from "@/components/ui/empty-state";
import type { DocumentSummary } from "@/lib/documents/server-types";
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";

/** Documents d'un dossier partagé par un coéquipier : consultation seulement. */
export function SharedDocumentGrid({ documents }: { documents: DocumentSummary[] }) {
  const t = useT().documents;
  const [favorites, setLocal] = useState(() => new Set(documents.filter((d) => d.favorite).map((d) => d.id)));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Favori aussi sur un document partagé : il est parcouru en mode vol.
  const toggle = (id: string) => {
    const on = !favorites.has(id);
    const update = (add: boolean) =>
      setLocal((prev) => {
        const next = new Set(prev);
        if (add) next.add(id);
        else next.delete(id);
        return next;
      });
    update(on);
    setError(null);
    startTransition(async () => {
      const res = await setFavorites([id], on).catch(() => ({ error: t.errors.server }));
      if (res.error) {
        update(!on);
        setError(res.error);
      }
    });
  };

  if (documents.length === 0) {
    return <EmptyState title={t.emptyTitle} text={t.shared.emptyText} />;
  }
  return (
    <>
    {error && <p className="mb-3 text-sm text-danger">{error}</p>}
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
                {d.type === "application/pdf" ? "PDF" : t.shared.image}
              </div>
            )}
            {d.pageCount > 1 && (
              <span className="numeric absolute bottom-2 right-2 bg-surface/85 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-slate-300">
                {fmt(t.shared.pages, { n: d.pageCount })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate text-[15px] font-medium" title={d.name}>
              {d.name}
            </p>
            <button
              type="button"
              className="btn-icon -mr-2 size-8"
              aria-pressed={favorites.has(d.id)}
              aria-label={favorites.has(d.id) ? t.grid.favoriteRemove : t.grid.favoriteAdd}
              title={favorites.has(d.id) ? t.grid.favoriteRemove : t.grid.favoriteAdd}
              onClick={() => toggle(d.id)}
            >
              <Star
                size={16}
                strokeWidth={1.75}
                className={favorites.has(d.id) ? "fill-accent text-accent" : ""}
              />
            </button>
          </div>
        </li>
      ))}
    </ul>
    </>
  );
}
