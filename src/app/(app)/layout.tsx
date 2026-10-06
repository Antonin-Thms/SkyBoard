import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
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
  const counts = { all: documents.length, common: 0, byFolder: {} as Record<string, number> };
  for (const d of documents) {
    if (d.folderId) counts.byFolder[d.folderId] = (counts.byFolder[d.folderId] ?? 0) + 1;
    else counts.common++;
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-slate-800 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] md:sticky md:top-0 md:h-dvh md:w-60 md:gap-8 md:border-b-0 md:border-r md:px-6 md:py-8">
        <div className="flex items-center justify-between gap-3 md:block">
          <Link href="/" className="font-condensed text-xl font-semibold tracking-[0.2em]" title="Accueil">
            SKYBOARD
          </Link>
          <span className="font-mono text-[10px] text-slate-600 md:mt-1 md:block">
            {process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
          <form action={logout} className="ml-auto md:hidden">
            <button type="submit" className="text-sm text-slate-400 hover:text-slate-100">
              Déconnexion
            </button>
          </form>
        </div>

        <Suspense>
          <AppNav folders={folders} counts={counts} />
        </Suspense>

        <form action={logout} className="mt-auto hidden flex-col gap-2 text-sm md:flex">
          <span className="truncate text-slate-500" title={typeof claims.email === "string" ? claims.email : ""}>
            {typeof claims.email === "string" ? claims.email : ""}
          </span>
          <button type="submit" className="self-start text-slate-400 hover:text-slate-100">
            Déconnexion
          </button>
        </form>
      </aside>

      <main className="w-full min-w-0 flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
