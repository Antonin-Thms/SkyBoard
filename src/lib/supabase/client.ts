"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parse, serialize } from "cookie";
import { applyRememberPolicy, REMEMBER_COOKIE, shouldRemember } from "@/lib/auth/remember";
import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import { REALTIME_OPTIONS } from "@/lib/sync/realtime-options";

let client: SupabaseClient<Database> | undefined;

/** Client Supabase navigateur (session dans les cookies), singleton. */
export function createClient(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    realtime: REALTIME_OPTIONS,
    cookies: {
      getAll() {
        return Object.entries(parse(document.cookie)).map(([name, value]) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        const remember = shouldRemember(parse(document.cookie)[REMEMBER_COOKIE]);
        for (const { name, value, options } of cookiesToSet) {
          document.cookie = serialize(name, value, applyRememberPolicy(options, remember));
        }
      },
    },
  });
  return client;
}
