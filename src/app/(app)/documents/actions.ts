"use server";

import { revalidatePath } from "next/cache";
import { STORAGE_BUCKET } from "@/lib/documents/storage";
import { createClient } from "@/lib/supabase/server";
import { notifyDocumentsChanged } from "@/lib/sync/notify";
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
  await notifyDocumentsChanged(supabase);
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
  await notifyDocumentsChanged(supabase);
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
  await notifyDocumentsChanged(supabase);
  return {};
}

// --- Dossiers ------------------------------------------------------------

const MAX_FOLDERS = 50;

export async function createFolder(name: string): Promise<ActionResult & { id?: string }> {
  const cleaned = cleanName(name, 100);
  if (!cleaned) return { error: "Donne un nom au dossier." };

  const supabase = await createClient();
  const { count } = await supabase.from("folders").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_FOLDERS) return { error: `Maximum ${MAX_FOLDERS} dossiers.` };

  const { data, error } = await supabase
    .from("folders")
    .insert({ name: cleaned, sort_order: (count ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { error: "Création impossible." };

  revalidatePath("/documents");
  return { id: data.id };
}

export async function renameFolder(id: string, name: string): Promise<ActionResult> {
  const cleaned = cleanName(name, 100);
  if (!isUuid(id) || !cleaned) return { error: "Nom invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("folders").update({ name: cleaned }).eq("id", id);
  if (error) return { error: "Renommage impossible." };

  revalidatePath("/documents");
  await notifyDocumentsChanged(supabase);
  return {};
}

/** Supprime le dossier : ses documents redeviennent « Communs » (rien n'est effacé). */
export async function deleteFolder(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "Dossier invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) return { error: "Suppression impossible." };

  revalidatePath("/documents");
  await notifyDocumentsChanged(supabase);
  return {};
}

/** Range un document dans un dossier (null = Communs). */
export async function moveDocument(id: string, folderId: string | null): Promise<ActionResult> {
  if (!isUuid(id) || (folderId !== null && !isUuid(folderId))) return { error: "Dossier invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("documents").update({ folder_id: folderId }).eq("id", id);
  if (error) return { error: "Déplacement impossible." };

  revalidatePath("/documents");
  await notifyDocumentsChanged(supabase);
  return {};
}

/** Appelé après un envoi de fichiers : les viewers rechargent leur liste. */
export async function documentsUploaded(): Promise<void> {
  await notifyDocumentsChanged(await createClient());
}
