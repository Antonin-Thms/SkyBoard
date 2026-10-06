"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useState, useTransition } from "react";
import {
  deleteDocuments,
  moveDocuments,
  reorderDocuments,
  rotateDocuments,
  setDocumentRotation,
} from "@/app/(app)/documents/actions";
import { rotateBy } from "@/lib/sync/protocol";
import type { DocumentMimeType, Rotation } from "@/lib/database.types";
import type { FolderSummary } from "@/lib/documents/folders";
import { DocumentCard } from "./document-card";

export interface DocumentItem {
  id: string;
  name: string;
  type: DocumentMimeType;
  pageCount: number;
  thumbnailUrl: string | null;
  folderId: string | null;
  rotation: Rotation;
}

interface DocumentGridProps {
  initialItems: DocumentItem[];
  folders: FolderSummary[];
}

export function DocumentGrid({ initialItems, folders }: DocumentGridProps) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedIds = items.filter((i) => selected.has(i.id)).map((i) => i.id);
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  /** Clic sur une case : bascule ; Maj+clic : sélectionne la plage depuis le dernier clic. */
  function toggle(id: string, range: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      const from = lastClicked ? items.findIndex((i) => i.id === lastClicked) : -1;
      const to = items.findIndex((i) => i.id === id);
      if (range && from !== -1) {
        const on = !prev.has(id);
        for (const item of items.slice(Math.min(from, to), Math.max(from, to) + 1)) {
          if (on) next.add(item.id);
          else next.delete(item.id);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastClicked(id);
  }

  /** Exécute une action serveur ; en cas d'erreur, restaure la liste. */
  function run(
    optimistic: (list: DocumentItem[]) => DocumentItem[],
    action: () => Promise<{ error?: string }>,
  ) {
    const previous = items;
    setItems(optimistic(items));
    setError(null);
    startTransition(async () => {
      let res: { error?: string };
      try {
        res = await action();
      } catch {
        res = { error: "Connexion au serveur impossible." };
      }
      if (res.error) {
        setItems(previous);
        setError(res.error);
      }
    });
  }

  const rotateOne = (id: string, delta: 1 | -1) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const rotation = rotateBy(item.rotation, delta);
    run(
      (list) => list.map((i) => (i.id === id ? { ...i, rotation } : i)),
      () => setDocumentRotation(id, rotation),
    );
  };

  const rotateSelected = (delta: 1 | -1) =>
    run(
      (list) =>
        list.map((i) => (selected.has(i.id) ? { ...i, rotation: rotateBy(i.rotation, delta) } : i)),
      () => rotateDocuments(selectedIds, delta),
    );

  const moveSelected = (folderId: string | null) => {
    const ids = selectedIds;
    run(
      (list) => list.map((i) => (selected.has(i.id) ? { ...i, folderId } : i)),
      () => moveDocuments(ids, folderId),
    );
    setSelected(new Set());
  };

  const deleteSelected = () => {
    const ids = selectedIds;
    if (
      !window.confirm(
        `Supprimer ${ids.length} document${ids.length > 1 ? "s" : ""} ? C'est définitif.`,
      )
    )
      return;
    run(
      (list) => list.filter((i) => !selected.has(i.id)),
      () => deleteDocuments(ids),
    );
    setSelected(new Set());
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Tactile : appui long pour saisir, afin de ne pas bloquer le défilement.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const previous = items;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, from, to);
    setItems(next);
    setError(null);

    const res = await reorderDocuments(next.map((i) => i.id));
    if (res.error) {
      setItems(previous);
      setError(res.error);
    }
  }

  if (items.length === 0) {
    return (
      <p className="border border-slate-800 p-8 text-center text-slate-500">
        Aucun document ici pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${pending ? "cursor-progress" : ""}`}>
      <div className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center gap-2 bg-slate-900/95 px-3 py-2 backdrop-blur">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
          />
          <span className={selectedIds.length > 0 ? "font-semibold text-accent" : ""}>
            {selectedIds.length > 0
              ? `${selectedIds.length} sélectionné${selectedIds.length > 1 ? "s" : ""}`
              : "Tout sélectionner"}
          </span>
        </label>
        {selectedIds.length > 0 && (
          <>
            <button
              type="button"
              className="btn-text text-base"
              title="Tourner vers la gauche"
              onClick={() => rotateSelected(-1)}
            >
              ⟲
            </button>
            <button
              type="button"
              className="btn-text text-base"
              title="Tourner vers la droite"
              onClick={() => rotateSelected(1)}
            >
              ⟳
            </button>
            <select
              className="cursor-pointer border-0 bg-transparent py-1 text-sm text-slate-200 outline-none"
              value=""
              aria-label="Déplacer la sélection vers un dossier"
              onChange={(e) => {
                if (e.target.value)
                  moveSelected(e.target.value === "common" ? null : e.target.value);
              }}
            >
              <option value="">Déplacer vers…</option>
              <option value="common">Communs</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn-text text-red-300 hover:text-red-200" onClick={deleteSelected}>
              Supprimer
            </button>
            <button
              type="button"
              className="text-sm text-slate-400 hover:text-white"
              onClick={() => setSelected(new Set())}
            >
              Annuler
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <DocumentCard
                key={item.id}
                item={item}
                folders={folders}
                selected={selected.has(item.id)}
                onToggleSelect={(range) => toggle(item.id, range)}
                onRotate={(delta) => rotateOne(item.id, delta)}
                onDeleted={() => setItems((list) => list.filter((i) => i.id !== item.id))}
                onRenamed={(name) =>
                  setItems((list) => list.map((i) => (i.id === item.id ? { ...i, name } : i)))
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="text-xs text-slate-500">
        Astuce : coche plusieurs documents (Maj+clic pour une plage) pour les tourner, les déplacer
        ou les supprimer d&apos;un coup. Poignée ⠿ : glisser pour réordonner.
      </p>
    </div>
  );
}
