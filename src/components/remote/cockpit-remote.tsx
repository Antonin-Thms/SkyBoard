"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { setActiveFolder } from "@/app/(app)/cockpits/actions";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useRemoteSync } from "@/hooks/use-remote-sync";
import type { DeviceKind } from "@/lib/device/kind";
import { isVisibleInActiveFolder, type FolderSummary } from "@/lib/documents/folders";
import type { GestureAction } from "@/lib/gestures/recognizer";
import { IDENTITY_VIEW } from "@/lib/gestures/transform";
import { readPageMemory, rememberPage } from "@/lib/remote/page-memory";
import type { RemoteCockpit, RemoteDocument } from "@/lib/remote/types";
import type { ViewState } from "@/lib/sync/protocol";
import { selectDocument, stepDocument, stepPage } from "@/lib/sync/state";
import { FlightMode } from "./flight-mode";
import { PrepMode } from "./prep-mode";
import { SyncStatus } from "./sync-status";

interface CockpitRemoteProps {
  cockpit: RemoteCockpit;
  documents: RemoteDocument[];
  folders: FolderSummary[];
  mode: "prep" | "flight";
  device: DeviceKind;
  onExitFlight: () => void;
}

/** Pilotage d'un cockpit : commandes de haut niveau au-dessus de la synchro. */
export function CockpitRemote({
  cockpit,
  documents: allDocuments,
  folders,
  mode,
  device,
  onExitFlight,
}: CockpitRemoteProps) {
  const router = useRouter();
  // Documents modifiés ailleurs (upload, autre remote, page Cockpits) : on recharge.
  const { state, status, update, flush, stateRef } = useRemoteSync(cockpit, () => router.refresh());
  const [activeFolderId, setOptimisticFolder] = useOptimistic(cockpit.activeFolderId);
  const [folderPending, startFolderTransition] = useTransition();
  // Dossier actif : ses documents + les communs. Les gestes ne parcourent que ceux-là.
  const documents = allDocuments.filter((d) => isVisibleInActiveFolder(d.folderId, activeFolderId));
  const [cursorPref, setCursorPref] = useLocalStorage("skyboard:cursor");
  const cursorEnabled = cursorPref === "1";
  const current = documents.find((d) => d.id === state.docId) ?? null;
  const pageMemory = () => readPageMemory(cockpit.id);

  const apply = (next: ViewState | null, immediate = true) => {
    if (!next) return;
    update(next, { immediate });
    if (next.docId) rememberPage(cockpit.id, next.docId, next.page);
  };

  const changeFolder = (folderId: string | null) =>
    startFolderTransition(async () => {
      setOptimisticFolder(folderId);
      // Le document affiché n'est plus dans le dossier : on passe au premier visible.
      const visible = allDocuments.filter((d) => isVisibleInActiveFolder(d.folderId, folderId));
      if (state.docId && !visible.some((d) => d.id === state.docId)) {
        apply(visible[0] ? selectDocument(state, visible[0], pageMemory()) : { ...state, docId: null, page: 1 });
      }
      await setActiveFolder(cockpit.id, folderId);
    });

  /** Première navigation sans document affiché : on démarre sur le premier. */
  const stepPageOrStart = (from: ViewState, delta: number) => {
    const doc = documents.find((d) => d.id === from.docId);
    return doc ? stepPage(from, doc, delta) : stepDocument(from, documents, 1, pageMemory());
  };

  /** Regroupe les actions d'un même événement tactile en un seul état. */
  const handleGestures = (actions: GestureAction[]) => {
    let next = stateRef.current;
    let changed = false;
    let immediate = false;
    let end = false;

    for (const action of actions) {
      switch (action.type) {
        case "view":
          next = { ...next, ...action.view };
          changed = true;
          break;
        case "cursor": {
          const cursor = cursorEnabled ? action.point : null;
          if (cursor !== next.cursor) {
            next = { ...next, cursor };
            changed = changed || cursorEnabled || action.point === null;
          }
          break;
        }
        case "page":
        case "document": {
          const stepped =
            action.type === "page"
              ? stepPageOrStart(next, action.delta)
              : stepDocument(next, documents, action.delta, pageMemory());
          if (stepped) {
            next = stepped;
            changed = immediate = true;
          }
          break;
        }
        case "reset":
          next = { ...next, ...IDENTITY_VIEW };
          changed = immediate = true;
          break;
        case "end":
          end = true;
          break;
      }
    }

    if (changed) apply(next, immediate);
    if (end) flush();
  };

  if (mode === "flight") {
    return (
      <FlightMode
        getView={() => stateRef.current}
        onActions={handleGestures}
        device={device}
        onExit={onExitFlight}
        status={status}
        cursorEnabled={cursorEnabled}
        onToggleCursor={() => setCursorPref(cursorEnabled ? null : "1")}
        info={{
          docName: current?.name ?? null,
          page: state.page,
          pageCount: current?.pageCount ?? 1,
          zoom: state.zoom,
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SyncStatus status={status} />
        {folders.length > 0 && (
          <label className={`flex items-center gap-2 text-sm ${folderPending ? "opacity-60" : ""}`}>
            <span className="text-slate-400">Dossier actif</span>
            <select
              className="input w-auto max-w-[60vw]"
              value={activeFolderId ?? ""}
              onChange={(e) => changeFolder(e.target.value || null)}
            >
              <option value="">Tous les documents</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <PrepMode
        documents={documents}
        current={current}
        page={state.page}
        zoomed={state.zoom > 1.01}
        compact={device === "phone"}
        onSelect={(doc) => apply(selectDocument(state, doc, pageMemory()))}
        onStepPage={(delta) => apply(stepPageOrStart(state, delta))}
        onStepDocument={(delta) => apply(stepDocument(state, documents, delta, pageMemory()))}
        onResetZoom={() => apply({ ...state, ...IDENTITY_VIEW })}
      />
    </div>
  );
}
