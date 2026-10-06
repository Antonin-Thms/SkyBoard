"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DocumentRow } from "@/lib/database.types";
import { analyzeFile } from "./analyze";
import { checkFile, defaultDocumentName, EXTENSION_BY_MIME, formatBytes, MAX_UPLOAD_BYTES, type ByteUnits } from "./file-type";
import { fmt } from "@/lib/i18n/define";
import { STORAGE_BUCKET } from "./storage";
import { uuid } from "@/lib/uuid";

/** Messages d'erreur affichés (dans la langue de l'interface). */
export interface UploadTexts extends ByteUnits {
  empty: string;
  /** Gabarit avec {size} et {max} */
  tooLarge: string;
  unsupported: string;
  unreadable: string;
  storageFull: string;
  uploadFailed: string;
  maxDocuments: string;
  saveFailed: string;
  /** Nom par défaut d'un fichier sans nom */
  defaultName: string;
}

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
  /** Nom affiché (par défaut : nom du fichier sans extension) */
  name: string | undefined,
  /** Dossier de destination (null : Communs) */
  folderId: string | null,
  texts: UploadTexts,
): Promise<DocumentRow> {
  const check = await checkFile(file);
  if (!check.ok) {
    throw new Error(
      check.error === "tooLarge"
        ? fmt(texts.tooLarge, { size: formatBytes(file.size, texts), max: formatBytes(MAX_UPLOAD_BYTES, texts) })
        : texts[check.error],
    );
  }
  const { mime } = check;

  let analysis;
  try {
    analysis = await analyzeFile(file, mime);
  } catch {
    throw new Error(texts.unreadable);
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
    if (fileError) {
      // Refus de la politique Storage : quota de 1 Go atteint (le chemin est toujours le nôtre).
      throw new Error(
        /row-level security|unauthorized|403/i.test(fileError.message)
          ? texts.storageFull
          : texts.uploadFailed,
      );
    }
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
        name: (name?.trim() || defaultDocumentName(file.name, texts.defaultName)).slice(0, 200),
        type: mime,
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        page_count: analysis.pageCount,
        sort_order: sortOrder,
        folder_id: folderId,
      })
      .select()
      .single();
    if (error) {
      throw new Error(
        error.code === "53400"
          ? texts.maxDocuments
          : texts.saveFailed,
      );
    }
    return data;
  } catch (err) {
    if (uploaded.length) await storage.remove(uploaded);
    throw err;
  }
}
