import { HelpPanel } from "@/components/help-panel";
import { SquadronsView } from "@/components/squadrons/squadrons-view";
import { getFolders } from "@/lib/documents/server";
import { siteOrigin } from "@/lib/site-url";
import { getSquadrons } from "@/lib/squadrons/server";

export const metadata = { title: "Escadrons · SkyBoard" };

export default async function SquadronsPage() {
  const [squadrons, folders, origin] = await Promise.all([getSquadrons(), getFolders(), siteOrigin()]);

  return (
    <div className="space-y-6">
      <div>
        <div className="label-caps">Partage</div>
        <h1 className="mt-1 text-3xl font-medium">Escadrons</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Partage des dossiers de kneeboards avec tes coéquipiers : ils les retrouvent en lecture
          seule et peuvent les choisir comme dossier actif de leur cockpit. Quand tu mets un dossier
          à jour, leurs casques se rechargent.
        </p>
      </div>

      <SquadronsView squadrons={squadrons} folders={folders} origin={origin} />

      <HelpPanel defaultOpen={false}>
        <ul className="list-disc space-y-1 pl-5">
          <li>Crée un escadron, puis envoie le lien d&apos;invitation (Discord…) à tes coéquipiers.</li>
          <li>
            Partage un de tes dossiers avec l&apos;escadron : ici, ou depuis la page Documents
            (dossier ouvert → « Partager avec »).
          </li>
          <li>
            Les membres voient le dossier sous « Escadrons » dans Documents, et le choisissent comme
            dossier actif sur la page Remote ou Cockpits. Chacun garde ses propres annotations.
          </li>
          <li>Seul le propriétaire du dossier peut en modifier le contenu.</li>
        </ul>
      </HelpPanel>
    </div>
  );
}
