"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useTransition } from "react";
import { deleteDocument, renameDocument } from "@/app/(app)/documents/actions";
import type { DocumentItem } from "./document-grid";

const TYPE_LABEL: Record<DocumentItem["type"], string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
};

interface DocumentCardProps {
  item: DocumentItem;
  onDeleted: () => void;
  onRenamed: (name: string) => void;
}

export function DocumentCard({ item, onDeleted, onRenamed }: DocumentCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
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
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="relative aspect-[3/4] bg-slate-950">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase, pas d'optimisation Next voulue
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
          />
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
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
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
