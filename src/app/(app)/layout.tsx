import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-nav";
import { getDocuments, getFolders } from "@/lib/documents/server";
import { getSessionClaims } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const claims = await getSessionClaims();
  // Double vérification (le proxy redirige déjà) : ne jamais rendre sans session.
  if (!claims?.sub) redirect("/login");

  // Dossiers et compteurs pour la navigation. Mêmes lectures que la page
  // (mémoïsées par requête) : pas d'aller-retour Supabase supplémentaire.
  const [folders, { documents }] = await Promise.all([getFolders(), getDocuments()]);
  const counts = { all: 0, common: 0, byFolder: {} as Record<string, number> };
  for (const d of documents) {
    if (!d.readOnly) counts.all++;
    if (d.folderId) counts.byFolder[d.folderId] = (counts.byFolder[d.folderId] ?? 0) + 1;
    else if (!d.readOnly) counts.common++;
  }

  return (
    <AppShell
      folders={folders}
      counts={counts}
      email={typeof claims.email === "string" ? claims.email : ""}
      version={process.env.NEXT_PUBLIC_APP_VERSION}
      logout={logout}
    >
      {children}
    </AppShell>
  );
}
