"use client";

import { BookOpen, ClipboardPaste, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveTacticalRefs } from "@/app/(app)/documents/actions";
import {
  AIRBASE_KEYS,
  emptyAirbase,
  emptyStation,
  parsePastedRows,
  STATION_KEYS,
  TACTICAL_LIMITS,
  type TacticalRefs,
} from "@/lib/documents/tactical";
import { MANEX_GERMANY } from "@/lib/documents/presets/manex-germany";
import { useT } from "@/lib/i18n/client";
import { Rows, Section } from "./tactical-fields";

/**
 * Listes de la fiche tactique : terrains et stations radio, saisis ligne par
 * ligne ou collés depuis Excel (une ligne par élément, colonnes dans l'ordre).
 */
export function TacticalRefsDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: TacticalRefs;
  onClose: () => void;
  onSaved: (refs: TacticalRefs) => void;
}) {
  const t = useT().documents.create;
  const tErrors = useT().documents.errors;
  const dialog = useRef<HTMLDialogElement>(null);
  const [refs, setRefs] = useState<TacticalRefs>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    // Lignes vides retirées avant l'enregistrement.
    const clean: TacticalRefs = {
      airbases: refs.airbases.filter((a) => Object.values(a).some((v) => v.trim())),
      stations: refs.stations.filter((s) => Object.values(s).some((v) => v.trim())),
    };
    const res = await saveTacticalRefs(clean).catch(() => ({ error: tErrors.server }));
    setSaving(false);
    if (res.error) setError(res.error);
    else onSaved(clean);
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="refs-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(60rem,calc(100vw-2rem))] rounded-[4px] bg-overlay p-0 text-fg shadow-popover backdrop:bg-black/60"
    >
      <div className="space-y-5 p-5">
        <div className="flex items-center justify-between">
          <h2 id="refs-title" className="text-lg font-medium">
            {t.refsTitle}
          </h2>
          <div className="flex items-center gap-1">
            {/* Listes toutes faites (à enregistrer ensuite) */}
            <button
              type="button"
              className="btn-secondary min-h-9 px-3 text-sm"
              onClick={() => {
                if (window.confirm(t.refsPresetConfirm)) setRefs(structuredClone(MANEX_GERMANY));
              }}
            >
              <BookOpen size={16} strokeWidth={1.75} />
              {t.refsPreset}
            </button>
            <button type="button" className="btn-icon -mr-2" aria-label={t.close} onClick={onClose}>
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <Section title={t.refsAirbases}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="min-w-[44rem]">
              <Rows
                columns={[
                  { key: "name", label: t.colBase, grow: 3 },
                  { key: "tacan", label: "TCN", grow: 2, mono: true },
                  { key: "vhf", label: "VHF", grow: 2, mono: true },
                  { key: "uhf", label: "UHF", grow: 2, mono: true },
                  { key: "elev", label: t.colElev, grow: 2, mono: true },
                  { key: "runway", label: t.colRunway, grow: 2, mono: true },
                  { key: "ils", label: "ILS", grow: 3, mono: true },
                ]}
                rows={refs.airbases}
                max={TACTICAL_LIMITS.refs}
                empty={emptyAirbase()}
                onChange={(airbases) => setRefs((r) => ({ ...r, airbases }))}
              />
            </div>
          </div>
          <PasteBox
            hint={t.refsAirbasesPasteHint}
            onImport={(text) =>
              setRefs((r) => ({
                ...r,
                airbases: [...r.airbases, ...parsePastedRows(text, AIRBASE_KEYS)].slice(0, TACTICAL_LIMITS.refs),
              }))
            }
          />
        </Section>

        <Section title={t.refsStations}>
          <Rows
            columns={[
              { key: "code", label: t.colChannel, grow: 2, mono: true },
              { key: "name", label: t.colName, grow: 4 },
              { key: "freq", label: t.colFreq, grow: 3, mono: true },
            ]}
            rows={refs.stations}
            max={TACTICAL_LIMITS.refs}
            empty={emptyStation()}
            onChange={(stations) => setRefs((r) => ({ ...r, stations }))}
          />
          <PasteBox
            hint={t.refsStationsPasteHint}
            onImport={(text) =>
              setRefs((r) => ({
                ...r,
                stations: [...r.stations, ...parsePastedRows(text, STATION_KEYS)].slice(0, TACTICAL_LIMITS.refs),
              }))
            }
          />
        </Section>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-line bg-overlay px-5 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? t.editSaving : t.refsSave}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Zone « Coller depuis Excel » (repliée par défaut). */
function PasteBox({ hint, onImport }: { hint: string; onImport: (text: string) => void }) {
  const t = useT().documents.create;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) {
    return (
      <button type="button" className="btn-ghost -ml-2 min-h-9 px-2 text-sm" onClick={() => setOpen(true)}>
        <ClipboardPaste size={15} strokeWidth={1.75} />
        {t.refsPaste}
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-[2px] border border-line p-3">
      <p className="text-xs text-subtle">{hint}</p>
      <textarea
        className="input min-h-28 font-mono text-[13px]"
        aria-label={t.refsPaste}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost min-h-9" onClick={() => setOpen(false)}>
          {t.cancel}
        </button>
        <button
          type="button"
          className="btn-secondary min-h-9"
          disabled={!text.trim()}
          onClick={() => {
            onImport(text);
            setText("");
            setOpen(false);
          }}
        >
          {t.refsImport}
        </button>
      </div>
    </div>
  );
}
