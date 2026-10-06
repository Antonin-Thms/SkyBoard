import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionClaims } from "@/lib/supabase/server";

export default async function Home() {
  if ((await getSessionClaims())?.sub) redirect("/documents");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">SkyBoard</h1>
        <p className="max-w-md text-slate-400">
          Pilote l&apos;affichage de tes kneeboards dans le casque VR depuis ton iPad, via
          l&apos;onglet Web Dashboard d&apos;OpenKneeboard.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login" className="btn-primary">
          Se connecter
        </Link>
        <Link href="/signup" className="btn-secondary">
          Créer un compte
        </Link>
      </div>
    </main>
  );
}
