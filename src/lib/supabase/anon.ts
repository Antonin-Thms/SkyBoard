"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

let client: SupabaseClient | undefined;

/**
 * Client Supabase anonyme (viewer) : aucune session, utilisé uniquement
 * pour le canal Realtime du cockpit.
 */
export function createAnonClient(): SupabaseClient {
  client ??= createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
