"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import {
  deleteCockpit,
  regenerateCockpitToken,
  renameCockpit,
} from "@/app/(app)/cockpits/actions";
import { CopyButton } from "@/components/copy-button";
import { buildViewerUrl } from "@/lib/cockpits/token";

interface CockpitCardProps {
  id: string;
  name: string;
  token: string;
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

export function CockpitCard({ id, name, token }: CockpitCardProps) {
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

      <div className="space-y-2">
        <span className="text-sm text-slate-400">URL viewer (Web Dashboard d&apos;OpenKneeboard)</span>
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
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
            Fond transparent
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hideStatus} onChange={(e) => setHideStatus(e.target.checked)} />
            Masquer l&apos;indicateur de connexion
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={cursor} onChange={(e) => setCursor(e.target.checked)} />
            Autoriser le curseur
          </label>
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
