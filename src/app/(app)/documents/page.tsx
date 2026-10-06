import { redirect } from "next/navigation";
import { DocumentGrid, type DocumentItem } from "@/components/documents/document-grid";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { FolderBar } from "@/components/documents/folder-bar";
import { HelpPanel } from "@/components/help-panel";
import { matchesFilter, parseFolderFilter } from "@/lib/documents/folders";
import { listDocumentsWithThumbnails, listFolders } from "@/lib/documents/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Documents · SkyBoard" };

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ documents, error }, folders, query] = await Promise.all([
    listDocumentsWithThumbnails(supabase),
    listFolders(supabase),
    searchParams,
  ]);
  const filter = parseFolderFilter(query.folder, folders.map((f) => f.id));

  const items: DocumentItem[] = documents
    .filter((d) => matchesFilter(d.folderId, filter))
    .map(({ id, name, type, pageCount, thumbnailUrl, folderId }) => ({
      id,
      name,
      type,
      pageCount,
      thumbnailUrl,
      folderId,
    }));
  const nextSortOrder = documents.reduce((max, d) => Math.max(max, d.sortOrder), 0) + 1;
  const folderCounts = folders.map((f) => ({
    ...f,
    count: documents.filter((d) => d.folderId === f.id).length,
  }));
  // Les envois vont dans le dossier affiché (Communs pour « Tous » et « Communs »).
  const uploadFolder = filter.kind === "folder" ? folders.find((f) => f.id === filter.id)! : null;
  // Remonte la grille quand la liste change côté serveur (upload, renommage…).
  const gridKey = `${JSON.stringify(filter)}|${items.map((i) => `${i.id}:${i.name}:${i.folderId}`).join("|")}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-slate-400">
          {documents.length} document{documents.length > 1 ? "s" : ""} · PDF, PNG, JPG, mission ou
          track DCS (.miz, .trk), 50 Mo max
        </p>
      </div>

      <HelpPanel>
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
            gauche d&apos;une miniature (sur iPad : appui long, puis glisse).
          </li>
        </ul>
      </HelpPanel>

      <FolderBar
        folders={folderCounts}
        filter={filter}
        totalCount={documents.length}
        commonCount={documents.filter((d) => d.folderId === null).length}
      />

      <DocumentUploader
        userId={userId}
        nextSortOrder={nextSortOrder}
        folderId={uploadFolder?.id ?? null}
        folderName={uploadFolder?.name ?? null}
      />

      {error ? (
        <p className="text-sm text-red-400">Impossible de charger les documents.</p>
      ) : (
        <DocumentGrid key={gridKey} initialItems={items} folders={folders} />
      )}
    </div>
  );
}
