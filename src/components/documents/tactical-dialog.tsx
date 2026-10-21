"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  normalizeRamrodChar,
  RAMROD_SIZE,
  ramrodDuplicates,
  renderTactical,
  splitRamrodChars,
} from "@/lib/documents/generate";
import { cleanTactical, emptyTactical, TACTICAL_LIMITS, type TacticalData } from "@/lib/documents/generated";
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";
import { uuid } from "@/lib/uuid";
import type { CreatedPage } from "./create-pages";

/**
 * Fiche tactique : RAMROD, navigation (porte-avions, terrains), fréquences,
 * codes laser et notes. Chaque section est facultative.
 */
export function TacticalDialog({
  initial,
  onClose,
  onCreate,
}: {
  /** Modification : contenu actuel */
  initial?: { title: string; data: TacticalData };
  onClose: () => void;
  onCreate: (items: CreatedPage[]) => void | Promise<void>;
}) {
  const t = useT().documents.create;
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [data, setData] = useState<TacticalData>(() => initial?.data ?? emptyTactical());
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  const set = <K extends keyof TacticalData>(key: K, value: TacticalData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  async function create() {
    const name = title.trim().slice(0, 120) || t.tacticalDefaultTitle;
    const clean = cleanTactical(data);
    if (!clean.ramrod.some(Boolean) && !clean.navaids.length && !clean.freqs.length && !clean.codes.length && !clean.notes) {
      setError(t.tacticalEmpty);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const files = await renderTactical(name, clean, {
        continued: t.continued,
        ramrod: "RAMROD",
        navaids: t.sectionNavaids,
        navaidColumns: [t.colName, t.colTacan, t.colIls, t.colFreq],
        freqs: t.sectionFreqs,
        freqColumns: [t.colName, t.colFreq],
        codes: t.sectionCodes,
        codeColumns: [t.colWeapon, t.colCode],
        notes: t.sectionNotes,
      });
      const group = uuid();
      await onCreate(
        files.map((file, i) => ({
          file,
          name: file.name.replace(/\.png$/, ""),
          source: { kind: "tactical", title: name, group, part: i + 1, ...clean },
        })),
      );
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
      aria-labelledby="tactical-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100vw-2rem))] rounded-[4px] bg-overlay p-0 text-fg shadow-popover backdrop:bg-black/60"
    >
      <form
        className="space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id="tactical-title" className="text-lg font-medium">
            {initial ? t.editTacticalTitle : t.tacticalDialogTitle}
          </h2>
          <button type="button" className="btn-icon -mr-2" aria-label={t.close} onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          {t.titleLabel}
          <input
            className="input"
            value={title}
            maxLength={120}
            placeholder={t.tacticalDefaultTitle}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <Section title={t.sectionRamrod}>
          <RamrodInputs chars={data.ramrod} onChange={(ramrod) => set("ramrod", ramrod)} />
          <p className="text-xs text-subtle">{t.ramrodHint}</p>
        </Section>

        <Section title={t.sectionNavaids}>
          <Rows
            columns={[
              { key: "name", label: t.colName, grow: 3 },
              { key: "tacan", label: t.colTacan, grow: 2 },
              { key: "ils", label: t.colIls, grow: 2 },
              { key: "freq", label: t.colFreq, grow: 2 },
            ]}
            rows={data.navaids}
            max={TACTICAL_LIMITS.navaids}
            empty={{ name: "", tacan: "", ils: "", freq: "" }}
            onChange={(rows) => set("navaids", rows)}
          />
        </Section>

        <Section title={t.sectionFreqs}>
          <Rows
            columns={[
              { key: "name", label: t.colName, grow: 3 },
              { key: "freq", label: t.colFreq, grow: 2 },
            ]}
            rows={data.freqs}
            max={TACTICAL_LIMITS.freqs}
            empty={{ name: "", freq: "" }}
            onChange={(rows) => set("freqs", rows)}
          />
        </Section>

        <Section title={t.sectionCodes}>
          <Rows
            columns={[
              { key: "name", label: t.colWeapon, grow: 3 },
              { key: "code", label: t.colCode, grow: 2, mono: true },
            ]}
            rows={data.codes}
            max={TACTICAL_LIMITS.codes}
            empty={{ name: "", code: "" }}
            onChange={(rows) => set("codes", rows)}
          />
        </Section>

        <Section title={t.sectionNotes}>
          <textarea
            className="input min-h-24 text-sm"
            aria-label={t.sectionNotes}
            value={data.notes}
            maxLength={TACTICAL_LIMITS.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Section>

        <p className="text-xs text-subtle">{t.tacticalHint}</p>
        {initial && <p className="text-xs text-muted">{t.editWarning}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 bg-overlay px-5 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="btn-primary" disabled={working}>
            {initial ? (working ? t.editSaving : t.editSubmit) : working ? t.creating : t.tacticalSubmit}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2 border-t border-line pt-4">
      <legend className="label-caps float-left mb-2 w-full">{title}</legend>
      <div className="clear-both space-y-2">{children}</div>
    </fieldset>
  );
}

/** Lignes d'un tableau à remplir (nom, valeurs) : ajout / retrait de lignes. */
function Rows<K extends string>({
  columns,
  rows,
  max,
  empty,
  onChange,
}: {
  columns: { key: K; label: string; grow: number; mono?: boolean }[];
  rows: Record<K, string>[];
  max: number;
  empty: Record<K, string>;
  onChange: (rows: Record<K, string>[]) => void;
}) {
  const t = useT().documents.create;
  const template = `${columns.map((c) => `minmax(0,${c.grow}fr)`).join(" ")} 2.25rem`;
  return (
    <div className="space-y-1.5">
      {rows.length > 0 && (
        <div className="grid gap-1.5 text-xs text-subtle" style={{ gridTemplateColumns: template }}>
          {columns.map((c) => (
            <span key={c.key} className="truncate">
              {c.label}
            </span>
          ))}
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className="grid items-center gap-1.5" style={{ gridTemplateColumns: template }}>
          {columns.map((c) => (
            <input
              key={c.key}
              className={`input min-w-0 px-2 ${c.mono ? "font-mono" : ""}`}
              aria-label={`${c.label} ${i + 1}`}
              value={row[c.key]}
              maxLength={TACTICAL_LIMITS.field}
              autoComplete="off"
              onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [c.key]: e.target.value } : r)))}
            />
          ))}
          <button
            type="button"
            className="btn-icon size-9"
            aria-label={`${t.removeRow} ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      ))}
      {rows.length < max && (
        <button type="button" className="btn-ghost -ml-2 min-h-9 px-2 text-sm" onClick={() => onChange([...rows, { ...empty }])}>
          <Plus size={15} strokeWidth={1.75} />
          {t.addRow}
        </button>
      )}
    </div>
  );
}

/** 10 cases sous les chiffres 0 à 9 : saisie case par case ou mot collé. */
function RamrodInputs({ chars, onChange }: { chars: string[]; onChange: (chars: string[]) => void }) {
  const t = useT().documents.create;
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const duplicates = ramrodDuplicates(chars);

  const focus = (i: number) => {
    const el = inputs.current[Math.min(Math.max(i, 0), RAMROD_SIZE - 1)];
    el?.focus();
    el?.select();
  };

  /** Remplit à partir de la case `from` (saisie d'un caractère ou texte collé). */
  const fill = (from: number, values: string[]) => {
    const next = [...chars];
    values.forEach((v, k) => {
      if (from + k >= 0 && from + k < RAMROD_SIZE) next[from + k] = v;
    });
    onChange(next);
  };

  return (
    <>
      <div className="grid grid-cols-10 overflow-hidden rounded-[2px] border border-line-strong">
        {chars.map((ch, i) => (
          <label key={i} className="flex flex-col border-line-strong [&:not(:first-child)]:border-l">
            <span className="numeric bg-sunken py-1 text-center text-sm text-muted">{i}</span>
            <input
              ref={(el) => {
                inputs.current[i] = el;
              }}
              aria-label={fmt(t.ramrodCharLabel, { n: i })}
              value={ch}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`h-12 w-full min-w-0 border-t border-line-strong bg-raised text-center font-mono text-xl uppercase outline-none focus:bg-accent-subtle ${
                ch && duplicates.includes(ch) ? "text-danger" : "text-fg"
              }`}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const value = normalizeRamrodChar(e.target.value);
                fill(i, [value]);
                if (value) focus(i + 1);
              }}
              onPaste={(e) => {
                const values = splitRamrodChars(e.clipboardData.getData("text"));
                if (values.length < 2) return;
                e.preventDefault();
                fill(i, values);
                focus(i + values.length);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !ch) {
                  e.preventDefault();
                  fill(i - 1, [""]);
                  focus(i - 1);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  focus(i - 1);
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  focus(i + 1);
                }
              }}
            />
          </label>
        ))}
      </div>
      {duplicates.length > 0 && (
        <p className="text-sm text-danger">{fmt(t.ramrodDuplicate, { chars: duplicates.join(", ") })}</p>
      )}
    </>
  );
}
