"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useViewerData } from "@/hooks/use-viewer-data";
import { createAnonClient } from "@/lib/supabase/anon";
import { connectCockpit, type LinkStatus } from "@/lib/sync/cockpit-link";
import { clampView, IDENTITY_VIEW } from "@/lib/gestures/transform";
import type { PageRef } from "@/lib/viewer/base-cache";
import { clampPage } from "@/lib/viewer/fit";
import { prefetchDocuments } from "@/lib/viewer/doc-cache";
import { pruneDocumentSources } from "@/lib/viewer/sources";
import { pageKey } from "@/lib/annotations/model";
import { applyInk, EMPTY_INK, pruneLive, strokesForPage, type InkState } from "@/lib/annotations/store";
import { parseViewState, type ViewState } from "@/lib/sync/protocol";
import { DirectLink } from "@/lib/sync/direct-link";
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

interface ViewerAppProps {
  token: string;
  /** Nom du canal Realtime (calculé côté serveur) */
  channel: string;
  options: ViewerOptions;
}

export function ViewerApp({ token, channel, options }: ViewerAppProps) {
  const { data, status: dataStatus, reload } = useViewerData(token);
  const [view, dispatch] = useReducer(viewReducer, null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("connecting");
  const [direct, setDirect] = useState(false);
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

  // Annotations : base reçue avec la liste, puis mises à jour en direct.
  const [ink, setInk] = useState<InkState>(EMPTY_INK);
  const annotations = data?.annotations;
  const [inkSource, setInkSource] = useState(annotations);
  if (annotations !== inkSource) {
    // Liste rechargée : les traits terminés viennent de la base, les traits en cours restent.
    setInkSource(annotations);
    if (annotations) setInk((prev) => ({ pages: annotations, live: prev.live }));
  }
  useEffect(() => {
    const t = setInterval(() => setInk((prev) => pruneLive(prev, Date.now())), 5_000);
    return () => clearInterval(t);
  }, []);

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
  // Les états reçus sont appliqués au plus une fois par image : après une
  // rafale (réseau qui se débloque), seul le plus récent compte.
  useEffect(() => {
    let latest: ViewState | null = null;
    let connectedOnce = false;
    let frame: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      clearTimeout(timer);
      frame = timer = undefined;
      if (latest) dispatch({ type: "remote", state: latest });
      latest = null;
    };
    const onState = (state: ViewState) => {
      if (!latest || state.seq > latest.seq) latest = state;
      if (frame === undefined) {
        frame = requestAnimationFrame(flush);
        // Secours si requestAnimationFrame est suspendu (onglet masqué).
        timer = setTimeout(flush, 50);
      }
    };
    // Liaison directe avec la remote (réseau local) : mêmes états, en quelques ms.
    const directLink = new DirectLink({
      role: "viewer",
      signal: (message) => link.sendRtc(message),
      onMessage: (data) => {
        const message = data as { t?: unknown; s?: unknown };
        const state = message?.t === "state" ? parseViewState(message.s) : null;
        if (state) onState(state);
      },
      onActiveChange: setDirect,
    });
    const link = connectCockpit(createAnonClient(), channel, {
      onState,
      onRtc: (signal) => void directLink.handle(signal),
      onInk: (message) => setInk((prev) => applyInk(prev, message, Date.now())),
      onConnected: () => {
        link.requestState();
        directLink.announce();
        // Reconnexion : des annotations ont pu être faites entre-temps.
        if (connectedOnce) reload();
        connectedOnce = true;
      },
      onStatus: setLinkStatus,
      onDocumentsChanged: reload,
    });
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      clearTimeout(timer);
      directLink.close();
      link.close();
    };
  }, [channel, reload]);

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
    // Rotation : propriété du document (réglée sur la page Documents).
    return { doc, page: clampPage(page, doc.pageCount), rotation: doc.rotation, transform, cursor };
  }, [view, documents, options.showCursor]);

  const currentKey = current ? pageKey(current.doc.id, current.page) : null;
  const pageStrokes = useMemo(
    () => (currentKey ? strokesForPage(ink, currentKey) : []),
    [ink, currentKey],
  );

  // Voisins probables : documents précédent / suivant et pages adjacentes.
  // Seuls le document et la page comptent (pas le zoom ni le curseur).
  const currentDoc = current?.doc ?? null;
  const currentPage = current?.page ?? 1;
  const neighbors = useMemo(() => {
    if (!currentDoc) return [];
    const refs: PageRef[] = [];
    const index = documents.findIndex((d) => d.id === currentDoc.id);
    if (documents.length > 1) {
      // Swipes enchaînés : on prépare aussi les documents à deux crans.
      for (const delta of [1, -1, 2, -2]) {
        const doc = documents[(((index + delta) % documents.length) + documents.length) % documents.length];
        if (doc.id !== currentDoc.id && !refs.some((r) => r.doc.id === doc.id)) {
          refs.push({ doc, page: 1, rotation: doc.rotation });
        }
      }
    }
    for (const delta of [1, -1]) {
      const page = currentPage + delta;
      if (page >= 1 && page <= currentDoc.pageCount) {
        refs.push({ doc: currentDoc, page, rotation: currentDoc.rotation });
      }
    }
    return refs;
  }, [currentDoc, currentPage, documents]);

  // Navigation clavier : uniquement pour tester sur PC (aucune interaction requise dans le casque).
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const index = documents.findIndex((d) => d.id === current.doc.id);
      // Même logique que la remote : ← → documents, ↑ ↓ pages.
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const delta = e.key === "ArrowDown" ? 1 : -1;
        dispatch({
          type: "local",
          docId: current.doc.id,
          page: clampPage(current.page + delta, current.doc.pageCount),
        });
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const delta = e.key === "ArrowRight" ? 1 : -1;
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
          rotation={current.rotation}
          view={current.transform}
          cursor={current.cursor}
          dim={view?.night === true}
          strokes={pageStrokes}
          onError={handleRenderError}
          neighbors={neighbors}
        />
      ) : (
        data && (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            Aucun document
          </div>
        )
      )}
      {view?.pen && (
        // Crayon actif sur la remote : le doigt dessine.
        <div
          className="pointer-events-none fixed left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-base text-white/90"
          aria-label="Crayon actif"
        >
          ✎
        </div>
      )}
      {options.showStatus && <StatusBadge status={status} detail={detail} direct={direct} />}
      {options.showStatus && hintVisible && !helpOpen && (
        <div className="pointer-events-none fixed bottom-2 left-2 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white/70">
          H : aide
        </div>
      )}
      {helpOpen && (
        <ViewerHelp
          cockpitName={
            data
              ? `${data.cockpit.name}${data.folder ? ` · 📁 ${data.folder.name}` : ""}`
              : null
          }
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
