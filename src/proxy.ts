import type { NextRequest } from "next/server";
import { missingServerEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const missing = missingServerEnv();
  if (missing.length) {
    return new Response(
      `SkyBoard : configuration incomplète.\n\nVariables d'environnement manquantes :\n${missing
        .map((m) => `  - ${m}`)
        .join("\n")}\n\nSur Vercel : Settings → Environment Variables, cocher l'environnement concerné (Production et/ou Preview), puis Redeploy.\n`,
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les routes API et le viewer
    // (le viewer est anonyme : accès par token uniquement).
    "/((?!_next/static|_next/image|api/|viewer/|pdfjs/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
