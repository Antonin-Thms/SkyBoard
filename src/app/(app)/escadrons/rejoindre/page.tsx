import { JoinSquadronForm } from "@/components/squadrons/join-form";
import { PageHeader } from "@/components/ui/page-header";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t.squadrons.join.metaTitle };
}

export default async function JoinSquadronPage({ searchParams }: PageProps<"/escadrons/rejoindre">) {
  const { code } = await searchParams;
  const t = await getT();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader
        eyebrow={t.squadrons.join.eyebrow}
        title={t.squadrons.join.title}
        description={t.squadrons.join.description}
      />
      <JoinSquadronForm code={typeof code === "string" ? code : ""} />
    </div>
  );
}
