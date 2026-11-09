"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { renderRtba } from "@/lib/documents/render-rtba";
import { TACTICAL_LIMITS, type RtbaRow } from "@/lib/documents/tactical";
import { useT } from "@/lib/i18n/client";
import type { CreatedPage } from "./create-pages";
import { Rows } from "./tactical-fields";

/** Fiche tactique dont on peut reprendre les waypoints RTBA. */
export interface RtbaSourceCard {
  id: string;
  title: string;
  rows: RtbaRow[];
}

/**
 * Planche RTBA : waypoints et temps de branche (T+), repris d'une fiche
 * tactique ou saisis. En vol, l'appui long règle le slot T0 ; le casque
 * affiche alors l'heure de passage à chaque waypoint.
 */
export function RtbaDialog({
  initial,
  cards,
  onClose,
  onCreate,
}: {
  /** Modification : contenu actuel */
  initial?: { title: string; rows: RtbaRow[] };
  /** Fiches tactiques avec une section RTBA */
  cards: RtbaSourceCard[];
  onClose: () => void;
  onCreate: (item: CreatedPage) => void | Promise<void>;
}) {
  const t = useT().documents.create;
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [rows, setRows] = useState<RtbaRow[]>(() => initial?.rows ?? (cards[0]?.rows.map((r) => ({ ...r })) ?? []));
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  async function create() {
    const clean = rows.map((r) => ({ wp: r.wp.trim(), offset: r.offset.trim() })).filter((r) => r.wp || r.offset);
    if (!clean.length) {
      setError(t.rtbaNoRows);
      return;
    }
    const name = title.trim().slice(0, 120) || "RTBA";
    setWorking(true);
    setError(null);
    try {
      const file = await renderRtba(name, clean, { slot: t.rtbaSlot, waypoint: t.colWaypoint });
      await onCreate({ file, name, source: { kind: "rtba", title: name, rows: clean } });
      setWorking(false);
    } catch {
      setError(t.failed);
      setWorking(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="rtba-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] rounded-[4px] bg-overlay p-0 text-fg shadow-popover backdrop:bg-black/60"
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id="rtba-title" className="text-lg font-medium">
            {initial ? t.editRtbaTitle : t.rtbaDialogTitle}
          </h2>
          <button type="button" className="btn-icon -mr-2" aria-label={t.close} onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          {t.titleLabel}
          <input className="input" value={title} maxLength={120} placeholder="RTBA" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="space-y-1.5">
          <div className="text-sm text-muted">{t.rtbaImport}</div>
          <Select
            label={t.rtbaImport}
            value=""
            placeholder={cards.length ? t.rtbaImportPick : t.rtbaImportNone}
            disabled={!cards.length}
            options={cards.map((c) => ({ value: c.id, label: `${c.title} · ${c.rows.length} WP` }))}
            onChange={(id) => {
              const card = cards.find((c) => c.id === id);
              if (card) setRows(card.rows.map((r) => ({ ...r })));
            }}
          />
        </div>
        <Rows
          columns={[
            { key: "wp", label: t.colWaypoint, grow: 3 },
            { key: "offset", label: "T+", grow: 2, mono: true },
          ]}
          rows={rows}
          max={TACTICAL_LIMITS.rtba}
          empty={{ wp: "", offset: "" }}
          onChange={setRows}
        />
        <p className="text-xs text-subtle">{t.rtbaCreateHint}</p>
        {initial && <p className="text-xs text-muted">{t.editWarning}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="btn-primary" disabled={working}>
            {initial ? (working ? t.editSaving : t.editSubmit) : working ? t.creating : t.rtbaSubmit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
