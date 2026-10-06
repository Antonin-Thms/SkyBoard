import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseUrl } from "@/lib/env";

/**
 * Client service_role : contourne la RLS. Uniquement côté serveur
 * (l'import de "server-only" fait échouer le build s'il fuit vers le client).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Variable d'environnement manquante : SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
