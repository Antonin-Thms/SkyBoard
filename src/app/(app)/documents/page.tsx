import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DocumentsView } from "@/components/documents/documents-view";
import { HelpPanel } from "@/components/help-panel";
import { getDocuments, getFolders } from "@/lib/documents/server";
import { getSquadrons } from "@/lib/squadrons/server";
import { getSessionClaims } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.documents.metaTitle };
}

export default async function DocumentsPage() {
  const userId = (await getSessionClaims())?.sub;
  if (!userId) redirect("/login");

  const [{ documents, error }, folders, squadrons, t] = await Promise.all([
    getDocuments(),
    getFolders(),
    getSquadrons(),
    getT(),
  ]);
  const help = t.documents.help;
  const nextSortOrder =
    documents.filter((d) => !d.readOnly).reduce((max, d) => Math.max(max, d.sortOrder), 0) + 1;

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-danger">{t.documents.loadError}</p>
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
          <li>{help.files}</li>
          <li>
            {help.missionBefore}
            <span className="font-mono">.miz</span>
            {help.missionOr}
            <span className="font-mono">.trk</span>
            {help.missionAfter}
            <span className="font-mono">Saved Games\DCS\Tracks\Multiplayer</span>
            {help.missionEnd}
          </li>
          <li>
            <strong>{help.foldersLabel}</strong>
            {help.foldersText}
            <strong>{help.commonLabel}</strong>
            {help.foldersEnd}
          </li>
          <li>{help.reorder}</li>
        </ul>
      </HelpPanel>
    </div>
  );
}
