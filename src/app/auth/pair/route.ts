import { NextResponse, type NextRequest } from "next/server";
import { hashPairingCode, isPairingCode } from "@/lib/auth/pairing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Scan du QR code de la page Remote : consomme le code de jumelage (usage
 * unique, 2 minutes), connecte l'appareil puis ouvre la remote en mode vol.
 * Le jeton de connexion est créé et vérifié ici même : il ne quitte jamais
 * le serveur.
 */
export async function GET(request: NextRequest) {
  const fail = () => NextResponse.redirect(new URL("/login?error=pairing", request.url));
  const code = request.nextUrl.searchParams.get("c");
  if (!isPairingCode(code)) return fail();

  const admin = createAdminClient();
  const { data: pairing } = await admin
    .from("remote_pairings")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hashPairingCode(code))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("user_id, cockpit_id")
    .maybeSingle();
  if (!pairing) return fail();

  const { data: user } = await admin.auth.admin.getUserById(pairing.user_id);
  const email = user.user?.email;
  if (!email) return fail();
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) return fail();

  // Ouvre la session sur cet appareil (cookies posés par le client serveur).
  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (otpError) return fail();

  return NextResponse.redirect(
    new URL(`/remote?cockpit=${pairing.cockpit_id}&mode=flight`, request.url),
  );
}
