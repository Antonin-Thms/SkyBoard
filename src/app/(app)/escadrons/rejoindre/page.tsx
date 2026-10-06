import { JoinSquadronForm } from "@/components/squadrons/join-form";

export const metadata = { title: "Rejoindre un escadron · SkyBoard" };

export default async function JoinSquadronPage({ searchParams }: PageProps<"/escadrons/rejoindre">) {
  const { code } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <div className="label-caps">Invitation</div>
        <h1 className="mt-1 text-3xl font-medium">Rejoindre un escadron</h1>
        <p className="mt-2 text-sm text-slate-400">
          Tu verras les dossiers que l&apos;escadron partage, en lecture seule.
        </p>
      </div>
      <JoinSquadronForm code={typeof code === "string" ? code : ""} />
    </div>
  );
}
