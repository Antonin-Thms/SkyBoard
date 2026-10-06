"use client";

import { ChevronDown, FileText, ListChecks, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Menu } from "@/components/ui/menu";
import { parseChecklistItems, renderChecklist, renderNotePage } from "@/lib/documents/generate";
import { useT } from "@/lib/i18n/client";

interface CreatePagesProps {
  busy: boolean;
  /** Envoie les pages créées comme des documents */
  onCreate: (items: { file: File; name: string }[]) => void;
}

/** Bouton « Créer » : page de notes vierge à annoter, ou checklist à cocher au doigt. */
export function CreatePages({ busy, onCreate }: CreatePagesProps) {
  const t = useT().documents.create;
  const [checklistOpen, setChecklistOpen] = useState(false);
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
