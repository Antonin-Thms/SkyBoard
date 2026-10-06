"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { moveDocument, renameDocument } from "@/app/(app)/documents/actions";
import { CachedThumbnail } from "@/components/cached-thumbnail";
import { Checkbox } from "@/components/ui/checkbox";
import { folderOptions } from "@/components/ui/folder-options";
import { Menu } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
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
  /** Une sélection est en cours : les cases restent visibles */
  selecting: boolean;
  /** range : Maj+clic (sélection d'une plage) */
  onToggleSelect: (range: boolean) => void;
  onRotate: (delta: 1 | -1) => void;
  /** Suppression (annulable quelques secondes, gérée par la grille) */
  onDelete: () => void;
  onRenamed: (name: string) => void;
}

/** Bouton icône posé sur la miniature (fond sombre translucide). */
const overlayButton =
  "flex size-8 items-center justify-center bg-surface/85 text-fg transition hover:bg-surface pointer-coarse:size-10";

export function DocumentCard({
  item,
  folders,
  selected,
  selecting,
  onToggleSelect,
  onRotate,
  onDelete,
  onRenamed,
}: DocumentCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isPdf = item.type === "application/pdf";

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

  // Les commandes de la miniature apparaissent au survol (toujours au doigt).
  const reveal = "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2.5 ${isDragging ? "z-10" : ""} ${pending ? "opacity-60" : ""}`}
    >
      <div
        className={`group relative aspect-[3/4] overflow-hidden ${isPdf ? "bg-paper" : "bg-sunken"} ${
          selected || isDragging ? "ring-2 ring-accent" : ""
        } ${isDragging ? "shadow-[0_12px_32px_rgb(0_0_0/0.6)]" : ""}`}
      >
        {item.thumbnailUrl ? (
          <CachedThumbnail docId={item.id} url={item.thumbnailUrl} rotation={item.rotation} />
        ) : (
          <div className="flex h-full items-center justify-center text-subtle">{TYPE_LABEL[item.type]}</div>
        )}

        {/* Poignée de déplacement */}
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Déplacer"
          className={`absolute left-2 top-2 cursor-grab touch-none active:cursor-grabbing ${overlayButton} ${reveal}`}
        >
          <GripVertical size={16} strokeWidth={1.75} />
        </button>

        {/* Case de sélection : visible au survol, quand cochée ou pendant une sélection */}
        <Checkbox
          checked={selected}
          onToggle={(e) => onToggleSelect(e.shiftKey)}
          label={`Sélectionner ${item.name}`}
          className={`absolute right-0 top-0 h-11 w-11 items-start justify-end p-2.5 ${
            selected || selecting ? "" : reveal
          }`}
        />

        {/* Rotation */}
        {/* Au doigt, la rotation passe par le menu ⋯ (miniature dégagée). */}
        <div className={`absolute bottom-2 left-2 flex gap-1 ${reveal} pointer-coarse:hidden`}>
          <button type="button" aria-label="Tourner vers la gauche" title="Tourner vers la gauche" className={overlayButton} onClick={() => onRotate(-1)}>
            <RotateCcw size={16} strokeWidth={1.75} />
          </button>
          <button type="button" aria-label="Tourner vers la droite" title="Tourner vers la droite" className={overlayButton} onClick={() => onRotate(1)}>
            <RotateCw size={16} strokeWidth={1.75} />
          </button>
        </div>

        <span className="numeric absolute bottom-2 right-2 bg-surface/85 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-slate-300">
          {TYPE_LABEL[item.type]}
          {isPdf && item.pageCount > 1 && ` · ${item.pageCount} p`}
          {item.rotation !== 0 && ` · ${item.rotation}°`}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRename();
            }}
          >
            <input
              className="input"
              aria-label="Nouveau nom"
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
        <div className="flex items-center justify-between gap-2">
          <Select
            variant="chip"
            label="Dossier"
            value={item.folderId ?? ""}
            disabled={pending}
            options={folderOptions(folders, [{ value: "", label: "Communs" }])}
            onChange={(value) => {
              const folderId = value || null;
              startTransition(async () => {
                const res = await moveDocument(item.id, folderId);
                setError(res.error ?? null);
              });
            }}
            className="flex min-w-0 flex-1"
          />
          <Menu
            label={`Actions pour ${item.name}`}
            triggerClassName="btn-icon -mr-2 size-8"
            items={[
              { label: "Tourner à gauche", icon: <RotateCcw size={16} strokeWidth={1.75} />, onSelect: () => onRotate(-1) },
              { label: "Tourner à droite", icon: <RotateCw size={16} strokeWidth={1.75} />, onSelect: () => onRotate(1) },
              {
                label: "Renommer",
                icon: <Pencil size={16} strokeWidth={1.75} />,
                onSelect: () => {
                  setDraft(item.name);
                  setEditing(true);
                },
              },
              { label: "Supprimer", icon: <Trash2 size={16} strokeWidth={1.75} />, onSelect: onDelete, danger: true, separator: true },
            ]}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </li>
  );
}
