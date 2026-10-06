"use client";

import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { setActiveFolder } from "@/app/(app)/cockpits/actions";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useInkSession } from "@/hooks/use-ink-session";
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
import { InkEditor } from "./ink-editor";
import { PrepMode } from "./prep-mode";
import { SyncStatus } from "./sync-status";

/** Notification « documents modifiés » ignorée juste après notre propre changement. */
const OWN_CHANGE_WINDOW_MS = 3_000;

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
  // Sauf juste après notre propre changement de dossier, déjà rechargé par l'action.
  const ownChangeAt = useRef(0);
  const { state, status, direct, update, flush, stateRef, sendInk } = useRemoteSync(cockpit, () => {
    if (Date.now() - ownChangeAt.current > OWN_CHANGE_WINDOW_MS) router.refresh();
  });
  const [activeFolderId, setOptimisticFolder] = useOptimistic(cockpit.activeFolderId);
  const [folderPending, startFolderTransition] = useTransition();
  // Dossier actif : ses documents + les communs. Les gestes ne parcourent que ceux-là.
  const documents = useMemo(
    () => allDocuments.filter((d) => isVisibleInActiveFolder(d, activeFolderId)),
    [allDocuments, activeFolderId],
  );
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
      const visible = allDocuments.filter((d) => isVisibleInActiveFolder(d, folderId));
      if (state.docId && !visible.some((d) => d.id === state.docId)) {
        apply(visible[0] ? selectDocument(state, visible[0], pageMemory()) : { ...state, docId: null, page: 1 });
      }
      ownChangeAt.current = Date.now();
      await setActiveFolder(cockpit.id, folderId);
      ownChangeAt.current = Date.now();
    });

  const [editing, setEditing] = useState(false);
  // Annotations (crayon du mode vol).
  const ink = useInkSession(sendInk);
  const inkTarget = (s: ViewState) => {
    const doc = documents.find((d) => d.id === s.docId);
    return doc ? { docId: doc.id, page: s.page, rotation: doc.rotation } : null;
  };

  /** Sortie du mode vol : le crayon se désactive. */
  const exitFlight = () => {
    ink.end();
    const s = stateRef.current;
    if (s.pen) apply({ ...s, pen: false, cursor: null });
    onExitFlight();
  };

  /** Mode nuit : page atténuée dans le casque. */
  const toggleNight = () => {
    const s = stateRef.current;
    apply({ ...s, night: !s.night });
  };

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
          // Crayon actif : le curseur est toujours montré (on voit où l'on dessine).
          const show = cursorEnabled || next.pen === true;
          const cursor = show ? action.point : null;
          if (cursor !== next.cursor) {
            next = { ...next, cursor };
            changed = changed || show || action.point === null;
          }
          break;
        }
        case "pen":
          if (!action.on) ink.end();
          next = { ...next, pen: action.on, cursor: action.on ? next.cursor : cursorEnabled ? next.cursor : null };
          changed = immediate = true;
          break;
        case "ink": {
          if (action.phase === "start") {
            const target = inkTarget(next);
            if (target) ink.start(target, action.point);
          } else if (action.phase === "move") {
            ink.addPoint(action.point);
          } else if (action.phase === "end") {
            ink.end();
          } else {
            ink.cancel();
          }
          break;
        }
        case "undo": {
          const target = inkTarget(next);
          if (target) ink.undo(target.docId, target.page);
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
        onExit={exitFlight}
        pen={state.pen === true}
        status={status}
        cursorEnabled={cursorEnabled}
        onToggleCursor={() => setCursorPref(cursorEnabled ? null : "1")}
        night={state.night === true}
        onToggleNight={toggleNight}
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
        <SyncStatus status={status} direct={direct} />
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
                  {f.readOnly ? `⇄ ${f.name} (${f.squadronName ?? "escadrille"})` : `📁 ${f.name}`}
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
        night={state.night === true}
        onToggleNight={toggleNight}
        onAnnotate={() => setEditing(true)}
      />
      {editing && current && (
        <InkEditor
          key={`${current.id}:${state.page}`}
          doc={current}
          page={state.page}
          sendInk={sendInk}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
