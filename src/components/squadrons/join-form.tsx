"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinSquadron } from "@/app/(app)/escadrilles/actions";

export function JoinSquadronForm({ code }: { code: string }) {
  const router = useRouter();
  const [callsign, setCallsign] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 border border-slate-800 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await joinSquadron(code, callsign);
          if (res.error) setError(res.error);
          else router.push("/escadrilles");
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-400">Ton indicatif (visible par l&apos;escadrille)</span>
        <input
          className="input"
          autoFocus
          maxLength={40}
          placeholder="ex. Maverick"
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
        />
      </label>
      <button type="submit" className="btn-primary" disabled={pending || !code}>
        {pending ? "Connexion…" : "Rejoindre"}
      </button>
      {!code && <p className="text-sm text-red-400">Lien d&apos;invitation incomplet.</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
