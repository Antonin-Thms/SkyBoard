"use client";

import { Check } from "lucide-react";
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
  // Kneeboards cochés d'office ; images de briefing à cocher si besoin.
  const [selected, setSelected] = useState(
    () => new Set(entries.filter((e) => e.kind === "kneeboard").map((e) => e.path)),
  );
  const kneeboardCount = entries.filter((e) => e.kind === "kneeboard").length;
  const briefingCount = entries.length - kneeboardCount;
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
      <div className="flex items-center justify-between gap-3 border border-line bg-raised p-4 text-sm">
        <p className="text-slate-400">
          Aucune image de kneeboard ni de briefing dans « {missionFileName} ».
        </p>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 border border-line bg-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Images de « {missionFileName} »</h2>
          <p className="text-sm text-slate-400">
            {kneeboardCount} kneeboard{kneeboardCount > 1 ? "s" : ""} · {briefingCount} image
            {briefingCount > 1 ? "s" : ""} de briefing. Coche celles à ajouter à tes documents.
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
                className={`flex w-full flex-col overflow-hidden text-left transition ${on ? "" : "opacity-50"}`}
              >
                <div className={`relative aspect-[3/4] w-full bg-sunken ${on ? "ring-2 ring-accent" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob) */}
                  <img src={previews[i]} alt="" className="h-full w-full object-contain" />
                  <span
                    aria-hidden="true"
                    className={`absolute right-2 top-2 flex size-[18px] items-center justify-center rounded-[2px] border-[1.5px] ${
                      on ? "border-accent bg-accent text-on-accent" : "border-muted bg-sunken/70 text-transparent"
                    }`}
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                </div>
                <span className="truncate pt-2 text-[13px]">{e.baseName}</span>
                <span className="truncate text-[11px] text-subtle">
                  {e.kind === "briefing" ? "Briefing" : (e.aircraft ?? "Kneeboard · tous appareils")}
                </span>
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
