import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DocumentsView } from "@/components/documents/documents-view";
import { HelpPanel } from "@/components/help-panel";
import { getDocuments, getFolders } from "@/lib/documents/server";
import { getSquadrons } from "@/lib/squadrons/server";
import { getSessionClaims } from "@/lib/supabase/server";

export const metadata = { title: "Documents · SkyBoard" };

export default async function DocumentsPage() {
  const userId = (await getSessionClaims())?.sub;
  if (!userId) redirect("/login");

  const [{ documents, error }, folders, squadrons] = await Promise.all([
    getDocuments(),
    getFolders(),
    getSquadrons(),
  ]);
  const nextSortOrder =
    documents.filter((d) => !d.readOnly).reduce((max, d) => Math.max(max, d.sortOrder), 0) + 1;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-red-400">Impossible de charger les documents.</p>
      ) : (
        // Filtrage par dossier côté navigateur : changement de dossier instantané.
        <Suspense>
          <DocumentsView
            userId={userId}
            documents={documents}
            folders={folders}
            squadrons={squadrons.map(({ id, name }) => ({ id, name }))}
            nextSortOrder={nextSortOrder}
          />
        </Suspense>
      )}

      <HelpPanel defaultOpen={false}>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ajoute tes kneeboards : PDF (plusieurs pages) ou images PNG / JPG, 50 Mo max.</li>
          <li>
            Mission ou track DCS : dépose un fichier <span className="font-mono">.miz</span> ou{" "}
            <span className="font-mono">.trk</span> pour importer ses kneeboards et images de
            briefing. Tracks multijoueur :{" "}
            <span className="font-mono">Saved Games\DCS\Tracks\Multiplayer</span>.
          </li>
          <li>
            <strong>Dossiers</strong> (ex. un par serveur) : choisis le dossier actif d&apos;un
            cockpit sur la page Remote ou Cockpits. Le casque affiche alors ce dossier et les
            documents <strong>Communs</strong> (sans dossier), toujours présents.
          </li>
          <li>
            Pour réordonner, fais glisser la poignée <span className="font-mono">⠿</span> en haut à
            gauche d&apos;une miniature (au doigt : appui long, puis glisse).
          </li>
        </ul>
      </HelpPanel>
    </div>
  );
}
