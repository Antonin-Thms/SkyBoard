import { HelpPanel } from "@/components/help-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SquadronsView } from "@/components/squadrons/squadrons-view";
import { getFolders } from "@/lib/documents/server";
import { getT } from "@/lib/i18n/server";
import { siteOrigin } from "@/lib/site-url";
import { getSquadrons } from "@/lib/squadrons/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t.squadrons.page.metaTitle };
}

export default async function SquadronsPage() {
  const t = await getT();
  const [squadrons, folders, origin] = await Promise.all([getSquadrons(), getFolders(), siteOrigin()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.squadrons.page.eyebrow}
        title={t.squadrons.page.title}
        description={t.squadrons.page.description}
      />

      <SquadronsView squadrons={squadrons} folders={folders} origin={origin} />

      <HelpPanel defaultOpen={false}>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t.squadrons.help.create}</li>
          <li>{t.squadrons.help.share}</li>
          <li>{t.squadrons.help.members}</li>
          <li>{t.squadrons.help.owner}</li>
        </ul>
      </HelpPanel>
    </div>
  );
}
