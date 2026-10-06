import { JoinSquadronForm } from "@/components/squadrons/join-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Rejoindre un escadron · SkyBoard" };

export default async function JoinSquadronPage({ searchParams }: PageProps<"/escadrons/rejoindre">) {
  const { code } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader
        eyebrow="Invitation"
        title="Rejoindre un escadron"
        description="Tu verras les dossiers que l'escadron partage, en lecture seule."
      />
      <JoinSquadronForm code={typeof code === "string" ? code : ""} />
    </div>
  );
}
