"use client";

import { useRouter } from "next/navigation";
import { Check, Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { documentsUploaded } from "@/app/(app)/documents/actions";
import { ACCEPT_ATTRIBUTE } from "@/lib/documents/file-type";
import { isMizFileName } from "@/lib/documents/miz";
import { extractMizKneeboards, type ExtractedKneeboard } from "@/lib/documents/miz-extract";
import { uploadDocument } from "@/lib/documents/upload";
import { createClient } from "@/lib/supabase/client";
import { uuid } from "@/lib/uuid";
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";
import { CreatePages } from "./create-pages";
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
  /** Contexte affiché au-dessus du titre */
  eyebrow: ReactNode;
  /** Contenu de la page : dépôt de fichiers possible partout dessus */
  children: ReactNode;
}

export function DocumentUploader({
  userId,
  nextSortOrder,
  folderId,
  folderName,
  eyebrow,
  children,
}: DocumentUploaderProps) {
  const { documents: t, common: tc } = useT();
  const u = t.uploader;
  const dragDepth = useRef(0);
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
        await uploadDocument(supabase, userId, file, sortOrderRef.current++, name, folderId, t.upload);
        update(key, { status: "done" });
        uploaded++;
        router.refresh();
      } catch (err) {
        update(key, {
          status: "error",
          error: err instanceof Error ? err.message : u.unknownError,
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
      setMizStatus(fmt(u.readingMission, { name: miz.name }));
      try {
        setMission({ fileName: miz.name, entries: await extractMizKneeboards(miz, { tooLarge: t.upload.missionTooLarge, unreadable: t.upload.missionUnreadable }) });
        setMizStatus(null);
      } catch (err) {
        setMission(null);
        setMizStatus(err instanceof Error ? err.message : u.unreadableFile);
      }
    }
    if (documents.length) await uploadAll(documents.map((file) => ({ file })));
  }

  return (
    <div
      className="relative space-y-6"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        dragDepth.current++;
        setDragOver(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragOver(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <PageHeader
        eyebrow={eyebrow}
        title={t.title}
        actions={
          <>
            <CreatePages busy={busy} onCreate={(items) => void uploadAll(items)} />
            <button type="button" className="btn-primary" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload size={16} strokeWidth={1.75} />
              {busy ? u.uploading : u.addFiles}
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
          </>
        }
      />
      <p className="hidden text-[13px] text-subtle md:block">
        {u.dropHint} {u.destination} <span className="text-fg">{folderName ?? tc.folders.common}</span>
      </p>

      {mizStatus && <p className="text-sm text-muted">{mizStatus}</p>}
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
        <ul className="space-y-1 bg-raised px-4 py-3 text-sm">
          {entries.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3">
              <span className="truncate text-slate-300">{e.name}</span>
              <span
                className={`flex shrink-0 items-center gap-1.5 ${
                  e.status === "error" ? "text-danger" : e.status === "done" ? "text-success" : "text-subtle"
                }`}
              >
                {e.status === "done" && <Check size={14} strokeWidth={2} />}
                {e.status === "pending" && u.statusPending}
                {e.status === "uploading" && u.statusUploading}
                {e.status === "done" && u.statusDone}
                {e.status === "error" && e.error}
              </span>
            </li>
          ))}
        </ul>
      )}

      {children}

      {dragOver && (
        <div className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center border-2 border-dashed border-accent bg-accent-subtle/80 md:inset-6">
          <p className="flex items-center gap-3 text-lg font-medium text-accent">
            <Upload size={22} strokeWidth={1.75} />
            {fmt(u.dropTo, { folder: folderName ?? tc.folders.common })}
          </p>
        </div>
      )}
    </div>
  );
}
