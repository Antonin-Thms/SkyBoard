"use server";

import { siteOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";
import { STORAGE_BUCKET } from "@/lib/documents/storage";
import { hashPairingCode, newPairingCode, PAIRING_TTL_MS } from "@/lib/auth/pairing";

export interface RemoteLinkResult {
  url?: string;
  /** true : le lien connecte automatiquement l'appareil qui le scanne */
  autoLogin?: boolean;
  error?: string;
}

/**
 * Lien à encoder dans le QR code affiché sur le PC : ouvre la remote du
 * cockpit directement en mode vol. Avec `autoLogin`, le lien contient un code
 * de jumelage à usage unique valable 2 minutes ; le jeton de connexion n'est
 * créé côté serveur qu'au moment du scan (route /auth/pair). Une photo du QR
 * code (stream, capture) devient inutilisable presque aussitôt.
 */
export async function createRemoteLink(cockpitId: string, autoLogin: boolean): Promise<RemoteLinkResult> {
  if (!isUuid(cockpitId)) return { error: "Cockpit invalide." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { error: "Session expirée : reconnecte-toi." };

  // Vérifie (via RLS) que le cockpit appartient bien à l'utilisateur.
  const { data: cockpit } = await supabase.from("cockpits").select("id").eq("id", cockpitId).maybeSingle();
  if (!cockpit) return { error: "Cockpit introuvable." };

  const origin = await siteOrigin();
  if (!autoLogin) return { url: `${origin}/remote?cockpit=${cockpitId}&mode=flight`, autoLogin: false };

  const admin = createAdminClient();
  // Ménage : codes expirés.
  await admin.from("remote_pairings").delete().lt("expires_at", new Date().toISOString());
  const code = newPairingCode();
  const { error } = await admin.from("remote_pairings").insert({
    code_hash: hashPairingCode(code),
    user_id: userId,
    cockpit_id: cockpitId,
    expires_at: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
  });
  if (error) return { error: "Impossible de créer le QR code. Réessaie." };

  const url = new URL("/auth/pair", origin);
  url.searchParams.set("c", code);
  return { url: url.toString(), autoLogin: true };
}

/** URL signée (10 min) du fichier d'un document, pour l'éditeur d'annotations. */
export async function getDocumentFileUrl(documentId: string): Promise<{ url?: string; error?: string }> {
  if (!isUuid(documentId)) return { error: "Document invalide." };
  const supabase = await createClient();
  // RLS : seul le propriétaire voit la ligne.
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Document introuvable." };
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(doc.storage_path, 600);
  if (error || !data?.signedUrl) return { error: "Fichier indisponible." };
  return { url: data.signedUrl };
}
