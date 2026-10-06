"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

let client: SupabaseClient<Database> | undefined;

/** Client Supabase navigateur (session dans les cookies), singleton. */
export function createClient(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
  return client;
}
