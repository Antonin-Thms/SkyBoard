"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DocumentRow } from "@/lib/database.types";
import { analyzeFile } from "./analyze";
import { checkFile, defaultDocumentName, EXTENSION_BY_MIME } from "./file-type";
import { STORAGE_BUCKET } from "./storage";
import { uuid } from "@/lib/uuid";

/**
 * Upload complet d'un document : vérification, analyse (pages + miniature),
 * envoi direct vers Supabase Storage (sans passer par Vercel), puis insertion
 * de la ligne. Nettoie les fichiers envoyés en cas d'échec.
 */
export async function uploadDocument(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File,
  sortOrder: number,
): Promise<DocumentRow> {
  const check = await checkFile(file);
  if (!check.ok) throw new Error(check.error);
  const { mime } = check;

  let analysis;
  try {
    analysis = await analyzeFile(file, mime);
  } catch {
    throw new Error("Fichier illisible ou corrompu.");
  }

  const id = uuid();
  const storagePath = `${userId}/${id}.${EXTENSION_BY_MIME[mime]}`;
  const uploaded: string[] = [];
  const storage = supabase.storage.from(STORAGE_BUCKET);

  try {
    const { error: fileError } = await storage.upload(storagePath, file, {
      contentType: mime,
      upsert: false,
    });
    if (fileError) throw new Error(`Envoi du fichier impossible : ${fileError.message}`);
    uploaded.push(storagePath);

    let thumbnailPath: string | null = null;
    if (analysis.thumbnail) {
      const ext = analysis.thumbnail.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${id}.thumb.${ext}`;
      const { error } = await storage.upload(path, analysis.thumbnail, {
        contentType: analysis.thumbnail.type,
        upsert: false,
      });
      // Miniature facultative : on continue sans elle en cas d'échec.
      if (!error) {
        thumbnailPath = path;
        uploaded.push(path);
      }
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        name: defaultDocumentName(file.name),
        type: mime,
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        page_count: analysis.pageCount,
        sort_order: sortOrder,
      })
      .select()
      .single();
    if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
    return data;
  } catch (err) {
    if (uploaded.length) await storage.remove(uploaded);
    throw err;
  }
}
