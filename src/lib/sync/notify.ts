import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { logError } from "@/lib/log";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { channelNameForToken } from "./channel";
import { SYNC_EVENTS } from "./events";

/**
 * Prévient les viewers concernés que leur liste de documents a changé
 * (dossier actif, ajout, suppression…) : ils la rechargent aussitôt.
 * - les cockpits de l'utilisateur connecté (ou seulement `cockpitId`) ;
 * - les cockpits d'autres pilotes qui affichent un de ses dossiers partagés.
 * Envoi Broadcast par HTTP, planifié après la réponse (`after`) : l'action
 * n'attend pas. Ne fait jamais échouer l'action appelante.
 */
export function notifyDocumentsChanged(supabase: SupabaseClient<Database>, cockpitId?: string): void {
  const targets = viewerTokens(supabase, cockpitId);
  // Évite un rejet non géré si la réponse part avant la fin.
  targets.catch(() => {});
  after(async () => sendDocumentsChanged(await targets.catch(() => [])));
}

/** Tokens des viewers à prévenir, calculés tout de suite (avant un éventuel retrait de partage). */
async function viewerTokens(supabase: SupabaseClient<Database>, cockpitId?: string): Promise<string[]> {
  let own = supabase.from("cockpits").select("viewer_token");
  if (cockpitId) own = own.eq("id", cockpitId);
  const [{ data: mine }, { data: auth }] = await Promise.all([own, supabase.auth.getClaims()]);
  const tokens = (mine ?? []).map((c) => c.viewer_token);
  if (cockpitId || !auth?.claims?.sub) return tokens;

  // Dossiers partagés de l'utilisateur → cockpits des membres qui les affichent.
  const { data: shared } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", auth.claims.sub)
    .not("squadron_id", "is", null);
  if (shared?.length) {
    const { data: others } = await createAdminClient()
      .from("cockpits")
      .select("viewer_token")
      .in(
        "active_folder_id",
        shared.map((f) => f.id),
      );
    for (const c of others ?? []) if (!tokens.includes(c.viewer_token)) tokens.push(c.viewer_token);
  }
  return tokens;
}

async function sendDocumentsChanged(tokens: string[]) {
  if (!tokens.length) return;
  try {
    const admin = createAdminClient();
    await Promise.allSettled(
      tokens.map(async (token) => {
        const channel = admin.channel(channelNameForToken(token));
        try {
          await channel.httpSend(SYNC_EVENTS.documentsChanged, { at: Date.now() });
        } finally {
          await admin.removeChannel(channel);
        }
      }),
    );
  } catch (err) {
    // Notification best effort : le viewer se resynchronise de toute façon périodiquement.
    logError("notify.documentsChanged", err);
  }
}
