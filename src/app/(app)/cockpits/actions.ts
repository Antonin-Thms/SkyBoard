"use server";

import { revalidatePath } from "next/cache";
import { fmt } from "@/lib/i18n/define";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { notifyDocumentsChanged } from "@/lib/sync/notify";
import { cleanName, isUuid } from "@/lib/validation";

export interface ActionResult {
  error?: string;
}

const MAX_COCKPITS = 20;

export async function createCockpit(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const t = await getT();
  const name = cleanName(formData.get("name"), 100);
  if (!name) return { error: t.cockpits.errors.nameRequired };

  const supabase = await createClient();
  const { count } = await supabase.from("cockpits").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_COCKPITS) return { error: fmt(t.cockpits.errors.max, { n: MAX_COCKPITS }) };

  const { error } = await supabase.from("cockpits").insert({ name });
  if (error) return { error: t.cockpits.errors.createFailed };

  revalidatePath("/cockpits");
  return {};
}

export async function renameCockpit(id: string, name: string): Promise<ActionResult> {
  const t = await getT();
  const cleaned = cleanName(name, 100);
  if (!isUuid(id) || !cleaned) return { error: t.cockpits.errors.invalidName };

  const supabase = await createClient();
  const { error } = await supabase.from("cockpits").update({ name: cleaned }).eq("id", id);
  if (error) return { error: t.cockpits.errors.renameFailed };

  revalidatePath("/cockpits");
  return {};
}

/** Régénère le token : l'ancienne URL viewer cesse de fonctionner. */
export async function regenerateCockpitToken(id: string): Promise<ActionResult> {
  const t = await getT();
  if (!isUuid(id)) return { error: t.cockpits.errors.invalidCockpit };

  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_viewer_token", { cockpit_id: id });
  if (error) return { error: t.cockpits.errors.regenerateFailed };

  revalidatePath("/cockpits");
  return {};
}

export async function deleteCockpit(id: string): Promise<ActionResult> {
  const t = await getT();
  if (!isUuid(id)) return { error: t.cockpits.errors.invalidCockpit };

  const supabase = await createClient();
  const { error } = await supabase.from("cockpits").delete().eq("id", id);
  if (error) return { error: t.cockpits.errors.deleteFailed };

  revalidatePath("/cockpits");
  return {};
}

/** Dossier actif du cockpit (null = tous les documents). */
export async function setActiveFolder(cockpitId: string, folderId: string | null): Promise<ActionResult> {
  const t = await getT();
  if (!isUuid(cockpitId) || (folderId !== null && !isUuid(folderId))) {
    return { error: t.cockpits.errors.invalidFolder };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cockpits")
    .update({ active_folder_id: folderId })
    .eq("id", cockpitId);
  if (error) return { error: t.cockpits.errors.folderChangeFailed };

  revalidatePath("/cockpits");
  revalidatePath("/remote");
  notifyDocumentsChanged(supabase, cockpitId);
  return {};
}
