"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ACCEPT_ATTRIBUTE } from "@/lib/documents/file-type";
import { uploadDocument } from "@/lib/documents/upload";
import { createClient } from "@/lib/supabase/client";
import { uuid } from "@/lib/uuid";

interface UploadEntry {
  key: string;
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface DocumentUploaderProps {
  userId: string;
  nextSortOrder: number;
}

export function DocumentUploader({ userId, nextSortOrder }: DocumentUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const sortOrderRef = useRef(nextSortOrder);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const busy = entries.some((e) => e.status === "pending" || e.status === "uploading");

  const update = (key: string, patch: Partial<UploadEntry>) =>
    setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    const batch = files.map((f) => ({
      key: uuid(),
      name: f.name,
      status: "pending" as const,
    }));
    setEntries((list) => [...list.filter((e) => e.status !== "done"), ...batch]);

    const supabase = createClient();
    sortOrderRef.current = Math.max(sortOrderRef.current, nextSortOrder);

    // Séquentiel : évite de saturer la mémoire (rendu pdf.js) et la connexion.
    for (const [i, file] of files.entries()) {
      const { key } = batch[i];
      update(key, { status: "uploading" });
      try {
        await uploadDocument(supabase, userId, file, sortOrderRef.current++);
        update(key, { status: "done" });
        router.refresh();
      } catch (err) {
        update(key, {
          status: "error",
          error: err instanceof Error ? err.message : "Erreur inconnue.",
        });
      }
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragOver ? "border-sky-500 bg-sky-500/10" : "border-slate-700"
        }`}
      >
        <p className="text-sm text-slate-400">Glisse tes fichiers ici, ou</p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Envoi en cours…" : "Choisir des fichiers"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {entries.length > 0 && (
        <ul className="space-y-1 text-sm">
          {entries.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3">
              <span className="truncate text-slate-300">{e.name}</span>
              <span
                className={
                  e.status === "error"
                    ? "text-red-400"
                    : e.status === "done"
                      ? "text-emerald-400"
                      : "text-slate-500"
                }
              >
                {e.status === "pending" && "En attente"}
                {e.status === "uploading" && "Envoi…"}
                {e.status === "done" && "OK"}
                {e.status === "error" && e.error}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
