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
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";
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
  const t = useT();
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
              {t.cockpits.card.save}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDraft(name);
                setEditing(false);
              }}
            >
              {t.cockpits.card.cancel}
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
            label={fmt(t.cockpits.card.menuLabel, { name })}
            items={[
              { label: t.cockpits.card.rename, icon: <Pencil size={16} strokeWidth={1.75} />, onSelect: () => setEditing(true) },
              {
                label: t.cockpits.card.regenerate,
                icon: <RefreshCw size={16} strokeWidth={1.75} />,
                onSelect: () => {
                  if (
                    window.confirm(t.cockpits.card.regenerateConfirm)
                  ) {
                    run(() => regenerateCockpitToken(id));
                  }
                },
              },
              {
                label: t.cockpits.card.delete,
                icon: <Trash2 size={16} strokeWidth={1.75} />,
                danger: true,
                separator: true,
                onSelect: () => {
                  if (window.confirm(fmt(t.cockpits.card.deleteConfirm, { name }))) {
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
          <span className="label-caps w-full">{t.cockpits.card.activeFolder}</span>
          <Select
            label={t.cockpits.card.activeFolder}
            value={folder}
            disabled={pending}
            className="w-full sm:w-72"
            options={folderOptions(folders, [{ value: "", label: t.cockpits.card.allDocuments }], t.common.folders.squadronGroup)}
            onChange={(v) => {
              setFolder(v);
              run(() => setActiveFolder(id, v || null));
            }}
          />
          <span className="text-xs text-subtle">{t.cockpits.card.plusCommon}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <span className="label-caps">{t.cockpits.card.urlLabel}</span>
        <div className="flex flex-wrap gap-2">
          <input
            className="input min-w-0 basis-full font-mono sm:basis-0 sm:flex-1 text-xs text-slate-300"
            aria-label={t.cockpits.card.urlAria}
            value={url}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
          />
          <CopyButton text={url} />
          <a className="btn-secondary" href={url || undefined} target="_blank" rel="noreferrer">
            <ExternalLink size={16} strokeWidth={1.75} />
            {t.cockpits.card.open}
          </a>
        </div>
        <p className="text-xs text-subtle">{t.cockpits.card.keepSecret}</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </li>
  );
}

