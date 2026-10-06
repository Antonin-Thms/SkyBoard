import { CockpitCard } from "@/components/cockpits/cockpit-card";
import { CreateCockpitForm } from "@/components/cockpits/create-cockpit-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cockpits · SkyBoard" };

export default async function CockpitsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cockpits")
    .select("id, name, viewer_token")
    .order("created_at");
  const cockpits = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cockpits</h1>
        <p className="text-sm text-slate-400">
          Un cockpit = une URL viewer à coller dans un onglet <em>Web Dashboard</em>{" "}
          d&apos;OpenKneeboard. Garde cette URL secrète : elle donne accès à tes documents.
        </p>
      </div>

      <CreateCockpitForm />

      {error && <p className="text-sm text-red-400">Impossible de charger les cockpits.</p>}

      {cockpits.length === 0 && !error ? (
        <p className="rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
          Aucun cockpit pour l&apos;instant.
        </p>
      ) : (
        <ul className="space-y-4">
          {cockpits.map((c) => (
            <CockpitCard key={`${c.id}:${c.viewer_token}:${c.name}`} id={c.id} name={c.name} token={c.viewer_token} />
          ))}
        </ul>
      )}
    </div>
  );
}
