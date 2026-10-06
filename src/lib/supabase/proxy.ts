import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyRememberPolicy, REMEMBER_COOKIE, shouldRemember } from "@/lib/auth/remember";
import type { Database } from "@/lib/database.types";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";

/** Préfixes réservés aux utilisateurs connectés. */
const PROTECTED_PREFIXES = ["/documents", "/cockpits", "/remote", "/escadrilles"];
/** Pages d'auth : un utilisateur connecté est renvoyé vers l'app. */
const AUTH_PAGES = ["/login", "/signup"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Rafraîchit la session Supabase et protège les routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const remember = shouldRemember(request.cookies.get(REMEMBER_COOKIE)?.value);

  const supabase = createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, applyRememberPolicy(options, remember)),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Ne rien intercaler entre la création du client et getClaims() :
  // c'est cet appel qui valide le JWT et rafraîchit la session si besoin.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!isLoggedIn && matches(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Requête conservée (code d'invitation d'escadrille, cockpit du QR code…).
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return redirectWithCookies(url, response);
  }

  if (isLoggedIn && matches(pathname, AUTH_PAGES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
