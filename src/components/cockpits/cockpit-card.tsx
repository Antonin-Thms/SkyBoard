"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import {
  deleteCockpit,
  regenerateCockpitToken,
  renameCockpit,
  setActiveFolder,
} from "@/app/(app)/cockpits/actions";
import { CopyButton } from "@/components/copy-button";
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
  const [transparent, setTransparent] = useState(false);
  const [hideStatus, setHideStatus] = useState(false);
  const [cursor, setCursor] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const url = origin ? buildViewerUrl(origin, token, { transparent, hideStatus, cursor }) : "";

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      setError(res.error ?? null);
      if (!res.error) setEditing(false);
    });

  return (
    <li
      className={`space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 ${
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
              OK
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setDraft(name);
                setEditing(false);
              }}
            >
              Annuler
            </button>
          </form>
        ) : (
          <h2 className="text-lg font-medium">{name}</h2>
        )}
        <div className="flex gap-3 text-sm">
          {!editing && (
            <button type="button" className="text-slate-400 hover:text-white" onClick={() => setEditing(true)}>
              Renommer
            </button>
          )}
          <button
            type="button"
            className="text-red-400 hover:text-red-300"
            onClick={() => {
              if (window.confirm(`Supprimer le cockpit « ${name} » ? Son URL viewer cessera de fonctionner.`)) {
                run(() => deleteCockpit(id));
              }
            }}
          >
            Supprimer
          </button>
        </div>
      </div>

      {folders.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-400">Dossier actif</span>
          <select
            className="input w-auto"
            defaultValue={activeFolderId ?? ""}
            disabled={pending}
            onChange={(e) => {
              const folderId = e.target.value || null;
              run(() => setActiveFolder(id, folderId));
            }}
          >
            <option value="">Tous les documents</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">+ les documents Communs</span>
        </label>
      )}

      <div className="space-y-2">
        <span className="text-sm text-slate-400">
          URL viewer — à coller dans un onglet Web Dashboard d&apos;OpenKneeboard
        </span>
        <div className="flex flex-wrap gap-2">
          <input
            className="input min-w-0 flex-1 font-mono text-xs"
            value={url}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton text={url} />
          <a className="btn-secondary" href={url || undefined} target="_blank" rel="noreferrer">
            Ouvrir
          </a>
        </div>
        <div className="grid gap-2 pt-1 text-sm sm:grid-cols-3">
          <Option
            checked={transparent}
            onChange={setTransparent}
            label="Fond transparent"
            hint="Pas de fond noir autour de la page : seul le document apparaît dans le casque."
          />
          <Option
            checked={hideStatus}
            onChange={setHideStatus}
            label="Masquer l'indicateur"
            hint="Cache le petit point de connexion en bas à droite (vert = OK, orange = connexion, rouge = erreur)."
          />
          <Option
            checked={cursor}
            onChange={setCursor}
            label="Autoriser le curseur"
            hint="Affiche la position de ton doigt sur l'iPad (disponible en phase 5)."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-danger"
          onClick={() => {
            if (
              window.confirm(
                "Régénérer le token ? L'URL actuelle cessera immédiatement de fonctionner : il faudra coller la nouvelle dans OpenKneeboard.",
              )
            ) {
              run(() => regenerateCockpitToken(id));
            }
          }}
        >
          Régénérer le token
        </button>
        <span className="text-xs text-slate-500">À faire si l&apos;URL a fuité.</span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </li>
  );
}

interface OptionProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}

function Option({ checked, onChange, label, hint }: OptionProps) {
  return (
    <label className="flex cursor-pointer gap-2 rounded-lg border border-slate-800 p-2 hover:border-slate-700">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-slate-200">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
