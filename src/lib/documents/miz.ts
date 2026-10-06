/**
 * Archives de mission DCS : mission (.miz) et track (.trk), toutes deux au
 * format ZIP. On y cherche :
 *   KNEEBOARD/IMAGES/…                    → kneeboards pour tous les appareils
 *   KNEEBOARD/<type d'appareil>/IMAGES/…  → kneeboards d'un appareil
 *   l10n/<langue>/…                       → images du briefing (cartes, etc.)
 */

/** Taille max d'une archive importée (elle est lue en mémoire dans le navigateur). */
export const MAX_MIZ_BYTES = 500 * 1024 * 1024;

export interface MizKneeboardEntry {
  /** Chemin dans l'archive */
  path: string;
  /** kneeboard : dossier KNEEBOARD ; briefing : image de briefing (l10n) */
  kind: "kneeboard" | "briefing";
  /** Type d'appareil (dossier), null si commun à tous */
  aircraft: string | null;
  /** Nom du fichier sans extension */
  baseName: string;
}

const KNEEBOARD_IMAGE_RE = /^KNEEBOARD\/(?:([^/]+)\/)?IMAGES\/(?:[^/]+\/)*([^/]+)\.(png|jpe?g)$/i;
const BRIEFING_IMAGE_RE = /^l10n\/[^/]+\/([^/]+)\.(png|jpe?g)$/i;

/** Mission (.miz) ou track (.trk) DCS. */
export function isMizFileName(name: string): boolean {
  return /\.(miz|trk)$/i.test(name);
}

function classify(raw: string): MizKneeboardEntry | null {
  const path = raw.replace(/\\/g, "/");
  const kb = KNEEBOARD_IMAGE_RE.exec(path);
  if (kb) return { path: raw, kind: "kneeboard", aircraft: kb[1] ?? null, baseName: kb[2] };
  const br = BRIEFING_IMAGE_RE.exec(path);
  if (br) return { path: raw, kind: "briefing", aircraft: null, baseName: br[1] };
  return null;
}

/**
 * Repère les images utiles d'une archive : kneeboards d'abord (par appareil),
 * puis images de briefing ; tri naturel. Une image de briefing présente dans
 * plusieurs langues n'est gardée qu'une fois.
 */
export function findKneeboardEntries(paths: string[]): MizKneeboardEntry[] {
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
  const seenBriefing = new Set<string>();
  return paths
    .map(classify)
    .filter((e): e is MizKneeboardEntry => e !== null)
    .sort(
      (a, b) =>
        (a.kind === b.kind ? 0 : a.kind === "kneeboard" ? -1 : 1) ||
        collator.compare(a.aircraft ?? "", b.aircraft ?? "") ||
        // langue DEFAULT en premier pour le dédoublonnage du briefing
        Number(!/\/DEFAULT\//i.test(a.path.replace(/\\/g, "/"))) -
          Number(!/\/DEFAULT\//i.test(b.path.replace(/\\/g, "/"))) ||
        collator.compare(a.path, b.path),
    )
    .filter((e) => {
      if (e.kind !== "briefing") return true;
      const key = e.baseName.toLowerCase();
      if (seenBriefing.has(key)) return false;
      seenBriefing.add(key);
      return true;
    });
}

/** Nom du document importé : « Mission · Appareil|Briefing · Image », borné à 200 caractères. */
export function kneeboardDocumentName(
  missionFileName: string,
  entry: MizKneeboardEntry,
  /** Libellés dans la langue de l'interface */
  labels: { mission: string; briefing: string } = { mission: "Mission", briefing: "Briefing" },
): string {
  const mission = missionFileName.replace(/\.(miz|trk)$/i, "").trim() || labels.mission;
  const group = entry.kind === "briefing" ? labels.briefing : entry.aircraft;
  return [mission, group, entry.baseName].filter(Boolean).join(" · ").slice(0, 200);
}
