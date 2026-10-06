"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useViewerData } from "@/hooks/use-viewer-data";
import { createAnonClient } from "@/lib/supabase/anon";
import { connectCockpit, type LinkStatus } from "@/lib/sync/cockpit-link";
import { clampView, IDENTITY_VIEW } from "@/lib/gestures/transform";
import { clampPage } from "@/lib/viewer/fit";
import { prefetchDocuments } from "@/lib/viewer/doc-cache";
import { pruneDocumentSources } from "@/lib/viewer/sources";
import { viewReducer } from "@/lib/viewer/view-reducer";
import { PageView } from "./page-view";
import { StatusBadge, type ViewerStatus } from "./status-badge";
import { ViewerHelp } from "./viewer-help";

/** Durée d'affichage du rappel « H : aide » au chargement. */
const HELP_HINT_MS = 6_000;

export interface ViewerOptions {
  showStatus: boolean;
  showCursor: boolean;
}

export function ViewerApp({ token, options }: { token: string; options: ViewerOptions }) {
  const { data, status: dataStatus } = useViewerData(token);
  const [view, dispatch] = useReducer(viewReducer, null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("connecting");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), HELP_HINT_MS);
    return () => clearTimeout(t);
  }, []);

  // Aide : H ou ? pour basculer, Échap pour fermer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H" || e.key === "?") {
        setHelpOpen((open) => !open);
        setHintVisible(false);
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const documents = useMemo(() => data?.documents ?? [], [data]);

  // Libère les documents supprimés entre deux rechargements.
  useEffect(() => {
    if (data) pruneDocumentSources(new Set(documents.map((d) => d.id)));
  }, [data, documents]);

  // Précharge tous les documents dans le cache, après l'affichage du courant.
  useEffect(() => {
    if (documents.length === 0) return;
    const signal = { cancelled: false };
    const timer = setTimeout(() => void prefetchDocuments(documents, signal), 3_000);
    return () => {
      signal.cancelled = true;
      clearTimeout(timer);
    };
  }, [documents]);

  // Dernier état persisté : point de départ si aucune remote ne répond.
  const lastState = data?.lastState;
  useEffect(() => {
    if (lastState) dispatch({ type: "remote", state: lastState });
  }, [lastState]);

  // Canal Realtime : états de la remote ; à chaque (re)connexion, on demande l'état courant.
  const channel = data?.channel;
  useEffect(() => {
    if (!channel) return;
    const link = connectCockpit(createAnonClient(), channel, {
      onState: (state) => dispatch({ type: "remote", state }),
      onConnected: () => link.requestState(),
      onStatus: setLinkStatus,
    });
    return () => link.close();
  }, [channel]);

  // Affichage effectif : état reçu, sinon premier document.
  const current = useMemo(() => {
    const wanted = view;
    const doc = documents.find((d) => d.id === wanted?.docId) ?? documents[0];
    if (!doc) return null;
    const page = wanted && wanted.docId === doc.id ? wanted.page : 1;
    // Zoom / déplacement / curseur viennent du réseau : toujours bornés.
    const sameDoc = !!wanted && wanted.docId === doc.id;
    const transform = sameDoc ? clampView(wanted) : IDENTITY_VIEW;
    const cursor =
      sameDoc && options.showCursor && wanted.cursor
        ? {
            x: Math.min(1, Math.max(0, wanted.cursor.x)),
            y: Math.min(1, Math.max(0, wanted.cursor.y)),
          }
        : null;
    return { doc, page: clampPage(page, doc.pageCount), transform, cursor };
  }, [view, documents, options.showCursor]);

  // Navigation clavier : uniquement pour tester sur PC (aucune interaction requise dans le casque).
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const index = documents.findIndex((d) => d.id === current.doc.id);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const delta = e.key === "ArrowRight" ? 1 : -1;
        dispatch({
          type: "local",
          docId: current.doc.id,
          page: clampPage(current.page + delta, current.doc.pageCount),
        });
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const next = documents[(index + delta + documents.length) % documents.length];
        dispatch({ type: "local", docId: next.id, page: 1 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, documents]);

  const handleRenderError = useCallback((message: string | null) => setRenderError(message), []);

  let status: ViewerStatus;
  let detail: string | null = null;
  if (dataStatus === "not_found") {
    status = "error";
    detail = "URL invalide ou révoquée";
  } else if (dataStatus === "error") {
    status = "error";
    detail = "Serveur injoignable";
  } else if (dataStatus === "loading" || linkStatus === "connecting") {
    status = "connecting";
  } else if (linkStatus === "disconnected" || dataStatus === "stale") {
    status = "degraded";
  } else if (renderError) {
    status = "error";
    detail = renderError;
  } else {
    status = "ok";
  }

  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      {current ? (
        <PageView
          doc={current.doc}
          page={current.page}
          view={current.transform}
          cursor={current.cursor}
          onError={handleRenderError}
        />
      ) : (
        data && (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            Aucun document
          </div>
        )
      )}
      {options.showStatus && <StatusBadge status={status} detail={detail} />}
      {options.showStatus && hintVisible && !helpOpen && (
        <div className="pointer-events-none fixed bottom-2 left-2 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white/70">
          H : aide
        </div>
      )}
      {helpOpen && (
        <ViewerHelp
          cockpitName={data?.cockpit.name ?? null}
          docName={current?.doc.name ?? null}
          page={current?.page ?? 1}
          pageCount={current?.doc.pageCount ?? 1}
          docIndex={current ? documents.findIndex((d) => d.id === current.doc.id) : 0}
          docCount={documents.length}
        />
      )}
    </div>
  );
}
