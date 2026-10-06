"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useTransition } from "react";
import { moveDocument, renameDocument } from "@/app/(app)/documents/actions";
import { CachedThumbnail } from "@/components/cached-thumbnail";
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
  /** Suppression (annulable quelques secondes, gérée par la grille) */
  onDelete: () => void;
  onRenamed: (name: string) => void;
}

export function DocumentCard({
  item,
  folders,
  selected,
  onToggleSelect,
  onRotate,
  onDelete,
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

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2.5 ${isDragging ? "z-10 opacity-80" : ""} ${
        pending ? "opacity-60" : ""
      }`}
    >
      {/* Miniature sur fond « papier » ; sélection = contour ambre. */}
      <div
        className={`relative aspect-[3/4] overflow-hidden bg-[#e9e6df] transition ${
          selected || isDragging ? "ring-2 ring-sky-500" : ""
        } ${isDragging ? "shadow-2xl" : ""}`}
      >
        {item.thumbnailUrl ? (
          <CachedThumbnail docId={item.id} url={item.thumbnailUrl} rotation={item.rotation} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
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

      <div className="space-y-1.5">
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
          <p className="truncate text-[15px] font-medium" title={item.name}>
            {item.name}
          </p>
        )}
        <select
          className="-ml-0.5 max-w-full cursor-pointer border-0 bg-transparent p-0 text-xs text-slate-500 hover:text-slate-300 pointer-coarse:min-h-11"
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
        {/* Au doigt : cibles d'au moins 44 px et actions plus espacées. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pointer-coarse:gap-x-4">
          <button
            type="button"
            className="rounded px-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:text-lg"
            title="Tourner vers la gauche"
            aria-label="Tourner vers la gauche"
            onClick={() => onRotate(-1)}
          >
            ⟲
          </button>
          <button
            type="button"
            className="rounded px-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:text-lg"
            title="Tourner vers la droite"
            aria-label="Tourner vers la droite"
            onClick={() => onRotate(1)}
          >
            ⟳
          </button>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-white pointer-coarse:min-h-11 pointer-coarse:text-sm"
            onClick={() => setEditing(true)}
            disabled={pending}
          >
            Renommer
          </button>
          <button
            type="button"
            className="text-xs text-red-400 hover:text-red-300 pointer-coarse:min-h-11 pointer-coarse:text-sm"
            onClick={onDelete}
            disabled={pending}
          >
            Supprimer
          </button>
        </div>
      </div>
    </li>
  );
}
