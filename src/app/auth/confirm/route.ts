import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Lien de confirmation d'email. Gère les deux formats :
 * - ?token_hash=...&type=... (template d'email recommandé, fonctionne sur n'importe quel appareil)
 * - ?code=... (flux PKCE par défaut, même navigateur que l'inscription)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const supabase = await createClient();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const target = ok ? next : "/login?error=confirmation";
  return NextResponse.redirect(new URL(target, request.url));
}
