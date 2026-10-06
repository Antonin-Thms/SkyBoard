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
import { useT } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/define";
import type { SquadronSummary } from "@/lib/squadrons/server";

interface SquadronsViewProps {
  squadrons: SquadronSummary[];
  folders: FolderSummary[];
  origin: string;
}

export function SquadronsView({ squadrons, folders, origin }: SquadronsViewProps) {
  const t = useT();
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
          <span className="text-muted">{t.squadrons.view.newSquadron}</span>
          <input
            className="input"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-sm">
          <span className="text-muted">{t.squadrons.view.yourName}</span>
          <input
            className="input"
            maxLength={40}
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          <Plus size={16} strokeWidth={1.75} />
          {t.squadrons.view.create}
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {squadrons.length === 0 ? (
        <EmptyState title={t.squadrons.view.emptyTitle} text={t.squadrons.view.emptyText} />
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
  const t = useT();
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
      window.prompt(t.squadrons.card.copyPrompt, link);
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
          {fmt(s.members.length > 1 ? t.squadrons.card.membersOther : t.squadrons.card.membersOne, {
            n: s.members.length,
          })}
          {s.isOwner && t.squadrons.card.youAreOwner}
        </span>
      </div>

      <div className="space-y-1">
        <div className="label-caps">{t.squadrons.card.invitation}</div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input min-w-0 basis-full font-mono sm:max-w-xl sm:basis-0 sm:flex-1 text-xs text-slate-300"
            aria-label={t.squadrons.card.inviteLinkAria}
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className="btn-secondary" onClick={() => void copy()}>
            {copied ? <Check size={16} strokeWidth={2} className="text-success" /> : <Copy size={16} strokeWidth={1.75} />}
            {copied ? t.squadrons.card.copied : t.squadrons.card.copy}
          </button>
          {s.isOwner && (
            <button
              type="button"
              className="btn-ghost"
              disabled={disabled}
              title={t.squadrons.card.newLinkTitle}
              onClick={() => run(() => regenerateInvite(s.id))}
            >
              <RefreshCw size={15} strokeWidth={1.75} />
              {t.squadrons.card.newLink}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="label-caps">{t.squadrons.card.members}</div>
        <ul className="flex flex-wrap gap-2 text-sm">
          {s.members.map((m) => (
            <li key={m.userId} className="flex h-8 items-center gap-1.5 rounded-[2px] bg-surface pl-2.5 pr-1.5">
              <span className="flex items-center gap-1.5 pr-1">
                {m.callsign}
                {m.isOwner && <Crown size={13} strokeWidth={1.75} className="text-accent" aria-label={t.squadrons.card.ownerAria} />}
                {m.isMe && <span className="text-subtle">{t.squadrons.card.you}</span>}
              </span>
              {s.isOwner && !m.isOwner && (
                <button
                  type="button"
                  className="btn-icon size-6 hover:text-danger pointer-coarse:size-8"
                  aria-label={fmt(t.squadrons.card.removeAria, { name: m.callsign })}
                  title={t.squadrons.card.remove}
                  disabled={disabled}
                  onClick={() => {
                    if (window.confirm(fmt(t.squadrons.card.removeConfirm, { name: m.callsign }))) run(() => leaveSquadron(s.id, m.userId));
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
        <div className="label-caps">{t.squadrons.card.sharedFolders}</div>
        {shared.length === 0 ? (
          <p className="text-sm text-subtle">{t.squadrons.card.noSharedFolders}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {shared.map((f) => (
              <li key={f.id} className="flex items-center gap-3">
                <span className="flex items-center gap-2">
                  <Folder size={15} strokeWidth={1.75} className="text-muted" />
                  {f.name}
                </span>
                {f.readOnly ? (
                  <span className="text-xs text-subtle">{t.squadrons.card.sharedByTeammate}</span>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost min-h-8 px-2 text-xs"
                    disabled={disabled}
                    onClick={() => run(() => shareFolder(f.id, null))}
                  >
                    {t.squadrons.card.unshare}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {shareable.length > 0 && (
          <Select
            label={fmt(t.squadrons.card.shareLabel, { name: s.name })}
            value=""
            placeholder={t.squadrons.card.sharePlaceholder}
            disabled={disabled}
            icon={<Plus size={15} strokeWidth={1.75} />}
            className="w-full sm:w-80"
            onChange={(id) => run(() => shareFolder(id, s.id))}
            options={shareable.map((f) => ({
              value: f.id,
              label: f.squadronName ? fmt(t.squadrons.card.sharedWith, { name: f.name, squadron: f.squadronName }) : f.name,
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
              if (window.confirm(fmt(t.squadrons.card.deleteConfirm, { name: s.name }))) {
                run(() => deleteSquadron(s.id));
              }
            }}
          >
            <Trash2 size={15} strokeWidth={1.75} />
            {t.squadrons.card.delete}
          </button>
        ) : (
          <button
            type="button"
            className="btn-danger -ml-3"
            disabled={disabled}
            onClick={() => {
              if (window.confirm(fmt(t.squadrons.card.leaveConfirm, { name: s.name }))) run(() => leaveSquadron(s.id));
            }}
          >
            <LogOut size={15} strokeWidth={1.75} />
            {t.squadrons.card.leave}
          </button>
        )}
      </div>
    </li>
  );
}
