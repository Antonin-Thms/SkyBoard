import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewerApp } from "@/components/viewer/viewer-app";
import { isViewerToken } from "@/lib/cockpits/token";

export const metadata: Metadata = {
  title: "SkyBoard Viewer",
  robots: { index: false, follow: false },
  // Le token est dans l'URL : ne jamais l'envoyer en Referer (Supabase, etc.).
  referrer: "no-referrer",
};

/**
 * Page affichée dans l'onglet Web Dashboard d'OpenKneeboard.
 * Accès par token uniquement, aucune interaction requise.
 * Paramètres optionnels (à ajouter à la main) : ?transparent=1 · ?status=0 · ?cursor=0
 */
export default async function ViewerPage({ params, searchParams }: PageProps<"/viewer/[token]">) {
  const { token } = await params;
  if (!isViewerToken(token)) notFound();

  const query = await searchParams;
  const transparent = query.transparent === "1";
  const showStatus = query.status !== "0";
  // Curseur affiché quand la remote l'envoie (bouton « Curseur ») ; ?cursor=0 le masque.
  const showCursor = query.cursor !== "0";

  return (
    <>
      {/* Rendu serveur : fond transparent dès le premier affichage, sans flash. */}
      <style>{`html,body{overflow:hidden;${
        transparent ? "background:transparent!important;" : "background:#000;"
      }}`}</style>
      <ViewerApp token={token} options={{ showStatus, showCursor }} />
    </>
  );
}
