import { CockpitCard } from "@/components/cockpits/cockpit-card";
import { CreateCockpitForm } from "@/components/cockpits/create-cockpit-form";
import { HelpPanel } from "@/components/help-panel";
import { getFolders } from "@/lib/documents/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cockpits · SkyBoard" };

export default async function CockpitsPage() {
  const supabase = await createClient();
  const [{ data, error }, folders] = await Promise.all([
    supabase.from("cockpits").select("id, name, viewer_token, active_folder_id").order("created_at"),
    getFolders(),
  ]);
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

      <HelpPanel>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Crée un cockpit (par ex. un par avion, ou un seul pour tout).</li>
          <li>
            Clique sur <strong>Copier</strong>, puis colle l&apos;URL dans un onglet{" "}
            <em>Web Dashboard</em> d&apos;OpenKneeboard.
          </li>
          <li>
            <strong>Ouvrir</strong> affiche le viewer dans un onglet du navigateur pour tester hors
            VR. Dans le viewer, appuie sur <kbd className="rounded bg-slate-800 px-1">H</kbd> pour
            l&apos;aide.
          </li>
        </ol>
        <p className="text-slate-400">
          Le viewer affiche tous tes documents (page Documents), dans l&apos;ordre choisi. Il
          s&apos;ouvre sur le dernier document et la dernière page affichés.
        </p>
      </HelpPanel>

      <CreateCockpitForm />

      {error && <p className="text-sm text-red-400">Impossible de charger les cockpits.</p>}

      {cockpits.length === 0 && !error ? (
        <p className="rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
          Aucun cockpit pour l&apos;instant.
        </p>
      ) : (
        <ul className="space-y-4">
          {cockpits.map((c) => (
            <CockpitCard
              key={`${c.id}:${c.viewer_token}:${c.name}`}
              id={c.id}
              name={c.name}
              token={c.viewer_token}
              activeFolderId={c.active_folder_id}
              folders={folders}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
