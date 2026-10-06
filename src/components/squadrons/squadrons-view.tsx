"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createSquadron,
  deleteSquadron,
  leaveSquadron,
  regenerateInvite,
  shareFolder,
} from "@/app/(app)/escadrilles/actions";
import type { FolderSummary } from "@/lib/documents/folders";
import type { SquadronSummary } from "@/lib/squadrons/server";

interface SquadronsViewProps {
  squadrons: SquadronSummary[];
  folders: FolderSummary[];
  origin: string;
}

export function SquadronsView({ squadrons, folders, origin }: SquadronsViewProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [callsign, setCallsign] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const res = await action();
      setError(res.error ?? null);
      if (!res.error) router.refresh();
    });

  return (
    <div className={`space-y-6 ${pending ? "opacity-70" : ""}`}>
      <form
        className="flex flex-wrap items-end gap-3 border border-slate-800 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const res = await createSquadron(name, callsign);
            if (!res.error) setName("");
            return res;
          });
        }}
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-400">Nouvelle escadrille</span>
          <input
            className="input"
            maxLength={60}
            placeholder="Nom (ex. VF-31 Tomcatters)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-sm">
          <span className="text-slate-400">Ton indicatif</span>
          <input
            className="input"
            maxLength={40}
            placeholder="ex. Maverick"
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          Créer
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {squadrons.length === 0 ? (
        <p className="border border-slate-800 p-8 text-center text-slate-500">
          Aucune escadrille. Crée-en une, ou ouvre le lien d&apos;invitation reçu d&apos;un coéquipier.
        </p>
      ) : (
        <ul className="space-y-4">
          {squadrons.map((s) => (
            <SquadronCard
              key={s.id}
              squadron={s}
              folders={folders}
              origin={origin}
              disabled={pending}
              run={run}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SquadronCard({
  squadron: s,
  folders,
  origin,
  disabled,
  run,
}: {
  squadron: SquadronSummary;
  folders: FolderSummary[];
  origin: string;
  disabled: boolean;
  run: (action: () => Promise<{ error?: string }>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${origin}/escadrilles/rejoindre?code=${s.inviteCode}`;
  const shared = folders.filter((f) => f.squadronId === s.id);
  const mine = folders.filter((f) => !f.readOnly);
  const shareable = mine.filter((f) => f.squadronId !== s.id);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie le lien d'invitation :", link);
    }
  };

  return (
    <li className="space-y-4 border border-slate-800 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-medium">{s.name}</h2>
        <span className="text-xs text-slate-500">
          {s.members.length} membre{s.members.length > 1 ? "s" : ""}
          {s.isOwner && " · tu es propriétaire"}
        </span>
      </div>

      <div className="space-y-1">
        <div className="label-caps">Invitation</div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input max-w-xl font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn-secondary" onClick={() => void copy()}>
            {copied ? "Copié ✓" : "Copier"}
          </button>
          {s.isOwner && (
            <button
              type="button"
              className="btn-text text-slate-400"
              disabled={disabled}
              title="L'ancien lien ne fonctionnera plus"
              onClick={() => run(() => regenerateInvite(s.id))}
            >
              Nouveau lien
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="label-caps">Membres</div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {s.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 border border-slate-800 px-2.5 py-1">
              <span>
                {m.callsign}
                {m.isOwner && <span className="text-accent"> ★</span>}
                {m.isMe && <span className="text-slate-500"> (toi)</span>}
              </span>
              {s.isOwner && !m.isOwner && (
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  disabled={disabled}
                  onClick={() => {
                    if (window.confirm(`Retirer ${m.callsign} de l'escadrille ?`)) run(() => leaveSquadron(s.id, m.userId));
                  }}
                >
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <div className="label-caps">Dossiers partagés</div>
        {shared.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun dossier partagé pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {shared.map((f) => (
              <li key={f.id} className="flex items-center gap-3">
                <span>📁 {f.name}</span>
                {f.readOnly ? (
                  <span className="text-xs text-slate-500">partagé par un coéquipier</span>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-white"
                    disabled={disabled}
                    onClick={() => run(() => shareFolder(f.id, null))}
                  >
                    Ne plus partager
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {shareable.length > 0 && (
          <select
            className="input w-auto"
            value=""
            disabled={disabled}
            aria-label={`Partager un dossier avec ${s.name}`}
            onChange={(e) => {
              const id = e.target.value;
              if (id) run(() => shareFolder(id, s.id));
            }}
          >
            <option value="">Partager un de mes dossiers…</option>
            {shareable.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {f.squadronName ? ` (partagé avec ${f.squadronName})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="border-t border-slate-800 pt-3 text-sm">
        {s.isOwner ? (
          <button
            type="button"
            className="text-red-400 hover:text-red-300"
            disabled={disabled}
            onClick={() => {
              if (window.confirm(`Supprimer l'escadrille « ${s.name} » ? Les partages s'arrêtent pour tous.`)) {
                run(() => deleteSquadron(s.id));
              }
            }}
          >
            Supprimer l&apos;escadrille
          </button>
        ) : (
          <button
            type="button"
            className="text-red-400 hover:text-red-300"
            disabled={disabled}
            onClick={() => {
              if (window.confirm(`Quitter l'escadrille « ${s.name} » ?`)) run(() => leaveSquadron(s.id));
            }}
          >
            Quitter l&apos;escadrille
          </button>
        )}
      </div>
    </li>
  );
}
