"use client";

import { Plus, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { normalizeRamrodChar, RAMROD_SIZE, ramrodDuplicates, splitRamrodChars } from "@/lib/documents/generate";
import { TACTICAL_LIMITS } from "@/lib/documents/tactical";
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";

/** Champs partagés par la fiche tactique et ses listes. */

/** Champ texte compact d'une grille de saisie. */
export function Field({
  label,
  value,
  onChange,
  mono = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  className?: string;
}) {
  return (
    <input
      className={`input min-w-0 px-2 text-sm ${mono ? "font-mono" : ""} ${className}`}
      aria-label={label}
      value={value}
      maxLength={TACTICAL_LIMITS.field}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2 border-t border-line pt-4">
      <legend className="label-caps float-left mb-2 w-full">{title}</legend>
      <div className="clear-both space-y-2">{children}</div>
    </fieldset>
  );
}

/** Lignes d'un tableau à remplir (nom, valeurs) : ajout / retrait de lignes. */
export function Rows<K extends string>({
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
export function RamrodInputs({ chars, onChange }: { chars: string[]; onChange: (chars: string[]) => void }) {
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
