import type { Viewport } from "next";
import Link from "next/link";
import { RemoteApp } from "@/components/remote/remote-app";
import { listDocumentsWithThumbnails, listFolders } from "@/lib/documents/server";
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
    listDocumentsWithThumbnails(supabase),
    listFolders(supabase),
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
    ({ id, name, type, pageCount, thumbnailUrl, folderId }) => ({
      id,
      name,
      type,
      pageCount,
      thumbnailUrl,
      folderId,
    }),
  );

  if (cockpits.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-800 p-8 text-center text-slate-400">
        Crée d&apos;abord un cockpit sur la page{" "}
        <Link href="/cockpits" className="text-sky-400 hover:underline">
          Cockpits
        </Link>
        .
      </p>
    );
  }

  const requested = typeof query.cockpit === "string" ? query.cockpit : null;
  return (
    <RemoteApp
      cockpits={cockpits}
      documents={documents}
      folders={folders}
      initialCockpitId={cockpits.some((c) => c.id === requested) ? requested : null}
      initialMode={query.mode === "flight" ? "flight" : "prep"}
    />
  );
}
