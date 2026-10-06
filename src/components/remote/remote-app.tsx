"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import { HelpPanel } from "@/components/help-panel";
import { Select } from "@/components/ui/select";
import { useDeviceKind } from "@/hooks/use-device-kind";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { FolderSummary } from "@/lib/documents/folders";
import type { RemoteCockpit, RemoteDocument } from "@/lib/remote/types";
import { CockpitRemote } from "./cockpit-remote";
import { RemoteQr } from "./remote-qr";

interface RemoteAppProps {
  cockpits: RemoteCockpit[];
  documents: RemoteDocument[];
  folders: FolderSummary[];
  /** Cockpit demandé par l'URL (QR code) */
  initialCockpitId: string | null;
  initialMode: "prep" | "flight";
}

export function RemoteApp({ cockpits, documents, folders, initialCockpitId, initialMode }: RemoteAppProps) {
  const [storedId, setStoredId] = useLocalStorage("skyboard:cockpit");
  const [mode, setMode] = useState<"prep" | "flight">(initialMode);
  const device = useDeviceKind();
  const cockpit =
    cockpits.find((c) => c.id === (initialCockpitId ?? storedId)) ??
    cockpits.find((c) => c.id === storedId) ??
    cockpits[0];

  // Ouverture par QR code : on mémorise le cockpit et on nettoie l'URL
  // (un rechargement ne doit pas forcer à nouveau le mode vol).
  useEffect(() => {
    if (initialCockpitId) setStoredId(initialCockpitId);
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [initialCockpitId, setStoredId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Select
          label="Cockpit"
          value={cockpit.id}
          onChange={setStoredId}
          icon={<Plane size={15} strokeWidth={1.75} />}
          className="min-w-0 flex-1 sm:max-w-64"
          options={cockpits.map((c) => ({ value: c.id, label: c.name, icon: <Plane size={15} strokeWidth={1.75} /> }))}
        />

        <div className="flex shrink-0 rounded-[2px] border border-line-strong p-[3px] text-sm" role="tablist">
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
              className={`h-[34px] rounded-[2px] px-3.5 transition sm:px-4 pointer-coarse:h-10 ${
                mode === value ? "bg-accent font-semibold text-on-accent" : "text-slate-300 hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {device === "desktop" ? (
        <RemoteQr key={cockpit.id} cockpitId={cockpit.id} cockpitName={cockpit.name} />
      ) : (
        device && (
          <details className="border border-line p-3 text-sm">
            <summary className="cursor-pointer text-muted">
              Ouvrir sur un autre appareil (QR code)
            </summary>
            <div className="mt-3">
              <RemoteQr key={cockpit.id} cockpitId={cockpit.id} cockpitName={cockpit.name} />
            </div>
          </details>
        )
      )}

      <HelpPanel defaultOpen={false}>
        <ul className="list-disc space-y-1 pl-5">
          <li>Choisis le cockpit à piloter : c&apos;est celui dont l&apos;URL est dans OpenKneeboard.</li>
          <li>
            <strong>Préparation</strong> : tape une miniature pour l&apos;afficher dans le casque,
            puis utilise les boutons de page. Chaque document reprend à la dernière page vue.
            « ✎ Annoter » ouvre la page en grand pour dessiner en la regardant (visible en
            direct dans le casque).
          </li>
          <li>
            <strong>Vol</strong> : plein écran entièrement tactile, utilisable sans regarder :
            <ul className="mt-1 list-[circle] space-y-0.5 pl-5">
              <li>pincer à deux doigts : zoom centré sur les doigts ;</li>
              <li>glisser à deux doigts (ou à un doigt quand c&apos;est zoomé) : déplacer ;</li>
              <li>swipe horizontal à un doigt (non zoomé) : document suivant ← / précédent → ;</li>
              <li>double tap : zoom et position remis à zéro ;</li>
              <li>
                bandes étroites sur les bords gauche et droit de l&apos;écran : swipe vers le bas =
                page suivante, vers le haut = précédente (PDF de plusieurs pages) ;
              </li>
              <li>« Curseur » (en haut, maintenir) : affiche la position du doigt dans le casque ;</li>
              <li>
                appui long de 1,5 s sans bouger, n&apos;importe où : crayon activé / désactivé.
                Crayon actif : un doigt dessine, tap à deux doigts = annuler le dernier trait,
                pincer = zoom.
              </li>
            </ul>
          </li>
          <li>
            Le point en haut indique la connexion temps réel : vert = connecté, orange =
            connexion en cours.
          </li>
        </ul>
      </HelpPanel>

      {documents.length === 0 ? (
        <p className="border border-dashed border-line-strong p-8 text-center text-muted">
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
          folders={folders}
          mode={mode}
          device={device ?? "tablet"}
          onExitFlight={() => setMode("prep")}
        />
      )}
    </div>
  );
}
