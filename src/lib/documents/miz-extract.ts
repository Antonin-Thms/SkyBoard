"use client";

import { unzip } from "fflate";
import { findKneeboardEntries, MAX_MIZ_BYTES, type MizKneeboardEntry } from "./miz";
import { MAX_UPLOAD_BYTES } from "./file-type";

/** Plafonds de l'extraction : nombre d'images et volume décompressé total. */
const MAX_ENTRIES = 200;
const MAX_EXPANDED_BYTES = 300 * 1024 * 1024;

export interface ExtractedKneeboard extends MizKneeboardEntry {
  file: File;
}

/** Extrait les images de kneeboard et de briefing d'une mission (.miz) ou d'un track (.trk), dans le navigateur. */
export async function extractMizKneeboards(miz: File): Promise<ExtractedKneeboard[]> {
  if (miz.size > MAX_MIZ_BYTES) throw new Error("Fichier trop volumineux (500 Mo max).");
  const data = new Uint8Array(await miz.arrayBuffer());
  let kept = 0;
  let expanded = 0;

  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(
      data,
      // On ne décompresse que les images utiles (pas les sons, scripts, données du track…),
      // avec des plafonds de taille : une archive piégée ne doit pas saturer la mémoire.
      {
        filter: (f) => {
          if (findKneeboardEntries([f.name]).length === 0) return false;
          if (f.originalSize > MAX_UPLOAD_BYTES || kept >= MAX_ENTRIES) return false;
          if (expanded + f.originalSize > MAX_EXPANDED_BYTES) return false;
          kept++;
          expanded += f.originalSize;
          return true;
        },
      },
      (err, out) => (err ? reject(new Error("Fichier illisible (mission ou track DCS attendu).")) : resolve(out)),
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
