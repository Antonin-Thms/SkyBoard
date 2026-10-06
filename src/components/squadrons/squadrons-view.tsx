"use client";

import { Check, Copy, Crown, Folder, LogOut, Plus, RefreshCw, Trash2, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createSquadron,
  deleteSquadron,
  leaveSquadron,
  regenerateInvite,
  shareFolder,
} from "@/app/(app)/escadrons/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
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
        className="flex flex-wrap items-end gap-3 border border-line bg-raised p-4"
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
          <span className="text-muted">Nouvel escadron</span>
          <input
            className="input"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-sm">
          <span className="text-muted">Ton nom</span>
          <input
            className="input"
            maxLength={40}
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          <Plus size={16} strokeWidth={1.75} />
          Créer
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {squadrons.length === 0 ? (
        <EmptyState title="Aucun escadron" text="Crée-en un, ou ouvre le lien d'invitation reçu d'un coéquipier." />
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
  const link = `${origin}/escadrons/rejoindre?code=${s.inviteCode}`;
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
    <li className="space-y-5 border border-line bg-raised p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-xl font-medium">
          <Users size={19} strokeWidth={1.75} className="text-muted" />
          {s.name}
        </h2>
        <span className="text-xs text-subtle">
          {s.members.length} membre{s.members.length > 1 ? "s" : ""}
          {s.isOwner && " · tu es propriétaire"}
        </span>
      </div>

      <div className="space-y-1">
        <div className="label-caps">Invitation</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input min-w-0 basis-full font-mono sm:max-w-xl sm:basis-0 sm:flex-1 text-xs text-slate-300"
            aria-label="Lien d'invitation"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className="btn-secondary" onClick={() => void copy()}>
            {copied ? <Check size={16} strokeWidth={2} className="text-success" /> : <Copy size={16} strokeWidth={1.75} />}
            {copied ? "Copié" : "Copier"}
          </button>
          {s.isOwner && (
            <button
              type="button"
              className="btn-ghost"
              disabled={disabled}
              title="L'ancien lien ne fonctionnera plus"
              onClick={() => run(() => regenerateInvite(s.id))}
            >
              <RefreshCw size={15} strokeWidth={1.75} />
              Nouveau lien
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="label-caps">Membres</div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {s.members.map((m) => (
            <li key={m.userId} className="flex h-8 items-center gap-1.5 rounded-[2px] bg-surface pl-2.5 pr-1.5">
              <span className="flex items-center gap-1.5 pr-1">
                {m.callsign}
                {m.isOwner && <Crown size={13} strokeWidth={1.75} className="text-accent" aria-label="propriétaire" />}
                {m.isMe && <span className="text-subtle">(toi)</span>}
              </span>
              {s.isOwner && !m.isOwner && (
                <button
                  type="button"
                  className="btn-icon size-6 hover:text-danger pointer-coarse:size-8"
                  aria-label={`Retirer ${m.callsign}`}
                  title="Retirer"
                  disabled={disabled}
                  onClick={() => {
                    if (window.confirm(`Retirer ${m.callsign} de l'escadron ?`)) run(() => leaveSquadron(s.id, m.userId));
                  }}
                >
                  <X size={14} strokeWidth={1.75} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <div className="label-caps">Dossiers partagés</div>
        {shared.length === 0 ? (
          <p className="text-sm text-subtle">Aucun dossier partagé pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {shared.map((f) => (
              <li key={f.id} className="flex items-center gap-3">
                <span className="flex items-center gap-2">
                  <Folder size={15} strokeWidth={1.75} className="text-muted" />
                  {f.name}
                </span>
                {f.readOnly ? (
                  <span className="text-xs text-subtle">partagé par un coéquipier</span>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost min-h-8 px-2 text-xs"
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
          <Select
            label={`Partager un dossier avec ${s.name}`}
            value=""
            placeholder="Partager un de mes dossiers…"
            disabled={disabled}
            icon={<Plus size={15} strokeWidth={1.75} />}
            className="w-full sm:w-80"
            onChange={(id) => run(() => shareFolder(id, s.id))}
            options={shareable.map((f) => ({
              value: f.id,
              label: f.squadronName ? `${f.name} (partagé avec ${f.squadronName})` : f.name,
              icon: <Folder size={15} strokeWidth={1.75} />,
            }))}
          />
        )}
      </div>

      <div className="border-t border-line pt-3 text-sm">
        {s.isOwner ? (
          <button
            type="button"
            className="btn-danger -ml-3"
            disabled={disabled}
            onClick={() => {
              if (window.confirm(`Supprimer l'escadron « ${s.name} » ? Les partages s'arrêtent pour tous.`)) {
                run(() => deleteSquadron(s.id));
              }
            }}
          >
            <Trash2 size={15} strokeWidth={1.75} />
            Supprimer l&apos;escadron
          </button>
        ) : (
          <button
            type="button"
            className="btn-danger -ml-3"
            disabled={disabled}
            onClick={() => {
              if (window.confirm(`Quitter l'escadron « ${s.name} » ?`)) run(() => leaveSquadron(s.id));
            }}
          >
            <LogOut size={15} strokeWidth={1.75} />
            Quitter l&apos;escadron
          </button>
        )}
      </div>
    </li>
  );
}
