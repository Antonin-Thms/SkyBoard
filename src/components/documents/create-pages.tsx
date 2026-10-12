"use client";

import { ChevronDown, FileText, KeyRound, ListChecks, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Menu } from "@/components/ui/menu";
import {
  normalizeRamrodChar,
  parseChecklistItems,
  RAMROD_SIZE,
  ramrodDuplicates,
  renderChecklist,
  renderNotePage,
  renderRamrod,
  splitRamrodChars,
} from "@/lib/documents/generate";
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";

interface CreatePagesProps {
  busy: boolean;
  /** Envoie les pages créées comme des documents */
  onCreate: (items: { file: File; name: string }[]) => void;
}

/** Bouton « Créer » : page de notes vierge, checklist à cocher au doigt, table RAMROD. */
export function CreatePages({ busy, onCreate }: CreatePagesProps) {
  const t = useT().documents.create;
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [ramrodOpen, setRamrodOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function createNote() {
    setWorking(true);
    setError(null);
    try {
      const name = t.noteName;
      onCreate([{ file: await renderNotePage(name), name }]);
    } catch {
      setError(t.failed);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <Menu
        label={t.menuLabel}
        align="end"
        triggerClassName="btn-secondary"
        trigger={
          <>
            <Plus size={16} strokeWidth={1.75} />
            {t.button}
            <ChevronDown size={14} strokeWidth={1.75} className="text-subtle" />
          </>
        }
        items={[
          {
            label: t.notePage,
            icon: <FileText size={16} strokeWidth={1.75} />,
            disabled: busy || working,
            onSelect: () => void createNote(),
          },
          {
            label: t.checklist,
            icon: <ListChecks size={16} strokeWidth={1.75} />,
            disabled: busy || working,
            onSelect: () => setChecklistOpen(true),
          },
          {
            label: t.ramrod,
            icon: <KeyRound size={16} strokeWidth={1.75} />,
            disabled: busy || working,
            onSelect: () => setRamrodOpen(true),
          },
        ]}
      />
      {error && <p className="w-full text-sm text-danger">{error}</p>}
      {checklistOpen && (
        <ChecklistDialog
          onClose={() => setChecklistOpen(false)}
          onCreate={(items) => {
            onCreate(items);
            setChecklistOpen(false);
          }}
        />
      )}
      {ramrodOpen && (
        <RamrodDialog
          onClose={() => setRamrodOpen(false)}
          onCreate={(item) => {
            onCreate([item]);
            setRamrodOpen(false);
          }}
        />
      )}
    </>
  );
}

/** Fenêtre de création d'une checklist : un élément par ligne. */
function ChecklistDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (items: { file: File; name: string }[]) => void;
}) {
  const t = useT().documents.create;
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  async function create() {
    const items = parseChecklistItems(text);
    const name = title.trim().slice(0, 120) || t.defaultTitle;
    if (!items.length) {
      setError(t.noItems);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const files = await renderChecklist(name, items, t.continued);
      onCreate(files.map((file) => ({ file, name: file.name.replace(/\.png$/, "") })));
    } catch {
      setError(t.failed);
      setWorking(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="checklist-title"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-[4px] bg-overlay p-0 text-fg shadow-popover backdrop:bg-black/60"
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id="checklist-title" className="text-lg font-medium">
            {t.dialogTitle}
          </h2>
          <button type="button" className="btn-icon -mr-2" aria-label={t.close} onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          {t.titleLabel}
          <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          {t.itemsLabel}
          <textarea
            className="input min-h-48 font-mono text-[13px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p className="text-xs text-subtle">{t.hint}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="btn-primary" disabled={working}>
            {working ? t.creating : t.submit}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** Fenêtre de création d'une table RAMROD : un caractère sous chaque chiffre de 0 à 9. */
function RamrodDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (item: { file: File; name: string }) => void;
}) {
  const t = useT().documents.create;
  const dialog = useRef<HTMLDialogElement>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [title, setTitle] = useState("");
  const [chars, setChars] = useState<string[]>(() => Array(RAMROD_SIZE).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const duplicates = ramrodDuplicates(chars);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  const focus = (i: number) => {
    const el = inputs.current[Math.min(Math.max(i, 0), RAMROD_SIZE - 1)];
    el?.focus();
    el?.select();
  };

  /** Remplit à partir de la case `from` (saisie d'un caractère ou texte collé). */
  const fill = (from: number, values: string[]) => {
    setChars((prev) => {
      const next = [...prev];
      values.forEach((v, k) => {
        if (from + k < RAMROD_SIZE) next[from + k] = v;
      });
      return next;
    });
  };

  async function create() {
    const name = title.trim().slice(0, 120) || t.ramrodDefaultTitle;
    setWorking(true);
    setError(null);
    try {
      onCreate({ file: await renderRamrod(name, chars), name });
    } catch {
      setError(t.failed);
      setWorking(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="ramrod-title"
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-[4px] bg-overlay p-0 text-fg shadow-popover backdrop:bg-black/60"
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id="ramrod-title" className="text-lg font-medium">
            {t.ramrodDialogTitle}
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
            placeholder={t.ramrodDefaultTitle}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <fieldset className="space-y-1.5">
          <legend className="pb-1.5 text-sm text-muted">{t.ramrodCharsLabel}</legend>
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
        </fieldset>
        <p className="text-xs text-subtle">{t.ramrodHint}</p>
        {duplicates.length > 0 && (
          <p className="text-sm text-danger">{fmt(t.ramrodDuplicate, { chars: duplicates.join(", ") })}</p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="btn-primary" disabled={working}>
            {working ? t.creating : t.ramrodSubmit}
          </button>
        </div>
      </form>
    </dialog>
  );
}
