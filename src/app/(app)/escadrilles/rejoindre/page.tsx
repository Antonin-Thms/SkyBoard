import { JoinSquadronForm } from "@/components/squadrons/join-form";

export const metadata = { title: "Rejoindre une escadrille · SkyBoard" };

export default async function JoinSquadronPage({ searchParams }: PageProps<"/escadrilles/rejoindre">) {
  const { code } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <div className="label-caps">Invitation</div>
        <h1 className="mt-1 text-3xl font-medium">Rejoindre une escadrille</h1>
        <p className="mt-2 text-sm text-slate-400">
          Tu verras les dossiers que l&apos;escadrille partage, en lecture seule.
        </p>
      </div>
      <JoinSquadronForm code={typeof code === "string" ? code : ""} />
    </div>
  );
}
