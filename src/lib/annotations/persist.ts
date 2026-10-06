"use client";

import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";
import type { Stroke } from "./model";

/** Nouvel essai unique après un échec réseau (le trait reste affiché en direct). */
async function withRetry(run: () => PromiseLike<{ error: unknown }>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await run();
    if (!error) return true;
    await new Promise((r) => setTimeout(r, 1_500));
  }
  return false;
}

export function saveStroke(docId: string, page: number, stroke: Stroke): Promise<boolean> {
  return withRetry(() =>
    createClient().rpc("annotation_add", {
      document_id: docId,
      page,
      stroke: stroke as unknown as Json,
    }),
  );
}

export function removeStrokes(docId: string, page: number, ids: string[]): Promise<boolean> {
  return withRetry(() => createClient().rpc("annotation_remove", { document_id: docId, page, ids }));
}

export function clearAnnotations(docIds: string[], page: number | null = null): Promise<boolean> {
  return withRetry(() => createClient().rpc("annotation_clear", { document_ids: docIds, page }));
}
