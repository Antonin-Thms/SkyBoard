"use client";

import { getDownloadUrl } from "@/app/(app)/documents/actions";
import { renderChecklist } from "@/lib/documents/generate";
import { fileName } from "@/lib/documents/file-name";
import type { GeneratedSource } from "@/lib/documents/generated";
import { renderTactical, tacticalLabels } from "@/lib/documents/render-tactical";
import type { Dictionary } from "@/lib/i18n/dictionary";

/** Enregistre un fichier sur l'appareil (lien de téléchargement temporaire). */
function save(href: string, name?: string) {
  const a = document.createElement("a");
  a.href = href;
  if (name) a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
}

/**
 * Télécharge un kneeboard en haute qualité :
 * - planche créée dans SkyBoard (checklist, fiche tactique) : régénérée en
 *   300 dpi (2480 × 3508) depuis son contenu ;
 * - fichier envoyé (PDF, image) : le fichier d'origine, sans perte.
 * Renvoie un message d'erreur, ou null.
 */
export async function downloadKneeboard(
  doc: { id: string; name: string; source: GeneratedSource | null },
  t: Dictionary["documents"],
): Promise<string | null> {
  try {
    const source = doc.source;
    const hd =
      source?.kind === "tactical"
        ? await renderTactical(doc.name, source, tacticalLabels(t.create), 2)
        : source?.kind === "checklist"
          ? await renderChecklist(source.title, source.items, t.create.continued, 2)
          : null;
    if (hd?.length) {
      const file = (source && "part" in source ? hd[source.part - 1] : undefined) ?? hd[0];
      const url = URL.createObjectURL(file);
      save(url, fileName(doc.name, "png"));
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return null;
    }
    const res = await getDownloadUrl(doc.id);
    if (!res.url) return res.error ?? t.errors.downloadFailed;
    save(res.url);
    return null;
  } catch {
    return t.errors.downloadFailed;
  }
}
