"use server";

import { revalidatePath } from "next/cache";
import { STORAGE_BUCKET } from "@/lib/documents/storage";
import { createClient } from "@/lib/supabase/server";
import { cleanName, isUuid } from "@/lib/validation";

export interface ActionResult {
  error?: string;
}

const MAX_DOCUMENTS_PER_REORDER = 1000;

export async function renameDocument(id: string, name: string): Promise<ActionResult> {
  const cleaned = cleanName(name, 200);
  if (!isUuid(id) || !cleaned) return { error: "Nom invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("documents").update({ name: cleaned }).eq("id", id);
  if (error) return { error: "Renommage impossible." };

  revalidatePath("/documents");
  return {};
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "Document invalide." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .select("storage_path, thumbnail_path")
    .maybeSingle();
  if (error) return { error: "Suppression impossible." };

  if (data) {
    const paths = [data.storage_path, data.thumbnail_path].filter((p): p is string => !!p);
    // La ligne est supprimée : un fichier orphelin éventuel n'est plus accessible
    // via l'app (seulement par son propriétaire), on ne bloque donc pas dessus.
    await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  }

  revalidatePath("/documents");
  return {};
}

export async function reorderDocuments(ids: string[]): Promise<ActionResult> {
  if (
    !Array.isArray(ids) ||
    ids.length > MAX_DOCUMENTS_PER_REORDER ||
    !ids.every(isUuid) ||
    new Set(ids).size !== ids.length
  ) {
    return { error: "Ordre invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_documents", { ids });
  if (error) return { error: "Réordonnancement impossible." };

  revalidatePath("/documents");
  return {};
}
