"use client";

import Link from "next/link";
import { useState } from "react";
import { HelpPanel } from "@/components/help-panel";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { RemoteCockpit, RemoteDocument } from "@/lib/remote/types";
import { CockpitRemote } from "./cockpit-remote";

interface RemoteAppProps {
  cockpits: RemoteCockpit[];
  documents: RemoteDocument[];
}

export function RemoteApp({ cockpits, documents }: RemoteAppProps) {
  const [storedId, setStoredId] = useLocalStorage("skyboard:cockpit");
  const [mode, setMode] = useState<"prep" | "flight">("prep");
  const cockpit = cockpits.find((c) => c.id === storedId) ?? cockpits[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Cockpit</span>
          <select
            className="input w-auto"
            value={cockpit.id}
            onChange={(e) => setStoredId(e.target.value)}
          >
            {cockpits.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex rounded-lg border border-slate-700 p-0.5 text-sm" role="tablist">
          {(
            [
              ["prep", "Préparation"],
              ["flight", "Vol"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-md px-4 py-1.5 ${
                mode === value ? "bg-sky-500 text-slate-950" : "text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <HelpPanel defaultOpen={false}>
        <ul className="list-disc space-y-1 pl-5">
          <li>Choisis le cockpit à piloter : c&apos;est celui dont l&apos;URL est dans OpenKneeboard.</li>
          <li>
            <strong>Préparation</strong> : tape une miniature pour l&apos;afficher dans le casque,
            puis utilise les boutons de page. Chaque document reprend à la dernière page vue.
          </li>
          <li>
            <strong>Vol</strong> : plein écran entièrement tactile, utilisable sans regarder :
            <ul className="mt-1 list-[circle] space-y-0.5 pl-5">
              <li>pincer à deux doigts : zoom centré sur les doigts ;</li>
              <li>glisser à deux doigts (ou à un doigt quand c&apos;est zoomé) : déplacer ;</li>
              <li>swipe horizontal à un doigt (non zoomé) : page suivante ← / précédente → ;</li>
              <li>double tap : zoom et position remis à zéro ;</li>
              <li>
                bandes étroites sur les bords gauche et droit de l&apos;écran : swipe vers le bas =
                document suivant, vers le haut = précédent ;
              </li>
              <li>« Curseur » (en haut) : affiche la position du doigt dans le casque (URL avec l&apos;option curseur).</li>
            </ul>
          </li>
          <li>
            Le point en haut indique la connexion temps réel : vert = connecté, orange =
            connexion en cours.
          </li>
        </ul>
      </HelpPanel>

      {documents.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 p-8 text-center text-slate-400">
          Aucun document. Ajoute-en sur la page{" "}
          <Link href="/documents" className="text-sky-400 hover:underline">
            Documents
          </Link>
          .
        </p>
      ) : (
        <CockpitRemote
          key={cockpit.id}
          cockpit={cockpit}
          documents={documents}
          mode={mode}
          onExitFlight={() => setMode("prep")}
        />
      )}
    </div>
  );
}
