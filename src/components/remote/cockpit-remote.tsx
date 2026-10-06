"use client";

import { useRemoteSync } from "@/hooks/use-remote-sync";
import { readPageMemory, rememberPage } from "@/lib/remote/page-memory";
import type { RemoteCockpit, RemoteDocument } from "@/lib/remote/types";
import type { ViewState } from "@/lib/sync/protocol";
import { selectDocument, stepDocument, stepPage } from "@/lib/sync/state";
import { PrepMode } from "./prep-mode";
import { SyncStatus } from "./sync-status";

interface CockpitRemoteProps {
  cockpit: RemoteCockpit;
  documents: RemoteDocument[];
  mode: "prep" | "flight";
}

/** Pilotage d'un cockpit : commandes de haut niveau au-dessus de la synchro. */
export function CockpitRemote({ cockpit, documents, mode }: CockpitRemoteProps) {
  const { state, status, update } = useRemoteSync(cockpit);
  const current = documents.find((d) => d.id === state.docId) ?? null;

  const apply = (next: ViewState | null) => {
    if (!next) return;
    update(next);
    if (next.docId) rememberPage(cockpit.id, next.docId, next.page);
  };

  const commands = {
    selectDocument: (doc: RemoteDocument) =>
      apply(selectDocument(state, doc, readPageMemory(cockpit.id))),
    stepPage: (delta: number) => {
      if (current) apply(stepPage(state, current, delta));
      // Aucun document affiché : on commence par le premier.
      else apply(stepDocument(state, documents, 1, readPageMemory(cockpit.id)));
    },
    stepDocument: (delta: number) =>
      apply(stepDocument(state, documents, delta, readPageMemory(cockpit.id))),
  };

  return (
    <div className="space-y-4">
      <SyncStatus status={status} />
      {mode === "prep" ? (
        <PrepMode
          documents={documents}
          current={current}
          page={state.page}
          onSelect={commands.selectDocument}
          onStepPage={commands.stepPage}
          onStepDocument={commands.stepDocument}
        />
      ) : (
        <p className="rounded-2xl border border-slate-800 p-8 text-center text-slate-400">
          Le mode vol (gestes à l&apos;aveugle) arrive en phase 5.
        </p>
      )}
    </div>
  );
}
