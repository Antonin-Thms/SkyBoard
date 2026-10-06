"use client";

import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { FolderLink } from "@/components/folder-link";
import { Select } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createFolder, deleteFolder, renameFolder } from "@/app/(app)/documents/actions";
import { shareFolder } from "@/app/(app)/escadrons/actions";
import type { FolderFilter, FolderSummary } from "@/lib/documents/folders";

interface FolderBarProps {
  folders: (FolderSummary & { count: number })[];
  filter: FolderFilter;
  totalCount: number;
  commonCount: number;
  squadrons: { id: string; name: string }[];
}

const pill = (active: boolean) =>
  `flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] border px-3 text-[13px] transition ${
    active ? "border-accent bg-accent-subtle text-accent-hover" : "border-line-strong bg-raised text-slate-300"
  }`;

/** Filtre par dossier + gestion des dossiers. */
export function FolderBar({ folders, filter, totalCount, commonCount, squadrons }: FolderBarProps) {
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

  const share = (squadronId: string | null) =>
    startTransition(async () => {
      if (!current) return;
      const res = await shareFolder(current.id, squadronId);
      setError(res.error ?? null);
      router.refresh();
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
    <div className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
      {/* Sur ordinateur, les dossiers sont dans la barre latérale. */}
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden" aria-label="Dossiers">
        <FolderLink href="/documents" className={pill(filter.kind === "all")}>
          Tous <span className="numeric">{totalCount}</span>
        </FolderLink>
        <FolderLink
          href="/documents?folder=common"
          className={pill(filter.kind === "common")}
          title="Documents sans dossier : toujours affichés, quel que soit le dossier actif"
        >
          Communs <span className="numeric">{commonCount}</span>
        </FolderLink>
        {folders.map((f) => (
          <FolderLink
            key={f.id}
            href={`/documents?folder=${f.id}`}
            className={pill(filter.kind === "folder" && filter.id === f.id)}
          >
            {(f.readOnly || f.squadronId) && <Users size={14} strokeWidth={1.75} className="text-subtle" />}
            {f.name} <span className="numeric">{f.count}</span>
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
            <Plus size={14} strokeWidth={1.75} />
            Dossier
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
            aria-label="Nom du nouveau dossier"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Créer
          </button>
          <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>
            Annuler
          </button>
        </form>
      )}

      {current?.readOnly && (
        <p className="flex items-start gap-2 text-sm text-muted">
          <Users size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Partagé par l&apos;escadron {current.squadronName}, en lecture seule. Choisis-le comme
            dossier actif d&apos;un cockpit (page Remote ou Cockpits) pour l&apos;afficher dans le casque.
          </span>
        </p>
      )}
      {current &&
        !current.readOnly &&
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
              aria-label="Nouveau nom du dossier"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              Enregistrer
            </button>
            <button type="button" className="btn-ghost" onClick={() => setRenaming(false)}>
              Annuler
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {squadrons.length > 0 && (
              <Select
                size="sm"
                label="Partager le dossier avec un escadron"
                value={current.squadronId ?? ""}
                onChange={(v) => share(v || null)}
                icon={<Users size={14} strokeWidth={1.75} />}
                className="mr-1 w-52"
                options={[
                  { value: "", label: "Non partagé", icon: <Users size={14} strokeWidth={1.75} /> },
                  ...squadrons.map((s) => ({
                    value: s.id,
                    label: `Partagé avec ${s.name}`,
                    icon: <Users size={14} strokeWidth={1.75} />,
                  })),
                ]}
              />
            )}
            <button
              type="button"
              className="btn-ghost min-h-8"
              onClick={() => {
                setRenaming(true);
                setDraft(current.name);
              }}
            >
              <Pencil size={14} strokeWidth={1.75} />
              Renommer
            </button>
            <button type="button" className="btn-ghost min-h-8 hover:text-danger" onClick={remove}>
              <Trash2 size={14} strokeWidth={1.75} />
              Supprimer le dossier
            </button>
          </div>
        ))}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
