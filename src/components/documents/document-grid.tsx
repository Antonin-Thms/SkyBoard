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
import { useEffect, useRef, useState, useTransition } from "react";
import {
  clearDocumentAnnotations,
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

/** Délai pendant lequel une suppression peut être annulée. */
const UNDO_DELAY_MS = 5_000;

interface PendingDelete {
  removed: { item: DocumentItem; index: number }[];
  timer: ReturnType<typeof setTimeout> | undefined;
}

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

  /**
   * Suppression annulable : les documents disparaissent tout de suite, la
   * suppression réelle part au bout de quelques secondes sauf « Annuler ».
   */
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingRef = useRef<PendingDelete | null>(null);

  const commitDelete = (pending: PendingDelete) => {
    clearTimeout(pending.timer);
    if (pendingRef.current === pending) pendingRef.current = null;
    setPendingDelete((current) => (current === pending ? null : current));
    void deleteDocuments(pending.removed.map((r) => r.item.id))
      .catch(() => ({ error: "Connexion au serveur impossible." }))
      .then((res) => {
        if (res.error) {
          restore(pending);
          setError(res.error);
        }
      });
  };

  /** Remet les documents retirés à leur place. */
  const restore = (pending: PendingDelete) =>
    setItems((list) => {
      const next = [...list];
      for (const { item, index } of pending.removed) next.splice(Math.min(index, next.length), 0, item);
      return next;
    });

  const scheduleDelete = (ids: string[]) => {
    // Une suppression précédente encore annulable part tout de suite.
    if (pendingRef.current) commitDelete(pendingRef.current);
    const removed = items.flatMap((item, index) => (ids.includes(item.id) ? [{ item, index }] : []));
    if (!removed.length) return;
    const pending: PendingDelete = { removed, timer: undefined };
    pending.timer = setTimeout(() => commitDelete(pending), UNDO_DELAY_MS);
    pendingRef.current = pending;
    setPendingDelete(pending);
    setItems((list) => list.filter((i) => !ids.includes(i.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    setError(null);
  };

  const undoDelete = () => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setPendingDelete(null);
    restore(pending);
  };

  // En quittant la page, une suppression en attente est envoyée.
  useEffect(() => {
    const flush = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingRef.current = null;
      void deleteDocuments(pending.removed.map((r) => r.item.id));
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const deleteSelected = () => scheduleDelete(selectedIds);

  const clearSelectedAnnotations = () => {
    const ids = selectedIds;
    if (!window.confirm(`Effacer les annotations de ${ids.length} document${ids.length > 1 ? "s" : ""} ?`)) return;
    run((list) => list, () => clearDocumentAnnotations(ids));
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

  const undoToast = pendingDelete && (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-4 border border-slate-700 bg-slate-900 px-4 py-3 text-sm shadow-2xl"
    >
      <span>
        {pendingDelete.removed.length > 1
          ? `${pendingDelete.removed.length} documents supprimés`
          : `« ${pendingDelete.removed[0].item.name} » supprimé`}
      </span>
      <button type="button" className="font-semibold text-accent hover:text-sky-300" onClick={undoDelete}>
        Annuler
      </button>
    </div>
  );

  if (items.length === 0) {
    return (
      <>
        <p className="border border-slate-800 p-8 text-center text-slate-500">
          Aucun document ici pour l&apos;instant.
        </p>
        {undoToast}
      </>
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
              aria-label="Tourner la sélection vers la gauche"
              onClick={() => rotateSelected(-1)}
            >
              ⟲
            </button>
            <button
              type="button"
              className="btn-text text-base"
              title="Tourner vers la droite"
              aria-label="Tourner la sélection vers la droite"
              onClick={() => rotateSelected(1)}
            >
              ⟳
            </button>
            <select
              className="cursor-pointer border-0 bg-transparent py-1 text-sm text-slate-200"
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
            <button
              type="button"
              className="btn-text"
              title="Efface les annotations au doigt des documents sélectionnés"
              onClick={clearSelectedAnnotations}
            >
              Effacer les annotations
            </button>
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
                onDelete={() => scheduleDelete([item.id])}
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
