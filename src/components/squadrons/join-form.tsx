"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { joinSquadron } from "@/app/(app)/escadrons/actions";

export function JoinSquadronForm({ code }: { code: string }) {
  const router = useRouter();
  const [callsign, setCallsign] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4 border border-line bg-raised p-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await joinSquadron(code, callsign);
          if (res.error) setError(res.error);
          else router.push("/escadrons");
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Ton indicatif (visible par l&apos;escadron)</span>
        <input
          className="input"
          autoFocus
          maxLength={40}
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
        />
      </label>
      <button type="submit" className="btn-primary" disabled={pending || !code}>
        {pending ? "Connexion…" : "Rejoindre"}
      </button>
      {!code && <p className="text-sm text-danger">Lien d&apos;invitation incomplet.</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
