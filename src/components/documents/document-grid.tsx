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
import { Folder, FolderInput, PenLine, RotateCcw, RotateCw, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";
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
  const { documents: t, common: tc } = useT();
  const g = t.grid;
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
        res = { error: t.errors.server };
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
      .catch(() => ({ error: t.errors.server }))
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
    if (!window.confirm(fmt(ids.length > 1 ? g.confirmClearOther : g.confirmClearOne, { n: ids.length }))) return;
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
      className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md animate-[toast-in_160ms_var(--ease-snappy)] items-center gap-3 rounded-[4px] bg-overlay py-2 pl-4 pr-2 text-sm shadow-[inset_2px_0_0_var(--color-accent),var(--shadow-popover)] md:inset-x-auto md:bottom-7 md:right-8"
    >
      <Trash2 size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1 truncate">
        {pendingDelete.removed.length > 1
          ? fmt(g.deletedMany, { n: pendingDelete.removed.length })
          : fmt(g.deletedOne, { name: pendingDelete.removed[0].item.name })}
      </span>
      <button type="button" className="btn min-h-9 px-3 font-semibold text-accent hover:bg-raised" onClick={undoDelete}>
        {g.undo}
      </button>
    </div>
  );

  if (items.length === 0) {
    return (
      <>
        <EmptyState title={t.emptyTitle} text={g.emptyText} />
        {undoToast}
      </>
    );
  }

  const count = selectedIds.length;
  return (
    <div className={`space-y-3 ${pending ? "cursor-progress" : ""}`}>
      <div className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center gap-1 bg-raised/95 py-1.5 pl-3.5 pr-2 backdrop-blur">
        <Checkbox
          checked={allSelected}
          indeterminate={count > 0 && !allSelected}
          onToggle={() => setSelected(count > 0 ? new Set() : new Set(items.map((i) => i.id)))}
          label={g.selectAll}
          className="mr-2"
        >
          <span className={count > 0 ? "font-semibold text-accent" : "text-muted"}>
            {count > 0 ? fmt(count > 1 ? g.selectedOther : g.selectedOne, { n: count }) : g.selectAll}
          </span>
        </Checkbox>
        {count > 0 && (
          <>
            <button type="button" className="btn-icon text-fg" title={g.rotateLeft} aria-label={g.rotateSelectionLeft} onClick={() => rotateSelected(-1)}>
              <RotateCcw size={17} strokeWidth={1.75} />
            </button>
            <button type="button" className="btn-icon text-fg" title={g.rotateRight} aria-label={g.rotateSelectionRight} onClick={() => rotateSelected(1)}>
              <RotateCw size={17} strokeWidth={1.75} />
            </button>
            <Menu
              label={g.moveMenu}
              align="start"
              triggerClassName="btn-ghost text-fg"
              trigger={
                <>
                  <FolderInput size={17} strokeWidth={1.75} />
                  <span className="hidden sm:inline">{g.moveTo}</span>
                </>
              }
              items={[
                { label: tc.folders.common, icon: <Folder size={16} strokeWidth={1.75} />, onSelect: () => moveSelected(null) },
                ...folders.map((f) => ({
                  label: f.name,
                  icon: <Folder size={16} strokeWidth={1.75} />,
                  onSelect: () => moveSelected(f.id),
                })),
              ]}
            />
            <button type="button" className="btn-ghost text-fg" title={g.clearTitle} onClick={clearSelectedAnnotations}>
              <PenLine size={17} strokeWidth={1.75} />
              <span className="hidden sm:inline">{g.clear}</span>
            </button>
            <button type="button" className="btn-icon text-danger hover:text-danger-hover" title={g.delete} aria-label={g.deleteSelection} onClick={deleteSelected}>
              <Trash2 size={17} strokeWidth={1.75} />
            </button>
            <button type="button" className="btn-ghost ml-auto" onClick={() => setSelected(new Set())}>
              {g.cancel}
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-9 lg:grid-cols-4">
            {items.map((item) => (
              <DocumentCard
                key={item.id}
                item={item}
                folders={folders}
                selected={selected.has(item.id)}
                selecting={count > 0}
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
      <p className="hidden pt-4 text-xs text-subtle md:block">
        {g.tip}
      </p>
    </div>
  );
}
