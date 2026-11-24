"use client";

import { BookOpen, ClipboardPaste, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { deleteRefSet, saveRefSet, type TacticalRefSet } from "@/app/(app)/documents/actions";
import { Select } from "@/components/ui/select";
import {
  AIRBASE_KEYS,
  emptyAirbase,
  emptyStation,
  emptySupport,
  parsePastedRows,
  STATION_KEYS,
  SUPPORT_KEYS,
  TACTICAL_LIMITS,
  type TacticalRefs,
} from "@/lib/documents/tactical";
import { INTER_ESCADRILLES_NOV26 } from "@/lib/documents/presets/inter-escadrilles";
import { MANEX_GERMANY } from "@/lib/documents/presets/manex-germany";
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";
import { Rows, Section } from "./tactical-fields";

export type RefSetsState = { sets: TacticalRefSet[]; activeId: string | null };

/** Modèles tout faits (documents de briefing), à enregistrer ensuite sous un nom. */
const PRESETS: { name: string; refs: TacticalRefs }[] = [
  { name: "Manex DJS Germany", refs: MANEX_GERMANY },
  { name: "Inter-escadrilles DJS Nov 26", refs: INTER_ESCADRILLES_NOV26 },
];

const NEW = "";
const emptyRefs = (): TacticalRefs => ({ airbases: [], stations: [], support: [] });
const sortSets = (sets: TacticalRefSet[]) => [...sets].sort((a, b) => a.name.localeCompare(b.name));

/**
 * Listes nommées de la fiche tactique (une par serveur / campagne) :
 * terrains, stations radio et support, saisis ligne par ligne, collés depuis
 * Excel ou repris d'un modèle. Enregistrer rend la liste active.
 */
export function TacticalRefsDialog({
  initial,
  onClose,
  onChange,
}: {
  initial: RefSetsState;
  onClose: () => void;
  /** Listes modifiées (`close` : enregistrement terminé) */
  onChange: (state: RefSetsState, close: boolean) => void;
}) {
  const t = useT().documents.create;
  const tErrors = useT().documents.errors;
  const dialog = useRef<HTMLDialogElement>(null);
  const [sets, setSets] = useState(initial.sets);
  const start = initial.sets.find((s) => s.id === initial.activeId) ?? null;
  const [editId, setEditId] = useState<string>(start?.id ?? NEW);
  const [name, setName] = useState(start?.name ?? "");
  const [refs, setRefs] = useState<TacticalRefs>(() => (start ? structuredClone(start) : emptyRefs()));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  const edit = (fn: (r: TacticalRefs) => TacticalRefs) => {
    setRefs(fn);
    setDirty(true);
  };

  /** Ouvre une liste enregistrée (ou une nouvelle, vide). */
  function open(id: string) {
    if (dirty && !window.confirm(t.refsDiscard)) return;
    const set = sets.find((s) => s.id === id);
    setEditId(set?.id ?? NEW);
    setName(set?.name ?? "");
    setRefs(set ? structuredClone(set) : emptyRefs());
    setDirty(false);
    setError(null);
  }

  async function save(asNew: boolean) {
    setSaving(true);
    setError(null);
    // Lignes vides retirées avant l'enregistrement.
    const clean: TacticalRefs = {
      airbases: refs.airbases.filter((a) => Object.values(a).some((v) => v.trim())),
      stations: refs.stations.filter((s) => Object.values(s).some((v) => v.trim())),
      support: refs.support.filter((s) => Object.values(s).some((v) => v.trim())),
    };
    const res = await saveRefSet({ id: asNew ? undefined : editId || undefined, name, ...clean }).catch(() => ({
      error: tErrors.server,
      id: undefined,
    }));
    setSaving(false);
    if (res.error || !res.id) return setError(res.error ?? tErrors.server);
    const saved: TacticalRefSet = { id: res.id, name: name.trim().slice(0, 80), ...clean };
    // L'ancienne liste unique (« legacy ») est remplacée par la liste enregistrée.
    const rest = sets.filter((s) => s.id !== res.id && s.id !== "legacy");
    onChange({ sets: sortSets([...rest, saved]), activeId: res.id }, true);
  }

  async function remove() {
    const set = sets.find((s) => s.id === editId);
    if (!set || !window.confirm(fmt(t.refsDeleteConfirm, { name: set.name }))) return;
    const res = await deleteRefSet(set.id).catch(() => ({ error: tErrors.server }));
    if (res.error) return setError(res.error);
    const left = sets.filter((s) => s.id !== set.id);
    setSets(left);
    setDirty(false);
    const next = left[0];
    setEditId(next?.id ?? NEW);
    setName(next?.name ?? "");
    setRefs(next ? structuredClone(next) : emptyRefs());
    onChange({ sets: left, activeId: next?.id ?? null }, false);
  }

  const setOptions = [
    ...sets.map((s) => ({ value: s.id, label: s.name })),
    ...(editId === NEW ? [{ value: NEW, label: t.refsUnsaved }] : []),
  ];

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
          <button type="button" className="btn-icon -mr-2" aria-label={t.close} onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Choix de la liste, nom, nouvelle / suppression */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-1.5 text-sm text-muted">
            {t.refsActive}
            <Select value={editId} options={setOptions} label={t.refsActive} onChange={open} />
          </div>
          <label className="flex min-w-[14rem] flex-[1.4] flex-col gap-1.5 text-sm text-muted">
            {t.refsName}
            <input
              className="input"
              value={name}
              maxLength={80}
              placeholder={t.refsNamePlaceholder}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={() => open(NEW)}>
            <Plus size={16} strokeWidth={1.75} />
            {t.refsNew}
          </button>
          {editId !== NEW && editId !== "legacy" && (
            <button type="button" className="btn-icon" aria-label={t.refsDelete} title={t.refsDelete} onClick={() => void remove()}>
              <Trash2 size={17} strokeWidth={1.75} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-subtle">{t.refsPresets} :</span>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="btn-ghost min-h-8 px-2 text-sm"
              onClick={() => {
                const filled = refs.airbases.length || refs.stations.length || refs.support.length;
                if (filled && !window.confirm(fmt(t.refsPresetReplace, { name: p.name }))) return;
                setRefs(structuredClone(p.refs));
                if (!name.trim()) setName(p.name);
                setDirty(true);
              }}
            >
              <BookOpen size={15} strokeWidth={1.75} />
              {p.name}
            </button>
          ))}
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
                onChange={(airbases) => edit((r) => ({ ...r, airbases }))}
              />
            </div>
          </div>
          <PasteBox
            hint={t.refsAirbasesPasteHint}
            onImport={(text) =>
              edit((r) => ({
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
            onChange={(stations) => edit((r) => ({ ...r, stations }))}
          />
          <PasteBox
            hint={t.refsStationsPasteHint}
            onImport={(text) =>
              edit((r) => ({
                ...r,
                stations: [...r.stations, ...parsePastedRows(text, STATION_KEYS)].slice(0, TACTICAL_LIMITS.refs),
              }))
            }
          />
        </Section>

        <Section title={t.refsSupport}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="min-w-[48rem]">
              <Rows
                columns={[
                  { key: "role", label: t.colRole, grow: 2, mono: true },
                  { key: "type", label: t.colAcType, grow: 3 },
                  { key: "callsign", label: "Callsign", grow: 3 },
                  { key: "uhf", label: "UHF", grow: 3, mono: true },
                  { key: "vhf", label: "VHF", grow: 2, mono: true },
                  { key: "tacan", label: "TCN", grow: 2, mono: true },
                  { key: "alt", label: t.colAlt, grow: 2, mono: true },
                  { key: "notes", label: t.colNotes, grow: 3 },
                ]}
                rows={refs.support}
                max={TACTICAL_LIMITS.refs}
                empty={emptySupport()}
                onChange={(support) => edit((r) => ({ ...r, support }))}
              />
            </div>
          </div>
          <PasteBox
            hint={t.refsSupportPasteHint}
            onImport={(text) =>
              edit((r) => ({
                ...r,
                support: [...r.support, ...parsePastedRows(text, SUPPORT_KEYS)].slice(0, TACTICAL_LIMITS.refs),
              }))
            }
          />
        </Section>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-overlay px-5 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          {editId !== NEW && (
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => void save(true)}>
              {t.refsSaveAs}
            </button>
          )}
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save(false)}>
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
