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
import { useState } from "react";
import { reorderDocuments } from "@/app/(app)/documents/actions";
import type { DocumentMimeType } from "@/lib/database.types";
import type { FolderSummary } from "@/lib/documents/folders";
import { DocumentCard } from "./document-card";

export interface DocumentItem {
  id: string;
  name: string;
  type: DocumentMimeType;
  pageCount: number;
  thumbnailUrl: string | null;
  folderId: string | null;
}

interface DocumentGridProps {
  initialItems: DocumentItem[];
  folders: FolderSummary[];
}

export function DocumentGrid({ initialItems, folders }: DocumentGridProps) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);

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
      <p className="rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
        Aucun document ici pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <DocumentCard
                key={item.id}
                item={item}
                folders={folders}
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
        Astuce : maintiens la poignée ⠿ et fais glisser pour réordonner.
      </p>
    </div>
  );
}
