"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useTransition } from "react";
import { deleteDocument, moveDocument, renameDocument } from "@/app/(app)/documents/actions";
import { RotatedThumbnail } from "@/components/rotated-thumbnail";
import type { FolderSummary } from "@/lib/documents/folders";
import type { DocumentItem } from "./document-grid";

const TYPE_LABEL: Record<DocumentItem["type"], string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
};

interface DocumentCardProps {
  item: DocumentItem;
  folders: FolderSummary[];
  selected: boolean;
  /** range : Maj+clic (sélection d'une plage) */
  onToggleSelect: (range: boolean) => void;
  onRotate: (delta: 1 | -1) => void;
  onDeleted: () => void;
  onRenamed: (name: string) => void;
}

export function DocumentCard({
  item,
  folders,
  selected,
  onToggleSelect,
  onRotate,
  onDeleted,
  onRenamed,
}: DocumentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitRename() {
    const name = draft.trim();
    if (!name || name === item.name) {
      setEditing(false);
      setDraft(item.name);
      return;
    }
    startTransition(async () => {
      const res = await renameDocument(item.id, name);
      if (res.error) {
        setError(res.error);
      } else {
        setError(null);
        setEditing(false);
        onRenamed(name);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Supprimer « ${item.name} » ?`)) return;
    startTransition(async () => {
      const res = await deleteDocument(item.id);
      if (res.error) setError(res.error);
      else onDeleted();
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 ${
        isDragging ? "z-10 opacity-80 shadow-2xl ring-2 ring-sky-500" : ""
      } ${selected ? "border-sky-500 ring-2 ring-sky-500/70" : ""} ${pending ? "opacity-60" : ""}`}
    >
      <div className="relative aspect-[3/4] bg-slate-950">
        {item.thumbnailUrl ? (
          <RotatedThumbnail src={item.thumbnailUrl} rotation={item.rotation} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600">
            {TYPE_LABEL[item.type]}
          </div>
        )}
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Déplacer"
          className="absolute left-2 top-2 cursor-grab touch-none rounded-md bg-slate-900/80 px-2 py-1 text-lg leading-none text-slate-300 active:cursor-grabbing"
        >
          ⠿
        </button>
        {/*
          Case de sélection : un bouton (et non un <input type="checkbox">) dont
          l'affichage dépend uniquement de l'état React. Une vraie case dont on
          annule le clic (pour gérer Maj+clic) se redessine avec un clic de retard.
          Grande zone cliquable pour cocher au doigt.
        */}
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Sélectionner ${item.name}`}
          onClick={(e) => onToggleSelect(e.shiftKey)}
          className="absolute right-0 top-0 flex h-11 w-11 items-start justify-end p-2"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded border-2 text-xs font-bold leading-none ${
              selected
                ? "border-sky-500 bg-sky-500 text-slate-950"
                : "border-slate-300 bg-slate-900/70 text-transparent"
            }`}
          >
            ✓
          </span>
        </button>
        <span className="absolute bottom-2 right-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs text-slate-300">
          {TYPE_LABEL[item.type]}
          {item.type === "application/pdf" && ` · ${item.pageCount} p.`}
        </span>
      </div>

      <div className="space-y-2 p-3">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
          >
            <input
              className="input"
              value={draft}
              maxLength={200}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft(item.name);
                  setEditing(false);
                }
              }}
            />
          </form>
        ) : (
          <p className="truncate text-sm font-medium" title={item.name}>
            {item.name}
          </p>
        )}
        <select
          className="w-full rounded-md border border-slate-800 bg-slate-950 px-1.5 py-1 text-xs text-slate-300"
          aria-label="Dossier"
          value={item.folderId ?? ""}
          disabled={pending}
          onChange={(e) => {
            const folderId = e.target.value || null;
            startTransition(async () => {
              const res = await moveDocument(item.id, folderId);
              setError(res.error ?? null);
            });
          }}
        >
          <option value="">Communs</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              📁 {f.name}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            className="rounded px-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            title="Tourner vers la gauche"
            aria-label="Tourner vers la gauche"
            onClick={() => onRotate(-1)}
          >
            ⟲
          </button>
          <button
            type="button"
            className="rounded px-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            title="Tourner vers la droite"
            aria-label="Tourner vers la droite"
            onClick={() => onRotate(1)}
          >
            ⟳
          </button>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-white"
            onClick={() => setEditing(true)}
            disabled={pending}
          >
            Renommer
          </button>
          <button
            type="button"
            className="text-xs text-red-400 hover:text-red-300"
            onClick={handleDelete}
            disabled={pending}
          >
            Supprimer
          </button>
        </div>
      </div>
    </li>
  );
}
