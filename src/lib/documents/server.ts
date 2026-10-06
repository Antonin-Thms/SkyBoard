import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import type { Database } from "@/lib/database.types";
import type { DocumentSummary } from "./server-types";
import type { FolderSummary } from "./folders";
import { createClient, getSessionClaims } from "@/lib/supabase/server";
import { STORAGE_BUCKET, THUMBNAIL_URL_TTL } from "./storage";

/**
 * URLs signées des miniatures, réutilisées tant qu'il leur reste au moins
 * 30 min de validité : l'URL reste identique d'une navigation à l'autre, le
 * navigateur garde donc l'image en cache au lieu de la retélécharger.
 * Cache mémoire de l'instance serveur (les chemins contiennent l'id du
 * propriétaire et ne sont demandés qu'après une lecture soumise à la RLS).
 */
const thumbUrlCache = new Map<string, { url: string; expiresAt: number }>();
const THUMB_REUSE_MARGIN_MS = 30 * 60 * 1000;
const THUMB_CACHE_MAX = 5000;

async function signedThumbnailUrls(
  supabase: SupabaseClient<Database>,
  paths: string[],
): Promise<Map<string, string>> {
  const now = Date.now();
  const result = new Map<string, string>();
  const missing: string[] = [];
  for (const path of paths) {
    const hit = thumbUrlCache.get(path);
    if (hit && hit.expiresAt - now > THUMB_REUSE_MARGIN_MS) result.set(path, hit.url);
    else missing.push(path);
  }
  if (missing.length) {
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(missing, THUMBNAIL_URL_TTL);
    const expiresAt = now + THUMBNAIL_URL_TTL * 1000;
    if (thumbUrlCache.size > THUMB_CACHE_MAX) thumbUrlCache.clear();
    signed?.forEach((s) => {
      if (!s.path || !s.signedUrl) return;
      result.set(s.path, s.signedUrl);
      thumbUrlCache.set(s.path, { url: s.signedUrl, expiresAt });
    });
  }
  return result;
}

export type { DocumentSummary } from "./server-types";

/** Documents de l'utilisateur connecté (RLS), triés, avec miniatures signées. */
export async function listDocumentsWithThumbnails(
  supabase: SupabaseClient<Database>,
  userId: string | null,
): Promise<{ documents: DocumentSummary[]; error: boolean }> {
  // RLS : mes documents + ceux des dossiers partagés avec mes escadrilles.
  const { data: rows, error } = await supabase
    .from("documents")
    .select("id, user_id, name, type, page_count, sort_order, folder_id, rotation, thumbnail_path")
    .order("sort_order")
    .order("created_at");
  if (error) return { documents: [], error: true };

  const thumbPaths = rows.map((d) => d.thumbnail_path).filter((p): p is string => !!p);
  const thumbUrls = thumbPaths.length
    ? await signedThumbnailUrls(supabase, thumbPaths)
    : new Map<string, string>();

  return {
    error: false,
    documents: rows.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      pageCount: d.page_count,
      sortOrder: d.sort_order,
      folderId: d.folder_id,
      rotation: d.rotation,
      readOnly: d.user_id !== userId,
      thumbnailUrl: d.thumbnail_path ? (thumbUrls.get(d.thumbnail_path) ?? null) : null,
    })),
  };
}

/**
 * Dossiers de l'utilisateur connecté (triés), puis ceux que ses escadrilles
 * partagent (lecture seule), avec le nom de l'escadrille.
 */
export async function listFolders(
  supabase: SupabaseClient<Database>,
  userId: string | null,
): Promise<FolderSummary[]> {
  const [{ data }, { data: squadrons }] = await Promise.all([
    supabase.from("folders").select("id, name, user_id, squadron_id").order("sort_order").order("created_at"),
    supabase.from("squadrons").select("id, name"),
  ]);
  const squadronName = new Map((squadrons ?? []).map((s) => [s.id, s.name]));
  const folders = (data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    squadronId: f.squadron_id,
    squadronName: f.squadron_id ? (squadronName.get(f.squadron_id) ?? null) : null,
    readOnly: f.user_id !== userId,
  }));
  return [...folders.filter((f) => !f.readOnly), ...folders.filter((f) => f.readOnly)];
}

/** Documents de l'utilisateur connecté, une seule fois par requête (mise en page + page). */
export const getDocuments = cache(async () =>
  listDocumentsWithThumbnails(await createClient(), (await getSessionClaims())?.sub ?? null),
);

/** Dossiers de l'utilisateur connecté, une seule fois par requête. */
export const getFolders = cache(async () =>
  listFolders(await createClient(), (await getSessionClaims())?.sub ?? null),
);
