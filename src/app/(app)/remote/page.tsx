import Link from "next/link";
import { RemoteApp } from "@/components/remote/remote-app";
import { listDocumentsWithThumbnails } from "@/lib/documents/server";
import type { RemoteCockpit, RemoteDocument } from "@/lib/remote/types";
import { createClient } from "@/lib/supabase/server";
import { channelNameForToken } from "@/lib/sync/channel";
import { parseViewState } from "@/lib/sync/protocol";

export const metadata = { title: "Remote · SkyBoard" };

export default async function RemotePage() {
  const supabase = await createClient();
  const [{ data: rows }, { documents: docs }] = await Promise.all([
    supabase.from("cockpits").select("id, name, viewer_token, last_state").order("created_at"),
    listDocumentsWithThumbnails(supabase),
  ]);

  // Le token reste côté serveur : la remote ne reçoit que le nom du canal.
  const cockpits: RemoteCockpit[] = (rows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    channel: channelNameForToken(c.viewer_token),
    lastState: parseViewState(c.last_state),
  }));
  const documents: RemoteDocument[] = docs.map(({ id, name, type, pageCount, thumbnailUrl }) => ({
    id,
    name,
    type,
    pageCount,
    thumbnailUrl,
  }));

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

  return <RemoteApp cockpits={cockpits} documents={documents} />;
}
