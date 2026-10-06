"use client";

import { FolderLink } from "@/components/folder-link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFolder, deleteFolder, renameFolder } from "@/app/(app)/documents/actions";
import type { FolderFilter, FolderSummary } from "@/lib/documents/folders";

interface FolderBarProps {
  folders: (FolderSummary & { count: number })[];
  filter: FolderFilter;
  totalCount: number;
  commonCount: number;
}

const pill = (active: boolean) =>
  `whitespace-nowrap border px-3 py-1.5 text-sm transition ${
    active
      ? "border-sky-500 bg-sky-500/15 text-sky-200"
      : "border-slate-700 text-slate-300 hover:border-slate-500"
  }`;

/** Filtre par dossier + gestion des dossiers. */
export function FolderBar({ folders, filter, totalCount, commonCount }: FolderBarProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = filter.kind === "folder" ? folders.find((f) => f.id === filter.id) : undefined;

  const submitCreate = () =>
    startTransition(async () => {
      const res = await createFolder(draft);
      if (res.error) return setError(res.error);
      setError(null);
      setCreating(false);
      setDraft("");
      if (res.id) router.push(`/documents?folder=${res.id}`);
    });

  const submitRename = () =>
    startTransition(async () => {
      if (!current) return;
      const res = await renameFolder(current.id, draft);
      if (res.error) return setError(res.error);
      setError(null);
      setRenaming(false);
    });

  const remove = () => {
    if (!current) return;
    if (
      !window.confirm(
        `Supprimer le dossier « ${current.name} » ? Ses documents ne sont pas effacés : ils redeviennent « Communs ».`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteFolder(current.id);
      if (res.error) return setError(res.error);
      router.push("/documents");
    });
  };

  return (
    <div className={`space-y-2 ${pending ? "opacity-60" : ""}`}>
      {/* Sur ordinateur, les dossiers sont dans la barre latérale. */}
      <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden" aria-label="Dossiers">
        <FolderLink href="/documents" className={pill(filter.kind === "all")}>
          Tous · {totalCount}
        </FolderLink>
        <FolderLink
          href="/documents?folder=common"
          className={pill(filter.kind === "common")}
          title="Documents sans dossier : toujours affichés, quel que soit le dossier actif"
        >
          Communs · {commonCount}
        </FolderLink>
        {folders.map((f) => (
          <FolderLink
            key={f.id}
            href={`/documents?folder=${f.id}`}
            className={pill(filter.kind === "folder" && filter.id === f.id)}
          >
            📁 {f.name} · {f.count}
          </FolderLink>
        ))}
        {!creating && (
          <button
            type="button"
            className={pill(false)}
            onClick={() => {
              setCreating(true);
              setDraft("");
            }}
          >
            + Nouveau dossier
          </button>
        )}
      </nav>

      {creating && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitCreate();
          }}
        >
          <input
            className="input max-w-xs"
            autoFocus
            maxLength={100}
            placeholder="Nom (ex. Serveur A)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Créer
          </button>
          <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
            Annuler
          </button>
        </form>
      )}

      {current &&
        !creating &&
        (renaming ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
          >
            <input
              className="input max-w-xs"
              autoFocus
              maxLength={100}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              OK
            </button>
            <button type="button" className="btn-secondary" onClick={() => setRenaming(false)}>
              Annuler
            </button>
          </form>
        ) : (
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              className="text-slate-400 hover:text-white"
              onClick={() => {
                setRenaming(true);
                setDraft(current.name);
              }}
            >
              Renommer le dossier
            </button>
            <button type="button" className="text-red-400 hover:text-red-300" onClick={remove}>
              Supprimer le dossier
            </button>
          </div>
        ))}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
