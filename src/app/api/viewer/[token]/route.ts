import type { NextRequest } from "next/server";
import { isViewerToken } from "@/lib/cockpits/token";
import { STORAGE_BUCKET, VIEWER_URL_TTL } from "@/lib/documents/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { channelNameForToken } from "@/lib/sync/channel";
import { pageKey, parseStrokes, type Stroke } from "@/lib/annotations/model";
import { logError } from "@/lib/log";
import { createRateLimiter } from "@/lib/rate-limit";
import { parseViewState } from "@/lib/sync/protocol";
import type { ViewerDocument, ViewerPayload } from "@/lib/viewer/types";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/** Un viewer normal fait une requête par heure (plus quelques rechargements). */
const allowRequest = createRateLimiter({ limit: 30, windowMs: 60_000 });

function notFound() {
  // Réponse identique pour un token mal formé ou inconnu.
  return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
}

/**
 * Accès viewer par token (sans compte) : valide le token avec la clé
 * service_role et renvoie les documents du propriétaire avec des URLs signées.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/viewer/[token]">) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRequest(ip)) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } });
  }
  const { token } = await ctx.params;
  if (!isViewerToken(token)) return notFound();

  const admin = createAdminClient();

  const { data: cockpit, error: cockpitError } = await admin
    .from("cockpits")
    .select("user_id, name, last_state, active_folder_id")
    .eq("viewer_token", token)
    .maybeSingle();
  if (cockpitError) {
    logError("viewer.cockpit", cockpitError);
    return Response.json({ error: "server_error" }, { status: 500, headers: NO_STORE });
  }
  if (!cockpit) return notFound();

  // Dossier actif : ses documents + les documents communs (sans dossier) du
  // pilote. Le dossier peut être partagé par un coéquipier : on vérifie que
  // le pilote est toujours membre de l'escadron, sinon on l'ignore.
  let folderId = cockpit.active_folder_id;
  let folderRes: { data: { name: string } | null } = { data: null };
  if (folderId) {
    const { data: f } = await admin
      .from("folders")
      .select("name, user_id, squadron_id")
      .eq("id", folderId)
      .maybeSingle();
    let accessible = !!f && f.user_id === cockpit.user_id;
    if (f && !accessible && f.squadron_id) {
      const { data: member } = await admin
        .from("squadron_members")
        .select("user_id")
        .eq("squadron_id", f.squadron_id)
        .eq("user_id", cockpit.user_id)
        .maybeSingle();
      accessible = !!member;
    }
    if (accessible && f) folderRes = { data: { name: f.name } };
    else folderId = null;
  }
  const docsQuery = admin
    .from("documents")
    .select("id, name, type, page_count, rotation, storage_path")
    // Avec un dossier actif : communs du pilote + documents du dossier (éventuellement d'un coéquipier).
    .or(
      folderId
        ? `and(user_id.eq.${cockpit.user_id},folder_id.is.null),folder_id.eq.${folderId}`
        : `user_id.eq.${cockpit.user_id}`,
    );
  const docsRes = await docsQuery.order("sort_order").order("created_at");
  const folder = folderRes.data ? { name: folderRes.data.name } : null;
  const { data: rows, error: docsError } = docsRes;
  if (docsError) {
    logError("viewer.documents", docsError);
    return Response.json({ error: "server_error" }, { status: 500, headers: NO_STORE });
  }

  const docs = rows ?? [];
  const expiresAt = Date.now() + VIEWER_URL_TTL * 1000;
  const urls = new Map<string, string>();
  const annotations: Record<string, Stroke[]> = {};
  if (docs.length) {
    // URLs signées et annotations en parallèle.
    const [{ data: signed, error: signError }, { data: inkRows, error: inkError }] = await Promise.all([
      admin.storage.from(STORAGE_BUCKET).createSignedUrls(
        docs.map((d) => d.storage_path),
        VIEWER_URL_TTL,
      ),
      admin
        .from("annotations")
        .select("document_id, page, strokes")
        // Annotations du pilote de ce cockpit uniquement.
        .eq("user_id", cockpit.user_id)
        .in(
          "document_id",
          docs.map((d) => d.id),
        ),
    ]);
    if (inkError) logError("viewer.annotations", inkError);
    for (const row of inkRows ?? []) {
      const strokes = parseStrokes(row.strokes);
      if (strokes.length) annotations[pageKey(row.document_id, row.page)] = strokes;
    }
    if (signError) {
      logError("viewer.sign", signError);
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
    annotations,
    expiresAt,
  };
  return Response.json(payload, { headers: NO_STORE });
}
