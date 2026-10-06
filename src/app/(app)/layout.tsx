import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  // Double vérification (le proxy redirige déjà) : ne jamais rendre sans session.
  if (!claims?.sub) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-800 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/documents" className="font-semibold tracking-tight">
              SkyBoard
            </Link>
            <AppNav />
          </div>
          <form action={logout} className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {typeof claims.email === "string" ? claims.email : ""}
            </span>
            <button type="submit" className="btn-secondary">
              Déconnexion
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
