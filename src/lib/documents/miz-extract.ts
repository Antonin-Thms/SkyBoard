"use client";

import { unzip } from "fflate";
import { findKneeboardEntries, MAX_MIZ_BYTES, type MizKneeboardEntry } from "./miz";

export interface ExtractedKneeboard extends MizKneeboardEntry {
  file: File;
}

/** Extrait les images de kneeboard d'un fichier .miz (décompression dans le navigateur). */
export async function extractMizKneeboards(miz: File): Promise<ExtractedKneeboard[]> {
  if (miz.size > MAX_MIZ_BYTES) throw new Error("Fichier de mission trop volumineux (500 Mo max).");
  const data = new Uint8Array(await miz.arrayBuffer());

  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(
      data,
      // On ne décompresse que les images de kneeboard (pas les sons, scripts…).
      { filter: (f) => findKneeboardEntries([f.name]).length > 0 },
      (err, out) => (err ? reject(new Error("Fichier .miz illisible.")) : resolve(out)),
    );
  });

  return findKneeboardEntries(Object.keys(files)).map((entry) => {
    const ext = entry.path.split(".").pop()?.toLowerCase() ?? "png";
    const bytes = files[entry.path];
    const type = ext === "png" ? "image/png" : "image/jpeg";
    const file = new File([bytes.slice().buffer], `${entry.baseName}.${ext}`, { type });
    return { ...entry, file };
  });
}
