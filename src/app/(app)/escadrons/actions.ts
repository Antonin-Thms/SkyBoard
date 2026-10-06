"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyDocumentsChanged } from "@/lib/sync/notify";
import { isUuid } from "@/lib/validation";

interface ActionResult {
  error?: string;
  id?: string;
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

/** Format d'un code d'invitation (16 caractères base64url). */
const isInviteCode = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{16}$/.test(v);

function message(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "53400") {
    return error.message?.includes("complète")
      ? "Escadron complet (100 membres max)."
      : "Nombre maximal d'escadrons atteint (20).";
  }
  if (error.code === "P0002") return "Invitation ou escadron introuvable.";
  if (error.code === "42501") return "Action réservée au propriétaire de l'escadron.";
  return fallback;
}

export async function createSquadron(name: string, callsign: string): Promise<ActionResult> {
  const n = clean(name, 60);
  const c = clean(callsign, 40);
  if (!n || !c) return { error: "Nom de l'escadron et indicatif requis." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_squadron", { name: n, callsign: c });
  if (error) return { error: message(error, "Création impossible.") };
  revalidatePath("/escadrons");
  return { id: data };
}

export async function joinSquadron(code: string, callsign: string): Promise<ActionResult> {
  const c = clean(callsign, 40);
  if (!isInviteCode(code)) return { error: "Lien d'invitation invalide." };
  if (!c) return { error: "Choisis un indicatif." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_squadron", { code, callsign: c });
  if (error) return { error: message(error, "Impossible de rejoindre l'escadron.") };
  revalidatePath("/", "layout");
  return { id: data };
}

/** Quitter un escadron, ou (propriétaire) en retirer un membre. */
export async function leaveSquadron(squadronId: string, memberId: string | null = null): Promise<ActionResult> {
  if (!isUuid(squadronId) || (memberId !== null && !isUuid(memberId))) return { error: "Requête invalide." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_squadron", { squadron: squadronId, member: memberId });
  if (error) return { error: message(error, "Action impossible.") };
  revalidatePath("/", "layout");
  notifyDocumentsChanged(supabase);
  return {};
}

export async function deleteSquadron(squadronId: string): Promise<ActionResult> {
  if (!isUuid(squadronId)) return { error: "Requête invalide." };
  const supabase = await createClient();
  // Casques à prévenir calculés avant que le partage disparaisse.
  notifyDocumentsChanged(supabase);
  const { error } = await supabase.rpc("delete_squadron", { squadron: squadronId });
  if (error) return { error: message(error, "Suppression impossible.") };
  revalidatePath("/", "layout");
  return {};
}

export async function regenerateInvite(squadronId: string): Promise<ActionResult> {
  if (!isUuid(squadronId)) return { error: "Requête invalide." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_squadron_invite", { squadron: squadronId });
  if (error) return { error: message(error, "Action impossible.") };
  revalidatePath("/escadrons");
  return {};
}

/** Partage un de ses dossiers avec un escadron (null : ne plus partager). */
export async function shareFolder(folderId: string, squadronId: string | null): Promise<ActionResult> {
  if (!isUuid(folderId) || (squadronId !== null && !isUuid(squadronId))) return { error: "Requête invalide." };
  const supabase = await createClient();
  // Casques à prévenir calculés avant le changement (membres qui affichaient ce dossier).
  notifyDocumentsChanged(supabase);
  const { error } = await supabase.rpc("share_folder", { folder: folderId, squadron: squadronId });
  if (error) return { error: message(error, "Partage impossible.") };
  revalidatePath("/", "layout");
  return {};
}
