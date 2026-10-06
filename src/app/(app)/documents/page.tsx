import { redirect } from "next/navigation";
import { DocumentGrid, type DocumentItem } from "@/components/documents/document-grid";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { HelpPanel } from "@/components/help-panel";
import { STORAGE_BUCKET, THUMBNAIL_URL_TTL } from "@/lib/documents/storage";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Documents · SkyBoard" };

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: rows, error } = await supabase
    .from("documents")
    .select("*")
    .order("sort_order")
    .order("created_at");

  const documents = rows ?? [];
  const thumbPaths = documents.map((d) => d.thumbnail_path).filter((p): p is string => !!p);
  const thumbUrls = new Map<string, string>();
  if (thumbPaths.length) {
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(thumbPaths, THUMBNAIL_URL_TTL);
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) thumbUrls.set(s.path, s.signedUrl);
    });
  }

  const items: DocumentItem[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    pageCount: d.page_count,
    thumbnailUrl: d.thumbnail_path ? (thumbUrls.get(d.thumbnail_path) ?? null) : null,
  }));
  const nextSortOrder = documents.reduce((max, d) => Math.max(max, d.sort_order), 0) + 1;
  // Remonte la grille quand la liste change côté serveur (upload, renommage…).
  const gridKey = items.map((i) => `${i.id}:${i.name}`).join("|");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-slate-400">
            {documents.length} document{documents.length > 1 ? "s" : ""} · PDF, PNG ou JPG, 50 Mo max
          </p>
        </div>
      </div>

      <HelpPanel>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ajoute tes kneeboards : PDF (plusieurs pages) ou images PNG / JPG, 50 Mo max.</li>
          <li>
            Pour réordonner, fais glisser la poignée <span className="font-mono">⠿</span> en haut à
            gauche d&apos;une miniature (sur iPad : appui long, puis glisse). L&apos;ordre est celui
            du viewer et de la remote.
          </li>
          <li>Tous tes documents sont visibles par tous tes cockpits.</li>
        </ul>
      </HelpPanel>

      <DocumentUploader userId={userId} nextSortOrder={nextSortOrder} />

      {error ? (
        <p className="text-sm text-red-400">Impossible de charger les documents.</p>
      ) : (
        <DocumentGrid key={gridKey} initialItems={items} />
      )}
    </div>
  );
}
