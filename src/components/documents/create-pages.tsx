"use client";

import { ChevronDown, FileText, ListChecks, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Menu } from "@/components/ui/menu";
import { parseChecklistItems, renderChecklist, renderNotePage } from "@/lib/documents/generate";

interface CreatePagesProps {
  busy: boolean;
  /** Envoie les pages créées comme des documents */
  onCreate: (items: { file: File; name: string }[]) => void;
}

/** Bouton « Créer » : page de notes vierge à annoter, ou checklist à cocher au doigt. */
export function CreatePages({ busy, onCreate }: CreatePagesProps) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function createNote() {
    setWorking(true);
    setError(null);
    try {
      const name = "Notes";
      onCreate([{ file: await renderNotePage(name), name }]);
    } catch {
      setError("Création impossible.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <Menu
        label="Créer une page"
        align="end"
        triggerClassName="btn-secondary"
        trigger={
          <>
            <Plus size={16} strokeWidth={1.75} />
            Créer
            <ChevronDown size={14} strokeWidth={1.75} className="text-subtle" />
          </>
        }
        items={[
          {
            label: "Page de notes",
            icon: <FileText size={16} strokeWidth={1.75} />,
            disabled: busy || working,
            onSelect: () => void createNote(),
          },
          {
            label: "Checklist",
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
    const name = title.trim().slice(0, 120) || "Checklist";
    if (!items.length) {
      setError("Ajoute au moins un élément (une ligne par élément).");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const files = await renderChecklist(name, items);
      onCreate(files.map((file) => ({ file, name: file.name.replace(/\.png$/, "") })));
    } catch {
      setError("Création impossible.");
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
            Nouvelle checklist
          </h2>
          <button type="button" className="btn-icon -mr-2" aria-label="Fermer" onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Titre
          <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Éléments, un par ligne
          <textarea
            className="input min-h-48 font-mono text-[13px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p className="text-xs text-subtle">Chaque élément a sa case ; coche-la au doigt avec le crayon (remote).</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={working}>
            {working ? "Création…" : "Créer la checklist"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
