"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { documentsUploaded } from "@/app/(app)/documents/actions";
import { ACCEPT_ATTRIBUTE } from "@/lib/documents/file-type";
import { isMizFileName } from "@/lib/documents/miz";
import { extractMizKneeboards, type ExtractedKneeboard } from "@/lib/documents/miz-extract";
import { uploadDocument } from "@/lib/documents/upload";
import { createClient } from "@/lib/supabase/client";
import { uuid } from "@/lib/uuid";
import { MizImport } from "./miz-import";

interface UploadEntry {
  key: string;
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface DocumentUploaderProps {
  userId: string;
  nextSortOrder: number;
  /** Dossier de destination des envois (null : Communs) */
  folderId: string | null;
  folderName: string | null;
}

export function DocumentUploader({ userId, nextSortOrder, folderId, folderName }: DocumentUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const sortOrderRef = useRef(nextSortOrder);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [mission, setMission] = useState<{ fileName: string; entries: ExtractedKneeboard[] } | null>(null);
  const [mizStatus, setMizStatus] = useState<string | null>(null);
  const busy = entries.some((e) => e.status === "pending" || e.status === "uploading");

  const update = (key: string, patch: Partial<UploadEntry>) =>
    setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  /** Envoie des fichiers un par un (nom optionnel), avec suivi par fichier. */
  async function uploadAll(items: { file: File; name?: string }[]) {
    const batch = items.map(({ file, name }) => ({
      key: uuid(),
      name: name ?? file.name,
      status: "pending" as const,
    }));
    setEntries((list) => [...list.filter((e) => e.status !== "done"), ...batch]);

    const supabase = createClient();
    sortOrderRef.current = Math.max(sortOrderRef.current, nextSortOrder);

    // Séquentiel : évite de saturer la mémoire (rendu pdf.js) et la connexion.
    let uploaded = 0;
    for (const [i, { file, name }] of items.entries()) {
      const { key } = batch[i];
      update(key, { status: "uploading" });
      try {
        await uploadDocument(supabase, userId, file, sortOrderRef.current++, name, folderId);
        update(key, { status: "done" });
        uploaded++;
        router.refresh();
      } catch (err) {
        update(key, {
          status: "error",
          error: err instanceof Error ? err.message : "Erreur inconnue.",
        });
      }
    }
    // Les viewers ouverts rechargent leur liste de documents.
    if (uploaded > 0) void documentsUploaded();
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    const missions = files.filter((f) => isMizFileName(f.name));
    const documents = files.filter((f) => !isMizFileName(f.name));

    // Fichier de mission DCS : on propose les images de kneeboard qu'il contient.
    const miz = missions[0];
    if (miz) {
      setMizStatus(`Lecture de « ${miz.name} »…`);
      try {
        setMission({ fileName: miz.name, entries: await extractMizKneeboards(miz) });
        setMizStatus(null);
      } catch (err) {
        setMission(null);
        setMizStatus(err instanceof Error ? err.message : "Fichier .miz illisible.");
      }
    }
    if (documents.length) await uploadAll(documents.map((file) => ({ file })));
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
        <p className="text-sm text-slate-400">
          Glisse tes fichiers ici (PDF, PNG, JPG ou mission DCS <span className="font-mono">.miz</span>), ou
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Envoi en cours…" : "Choisir des fichiers"}
        </button>
        <p className="text-xs text-slate-500">
          Destination : {folderName ? `📁 ${folderName}` : "Communs (sans dossier)"}
        </p>
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

      {mizStatus && <p className="text-sm text-slate-400">{mizStatus}</p>}
      {mission && (
        <MizImport
          key={mission.fileName}
          missionFileName={mission.fileName}
          entries={mission.entries}
          busy={busy}
          onCancel={() => setMission(null)}
          onImport={(items) => {
            setMission(null);
            void uploadAll(items);
          }}
        />
      )}

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
