import { CockpitCard } from "@/components/cockpits/cockpit-card";
import { CreateCockpitForm } from "@/components/cockpits/create-cockpit-form";
import { HelpPanel } from "@/components/help-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getFolders } from "@/lib/documents/server";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t.cockpits.page.metaTitle };
}

export default async function CockpitsPage() {
  const t = await getT();
  const supabase = await createClient();
  const [{ data, error }, folders] = await Promise.all([
    supabase.from("cockpits").select("id, name, viewer_token, active_folder_id").order("created_at"),
    getFolders(),
  ]);
  const cockpits = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OpenKneeboard"
        title={t.cockpits.page.title}
        description={
          <>
            {t.cockpits.page.descriptionBefore}
            <em>Web Dashboard</em>
            {t.cockpits.page.descriptionAfter}
          </>
        }
      />

      <HelpPanel>
        <ol className="list-decimal space-y-1 pl-5">
          <li>{t.cockpits.help.step1}</li>
          <li>
            {t.cockpits.help.step2Before}
            <strong>{t.cockpits.help.step2Copy}</strong>
            {t.cockpits.help.step2Middle}
            <em>Web Dashboard</em>
            {t.cockpits.help.step2After}
          </li>
          <li>
            <strong>{t.cockpits.help.step3Open}</strong>
            {t.cockpits.help.step3Middle}
            <kbd className="rounded bg-slate-800 px-1">H</kbd>
            {t.cockpits.help.step3After}
          </li>
        </ol>
        <p className="text-slate-400">{t.cockpits.help.note}</p>
      </HelpPanel>

      <CreateCockpitForm />

      {error && <p className="text-sm text-danger">{t.cockpits.page.loadError}</p>}

      {cockpits.length === 0 && !error ? (
        <EmptyState
          title={t.cockpits.page.emptyTitle}
          text={t.cockpits.page.emptyText}
        />
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
