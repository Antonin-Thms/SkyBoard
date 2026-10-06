import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/**
 * Client Supabase pour Server Components, Server Actions et Route Handlers,
 * agissant au nom de l'utilisateur connecté (RLS appliquée).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component : les cookies sont en lecture seule.
          // Le proxy se charge de rafraîchir la session.
        }
      },
    },
  });
}
