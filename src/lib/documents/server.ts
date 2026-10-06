import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DocumentMimeType } from "@/lib/database.types";
import { STORAGE_BUCKET, THUMBNAIL_URL_TTL } from "./storage";

export interface DocumentSummary {
  id: string;
  name: string;
  type: DocumentMimeType;
  pageCount: number;
  sortOrder: number;
  thumbnailUrl: string | null;
}

/** Documents de l'utilisateur connecté (RLS), triés, avec miniatures signées. */
export async function listDocumentsWithThumbnails(
  supabase: SupabaseClient<Database>,
): Promise<{ documents: DocumentSummary[]; error: boolean }> {
  const { data: rows, error } = await supabase
    .from("documents")
    .select("id, name, type, page_count, sort_order, thumbnail_path")
    .order("sort_order")
    .order("created_at");
  if (error) return { documents: [], error: true };

  const thumbPaths = rows.map((d) => d.thumbnail_path).filter((p): p is string => !!p);
  const thumbUrls = new Map<string, string>();
  if (thumbPaths.length) {
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(thumbPaths, THUMBNAIL_URL_TTL);
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) thumbUrls.set(s.path, s.signedUrl);
    });
  }

  return {
    error: false,
    documents: rows.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      pageCount: d.page_count,
      sortOrder: d.sort_order,
      thumbnailUrl: d.thumbnail_path ? (thumbUrls.get(d.thumbnail_path) ?? null) : null,
    })),
  };
}
