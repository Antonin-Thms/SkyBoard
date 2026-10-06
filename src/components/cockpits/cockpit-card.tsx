"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import {
  deleteCockpit,
  regenerateCockpitToken,
  renameCockpit,
  setActiveFolder,
} from "@/app/(app)/cockpits/actions";
import { ExternalLink, Pencil, Plane, RefreshCw, Trash2 } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { folderOptions } from "@/components/ui/folder-options";
import { Menu } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { buildViewerUrl } from "@/lib/cockpits/token";
import type { FolderSummary } from "@/lib/documents/folders";

interface CockpitCardProps {
  id: string;
  name: string;
  token: string;
  activeFolderId: string | null;
  folders: FolderSummary[];
}

const subscribeNoop = () => () => {};

/** Origine du site, connue seulement côté navigateur. */
function useOrigin(): string {
  return useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => "",
  );
}

export function CockpitCard({ id, name, token, activeFolderId, folders }: CockpitCardProps) {
  const origin = useOrigin();
  const [editing, setEditing] = useState(false);
  const [folder, setFolder] = useState(activeFolderId ?? "");
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const url = origin ? buildViewerUrl(origin, token) : "";

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      setError(res.error ?? null);
      if (!res.error) setEditing(false);
    });

  return (
    <li
      className={`space-y-5 border border-line bg-raised p-5 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameCockpit(id, draft));
            }}
          >
            <input
              className="input"
              value={draft}
              maxLength={100}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              Enregistrer
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDraft(name);
                setEditing(false);
              }}
            >
              Annuler
            </button>
          </form>
        ) : (
          <h2 className="flex items-center gap-2.5 text-lg font-medium">
            <Plane size={18} strokeWidth={1.75} className="text-muted" />
            {name}
          </h2>
        )}
        {!editing && (
          <Menu
            label={`Actions pour ${name}`}
            items={[
              { label: "Renommer", icon: <Pencil size={16} strokeWidth={1.75} />, onSelect: () => setEditing(true) },
              {
                label: "Régénérer l'URL",
                icon: <RefreshCw size={16} strokeWidth={1.75} />,
                onSelect: () => {
                  if (
                    window.confirm(
                      "Régénérer l'URL ? L'URL actuelle cessera immédiatement de fonctionner : il faudra coller la nouvelle dans OpenKneeboard.",
                    )
                  ) {
                    run(() => regenerateCockpitToken(id));
                  }
                },
              },
              {
                label: "Supprimer le cockpit",
                icon: <Trash2 size={16} strokeWidth={1.75} />,
                danger: true,
                separator: true,
                onSelect: () => {
                  if (window.confirm(`Supprimer le cockpit « ${name} » ? Son URL viewer cessera de fonctionner.`)) {
                    run(() => deleteCockpit(id));
                  }
                },
              },
            ]}
          />
        )}
      </div>

      {folders.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="label-caps w-full">Dossier actif</span>
          <Select
            label="Dossier actif"
            value={folder}
            disabled={pending}
            className="w-full sm:w-72"
            options={folderOptions(folders, [{ value: "", label: "Tous les documents" }])}
            onChange={(v) => {
              setFolder(v);
              run(() => setActiveFolder(id, v || null));
            }}
          />
          <span className="text-xs text-subtle">+ les documents Communs</span>
        </div>
      )}

      <div className="space-y-1.5">
        <span className="label-caps">URL viewer · onglet Web Dashboard d&apos;OpenKneeboard</span>
        <div className="flex flex-wrap gap-2">
          <input
            className="input min-w-0 basis-full font-mono sm:basis-0 sm:flex-1 text-xs text-slate-300"
            aria-label="URL viewer"
            value={url}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton text={url} />
          <a className="btn-secondary" href={url || undefined} target="_blank" rel="noreferrer">
            <ExternalLink size={16} strokeWidth={1.75} />
            Ouvrir
          </a>
        </div>
        <p className="text-xs text-subtle">Garde-la secrète. Si elle a fuité : menu ⋯ → Régénérer l&apos;URL.</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </li>
  );
}

