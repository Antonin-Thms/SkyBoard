"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExtractedKneeboard } from "@/lib/documents/miz-extract";
import { kneeboardDocumentName } from "@/lib/documents/miz";

interface MizImportProps {
  missionFileName: string;
  entries: ExtractedKneeboard[];
  busy: boolean;
  onImport: (items: { file: File; name: string }[]) => void;
  onCancel: () => void;
}

/** Choix des images de kneeboard à importer depuis un fichier de mission. */
export function MizImport({ missionFileName, entries, busy, onImport, onCancel }: MizImportProps) {
  const [selected, setSelected] = useState(() => new Set(entries.map((e) => e.path)));
  const previews = useMemo(() => entries.map((e) => URL.createObjectURL(e.file)), [entries]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const toggle = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 p-4 text-sm">
        <p className="text-slate-400">
          Aucune image de kneeboard dans « {missionFileName} » (dossier KNEEBOARD de la mission).
        </p>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-sky-900/60 bg-sky-950/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Kneeboards de la mission « {missionFileName} »</h2>
          <p className="text-sm text-slate-400">
            {entries.length} image{entries.length > 1 ? "s" : ""} trouvée{entries.length > 1 ? "s" : ""}.
            Coche celles à ajouter à tes documents.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <button type="button" className="text-slate-400 hover:text-white" onClick={() => setSelected(new Set(entries.map((e) => e.path)))}>
            Tout
          </button>
          <button type="button" className="text-slate-400 hover:text-white" onClick={() => setSelected(new Set())}>
            Aucun
          </button>
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {entries.map((e, i) => {
          const on = selected.has(e.path);
          return (
            <li key={e.path}>
              <button
                type="button"
                onClick={() => toggle(e.path)}
                className={`flex w-full flex-col overflow-hidden rounded-xl border text-left ${
                  on ? "border-sky-500 ring-2 ring-sky-500" : "border-slate-800 opacity-50"
                }`}
              >
                <div className="relative aspect-[3/4] w-full bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob) */}
                  <img src={previews[i]} alt="" className="h-full w-full object-contain" />
                  <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1 text-xs">{on ? "✓" : ""}</span>
                </div>
                <span className="truncate px-2 pt-1 text-xs">{e.baseName}</span>
                <span className="truncate px-2 pb-1.5 text-[10px] text-slate-500">{e.aircraft ?? "Tous appareils"}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={busy || selected.size === 0}
          onClick={() =>
            onImport(
              entries
                .filter((e) => selected.has(e.path))
                .map((e) => ({ file: e.file, name: kneeboardDocumentName(missionFileName, e) })),
            )
          }
        >
          Importer {selected.size} image{selected.size > 1 ? "s" : ""}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Annuler
        </button>
      </div>
    </div>
  );
}
