import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { channelNameForToken } from "./channel";
import { SYNC_EVENTS } from "./events";

/**
 * Prévient les viewers des cockpits de l'utilisateur connecté que leur liste
 * de documents a changé (dossier actif, ajout, suppression…) : ils la
 * rechargent aussitôt. Envoi Broadcast par HTTP, sans connexion WebSocket.
 * Ne fait jamais échouer l'action appelante.
 */
export async function notifyDocumentsChanged(
  supabase: SupabaseClient<Database>,
  cockpitId?: string,
): Promise<void> {
  try {
    let query = supabase.from("cockpits").select("viewer_token");
    if (cockpitId) query = query.eq("id", cockpitId);
    const { data } = await query;
    if (!data?.length) return;

    const admin = createAdminClient();
    await Promise.allSettled(
      data.map(async ({ viewer_token }) => {
        const channel = admin.channel(channelNameForToken(viewer_token));
        try {
          await channel.httpSend(SYNC_EVENTS.documentsChanged, { at: Date.now() });
        } finally {
          await admin.removeChannel(channel);
        }
      }),
    );
  } catch {
    // notification best effort : le viewer se resynchronise de toute façon périodiquement
  }
}
