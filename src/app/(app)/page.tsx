import Link from "next/link";
import { Gestures } from "@/components/home/gestures";
import { Steps } from "@/components/home/steps";
import { getDocuments, getFolders } from "@/lib/documents/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Accueil · SkyBoard" };

/** Accueil : présentation du fonctionnement, état du compte et raccourcis. */
export default async function HomePage() {
  const supabase = await createClient();
  const [{ documents }, folders, { count: cockpitCount }] = await Promise.all([
    getDocuments(),
    getFolders(),
    supabase.from("cockpits").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Documents", value: documents.length, href: "/documents" },
    { label: "Dossiers", value: folders.length, href: "/documents" },
    { label: "Cockpits", value: cockpitCount ?? 0, href: "/cockpits" },
  ];
  // Prochaine étape suggérée selon l'état du compte.
  const next =
    documents.length === 0
      ? { href: "/documents", label: "Ajouter mes premiers kneeboards" }
      : (cockpitCount ?? 0) === 0
        ? { href: "/cockpits", label: "Créer mon premier cockpit" }
        : { href: "/remote", label: "Ouvrir la remote" };

  return (
    <div className="space-y-14">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl space-y-3">
          <div className="label-caps">Kneeboards pour DCS World en VR</div>
          <h1 className="text-3xl font-medium leading-tight md:text-4xl">
            Tes kneeboards dans le casque, pilotés du bout des doigts.
          </h1>
          <p className="text-slate-400">
            SkyBoard affiche tes documents dans OpenKneeboard. Depuis une tablette ou un téléphone,
            change de page, zoome et déplace-toi avec des gestes, sans retirer le casque.
          </p>
        </div>
        <Link href={next.href} className="btn-primary">
          {next.label}
        </Link>
      </section>

      <section className="grid grid-cols-3 border border-slate-800">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            href={s.href}
            className={`px-5 py-4 transition hover:bg-slate-900 ${i > 0 ? "border-l border-slate-800" : ""}`}
          >
            <div className="label-caps">{s.label}</div>
            <div className="mt-1 text-3xl font-medium tabular-nums">{s.value}</div>
          </Link>
        ))}
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-medium">Démarrer en 3 étapes</h2>
        <Steps />
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-medium">Gestes du mode vol</h2>
          <p className="text-sm text-slate-500">Utilisables partout sur l&apos;écran, sans regarder.</p>
        </div>
        <Gestures />
      </section>
    </div>
  );
}
