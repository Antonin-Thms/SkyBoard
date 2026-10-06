"use server";

import { siteOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";

export interface RemoteLinkResult {
  url?: string;
  /** true : le lien connecte automatiquement l'appareil qui le scanne */
  autoLogin?: boolean;
  error?: string;
}

/**
 * Lien à encoder dans le QR code affiché sur le PC : ouvre la remote du
 * cockpit directement en mode vol. Avec `autoLogin`, le lien contient un
 * jeton de connexion à usage unique (magic link Supabase), qui expire selon
 * le réglage « Email OTP Expiration » du projet (1 h par défaut).
 */
export async function createRemoteLink(cockpitId: string, autoLogin: boolean): Promise<RemoteLinkResult> {
  if (!isUuid(cockpitId)) return { error: "Cockpit invalide." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const email = typeof auth?.claims?.email === "string" ? auth.claims.email : null;
  if (!auth?.claims?.sub || !email) return { error: "Session expirée." };

  // Vérifie (via RLS) que le cockpit appartient bien à l'utilisateur.
  const { data: cockpit } = await supabase.from("cockpits").select("id").eq("id", cockpitId).maybeSingle();
  if (!cockpit) return { error: "Cockpit introuvable." };

  const origin = await siteOrigin();
  const target = `/remote?cockpit=${cockpitId}&mode=flight`;
  if (!autoLogin) return { url: `${origin}${target}`, autoLogin: false };

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) return { error: "Impossible de générer le lien de connexion." };

  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("next", target);
  return { url: url.toString(), autoLogin: true };
}
