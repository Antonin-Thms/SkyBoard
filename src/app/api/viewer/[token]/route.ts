import type { NextRequest } from "next/server";
import { isViewerToken } from "@/lib/cockpits/token";
import { STORAGE_BUCKET, VIEWER_URL_TTL } from "@/lib/documents/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { channelNameForToken } from "@/lib/sync/channel";
import { parseViewState } from "@/lib/sync/protocol";
import type { ViewerDocument, ViewerPayload } from "@/lib/viewer/types";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

function notFound() {
  // Réponse identique pour un token mal formé ou inconnu.
  return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
}

/**
 * Accès viewer par token (sans compte) : valide le token avec la clé
 * service_role et renvoie les documents du propriétaire avec des URLs signées.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/viewer/[token]">) {
  const { token } = await ctx.params;
  if (!isViewerToken(token)) return notFound();

  const admin = createAdminClient();

  const { data: cockpit, error: cockpitError } = await admin
    .from("cockpits")
    .select("user_id, name, last_state, active_folder_id")
    .eq("viewer_token", token)
    .maybeSingle();
  if (cockpitError) {
    return Response.json({ error: "server_error" }, { status: 500, headers: NO_STORE });
  }
  if (!cockpit) return notFound();

  // Dossier actif : ses documents + les documents communs (sans dossier).
  let docsQuery = admin
    .from("documents")
    .select("id, name, type, page_count, rotation, storage_path")
    .eq("user_id", cockpit.user_id);
  let folder: { name: string } | null = null;
  if (cockpit.active_folder_id) {
    docsQuery = docsQuery.or(`folder_id.is.null,folder_id.eq.${cockpit.active_folder_id}`);
    const { data: f } = await admin
      .from("folders")
      .select("name")
      .eq("id", cockpit.active_folder_id)
      .maybeSingle();
    folder = f ? { name: f.name } : null;
  }
  const { data: rows, error: docsError } = await docsQuery.order("sort_order").order("created_at");
  if (docsError) {
    return Response.json({ error: "server_error" }, { status: 500, headers: NO_STORE });
  }

  const docs = rows ?? [];
  const expiresAt = Date.now() + VIEWER_URL_TTL * 1000;
  const urls = new Map<string, string>();
  if (docs.length) {
    const { data: signed, error: signError } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(
        docs.map((d) => d.storage_path),
        VIEWER_URL_TTL,
      );
    if (signError) {
      return Response.json({ error: "server_error" }, { status: 500, headers: NO_STORE });
    }
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    });
  }

  const documents: ViewerDocument[] = docs.flatMap((d) => {
    const url = urls.get(d.storage_path);
    return url
      ? [{ id: d.id, name: d.name, type: d.type, pageCount: d.page_count, rotation: d.rotation, url }]
      : [];
  });

  const payload: ViewerPayload = {
    cockpit: { name: cockpit.name },
    folder,
    channel: channelNameForToken(token),
    lastState: parseViewState(cockpit.last_state),
    documents,
    expiresAt,
  };
  return Response.json(payload, { headers: NO_STORE });
}
