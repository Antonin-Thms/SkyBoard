import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { applyRememberPolicy, REMEMBER_COOKIE, shouldRemember } from "@/lib/auth/remember";
import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/**
 * Client Supabase pour Server Components, Server Actions et Route Handlers,
 * agissant au nom de l'utilisateur connecté (RLS appliquée).
 * Mémoïsé par requête : mise en page et page partagent le même client.
 */
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        const remember = shouldRemember(cookieStore.get(REMEMBER_COOKIE)?.value);
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, applyRememberPolicy(options, remember)),
          );
        } catch {
          // Appelé depuis un Server Component : les cookies sont en lecture seule.
          // Le proxy se charge de rafraîchir la session.
        }
      },
    },
  });
});

/** Claims de la session (JWT vérifié), une seule fois par requête. */
export const getSessionClaims = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
});
