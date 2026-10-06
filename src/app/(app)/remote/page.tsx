import type { Viewport } from "next";
import Link from "next/link";
import { RemoteApp } from "@/components/remote/remote-app";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getDocuments, getFolders } from "@/lib/documents/server";
import type { RemoteCockpit, RemoteDocument } from "@/lib/remote/types";
import { createClient } from "@/lib/supabase/server";
import { channelNameForToken } from "@/lib/sync/channel";
import { parseViewState } from "@/lib/sync/protocol";

export const metadata = { title: "Remote · SkyBoard" };

// Remote tactile : pas de zoom natif du navigateur (le zoom pilote le viewer).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RemotePage({ searchParams }: PageProps<"/remote">) {
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: rows }, { documents: docs }, folders] = await Promise.all([
    supabase
      .from("cockpits")
      .select("id, name, viewer_token, last_state, active_folder_id")
      .order("created_at"),
    getDocuments(),
    getFolders(),
  ]);

  // Le token reste côté serveur : la remote ne reçoit que le nom du canal.
  const cockpits: RemoteCockpit[] = (rows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    channel: channelNameForToken(c.viewer_token),
    lastState: parseViewState(c.last_state),
    activeFolderId: c.active_folder_id,
  }));
  const documents: RemoteDocument[] = docs.map(
    ({ id, name, type, pageCount, thumbnailUrl, folderId, rotation, readOnly }) => ({
      id,
      name,
      type,
      pageCount,
      thumbnailUrl,
      folderId,
      rotation,
      readOnly,
    }),
  );

  if (cockpits.length === 0) {
    return (
      <EmptyState
        title="Aucun cockpit"
        text="Crée d'abord un cockpit, puis colle son URL dans OpenKneeboard."
        action={
          <Link href="/cockpits" className="btn-primary">
            Créer un cockpit
          </Link>
        }
      />
    );
  }

  const requested = typeof query.cockpit === "string" ? query.cockpit : null;
  return (
    <div className="space-y-5">
      <div className="hidden md:block">
        <PageHeader eyebrow="Pilotage" title="Remote" />
      </div>
      <RemoteApp
        cockpits={cockpits}
        documents={documents}
        folders={folders}
        initialCockpitId={cockpits.some((c) => c.id === requested) ? requested : null}
        initialMode={query.mode === "flight" ? "flight" : "prep"}
      />
    </div>
  );
}
