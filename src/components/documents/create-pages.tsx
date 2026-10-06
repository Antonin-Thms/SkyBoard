"use client";

import { useState } from "react";
import { parseChecklistItems, renderChecklist, renderNotePage } from "@/lib/documents/generate";

interface CreatePagesProps {
  busy: boolean;
  /** Envoie les pages créées comme des documents */
  onCreate: (items: { file: File; name: string }[]) => void;
}

/** Créer des pages sans fichier : page de notes à annoter, checklists à cocher au doigt. */
export function CreatePages({ busy, onCreate }: CreatePagesProps) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const disabled = busy || working;

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

  async function createChecklist() {
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
      setChecklistOpen(false);
      setTitle("");
      setText("");
    } catch {
      setError("Création impossible.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="label-caps">Créer</span>
        <button
          type="button"
          className="btn-text pointer-coarse:min-h-11"
          disabled={disabled}
          onClick={() => void createNote()}
        >
          + Page de notes
        </button>
        <button
          type="button"
          className="btn-text pointer-coarse:min-h-11"
          disabled={disabled}
          aria-expanded={checklistOpen}
          onClick={() => setChecklistOpen((o) => !o)}
        >
          + Checklist
        </button>
      </div>

      {checklistOpen && (
        <form
          className="space-y-2 border border-slate-800 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void createChecklist();
          }}
        >
          <input
            className="input"
            placeholder="Titre (ex. Démarrage F-16)"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="input min-h-40 font-mono"
            placeholder={"Un élément par ligne\nBatterie — ON\nAPU — START\n…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            Chaque élément a sa case ; coche-la au doigt avec le crayon (remote).
          </p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={disabled}>
              {working ? "Création…" : "Créer la checklist"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setChecklistOpen(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
