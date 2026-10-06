/**
 * Fichiers de mission DCS (.miz = archive ZIP). Les kneeboards intégrés à
 * une mission sont des images rangées dans :
 *   KNEEBOARD/IMAGES/…               → pour tous les appareils
 *   KNEEBOARD/<type d'appareil>/IMAGES/… → pour un appareil donné
 */

/** Taille max d'un fichier .miz importé (il est lu en mémoire dans le navigateur). */
export const MAX_MIZ_BYTES = 500 * 1024 * 1024;

export interface MizKneeboardEntry {
  /** Chemin dans l'archive */
  path: string;
  /** Type d'appareil (dossier), null si commun à tous */
  aircraft: string | null;
  /** Nom du fichier sans extension */
  baseName: string;
}

const KNEEBOARD_IMAGE_RE = /^KNEEBOARD\/(?:([^/]+)\/)?IMAGES\/(?:[^/]+\/)*([^/]+)\.(png|jpe?g)$/i;

export function isMizFileName(name: string): boolean {
  return /\.miz$/i.test(name);
}

/** Repère les images de kneeboard parmi les chemins d'une archive, triées naturellement. */
export function findKneeboardEntries(paths: string[]): MizKneeboardEntry[] {
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
  return paths
    .map((raw): MizKneeboardEntry | null => {
      const path = raw.replace(/\\/g, "/");
      const m = KNEEBOARD_IMAGE_RE.exec(path);
      if (!m) return null;
      return { path: raw, aircraft: m[1] ?? null, baseName: m[2] };
    })
    .filter((e): e is MizKneeboardEntry => e !== null)
    .sort(
      (a, b) =>
        collator.compare(a.aircraft ?? "", b.aircraft ?? "") || collator.compare(a.path, b.path),
    );
}

/** Nom du document importé : « Mission · Appareil · Image », borné à 200 caractères. */
export function kneeboardDocumentName(missionFileName: string, entry: MizKneeboardEntry): string {
  const mission = missionFileName.replace(/\.miz$/i, "").trim() || "Mission";
  return [mission, entry.aircraft, entry.baseName].filter(Boolean).join(" · ").slice(0, 200);
}
