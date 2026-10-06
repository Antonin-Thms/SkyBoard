"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanName, isUuid } from "@/lib/validation";

export interface ActionResult {
  error?: string;
}

const MAX_COCKPITS = 20;

export async function createCockpit(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = cleanName(formData.get("name"), 100);
  if (!name) return { error: "Donne un nom au cockpit." };

  const supabase = await createClient();
  const { count } = await supabase.from("cockpits").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_COCKPITS) return { error: `Maximum ${MAX_COCKPITS} cockpits.` };

  const { error } = await supabase.from("cockpits").insert({ name });
  if (error) return { error: "Création impossible." };

  revalidatePath("/cockpits");
  return {};
}

export async function renameCockpit(id: string, name: string): Promise<ActionResult> {
  const cleaned = cleanName(name, 100);
  if (!isUuid(id) || !cleaned) return { error: "Nom invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("cockpits").update({ name: cleaned }).eq("id", id);
  if (error) return { error: "Renommage impossible." };

  revalidatePath("/cockpits");
  return {};
}

/** Régénère le token : l'ancienne URL viewer cesse de fonctionner. */
export async function regenerateCockpitToken(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "Cockpit invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_viewer_token", { cockpit_id: id });
  if (error) return { error: "Régénération impossible." };

  revalidatePath("/cockpits");
  return {};
}

export async function deleteCockpit(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "Cockpit invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("cockpits").delete().eq("id", id);
  if (error) return { error: "Suppression impossible." };

  revalidatePath("/cockpits");
  return {};
}
