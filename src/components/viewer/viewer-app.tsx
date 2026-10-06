"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useViewerData } from "@/hooks/use-viewer-data";
import { clampPage } from "@/lib/viewer/fit";
import { pruneDocumentSources } from "@/lib/viewer/sources";
import { PageView } from "./page-view";
import { StatusBadge, type ViewerStatus } from "./status-badge";
import { ViewerHelp } from "./viewer-help";

/** Durée d'affichage du rappel « H : aide » au chargement. */
const HELP_HINT_MS = 6_000;

export interface ViewerOptions {
  showStatus: boolean;
  showCursor: boolean;
}

interface Selection {
  docId: string | null;
  page: number;
}

export function ViewerApp({ token, options }: { token: string; options: ViewerOptions }) {
  const { data, status: dataStatus } = useViewerData(token);
  const [selection, setSelection] = useState<Selection | null>(null);
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

  // Sélection effective : choix local, sinon dernier état persisté, sinon premier document.
  const current = useMemo(() => {
    const wanted = selection ?? data?.lastState ?? null;
    const doc = documents.find((d) => d.id === wanted?.docId) ?? documents[0];
    if (!doc) return null;
    const page = wanted && wanted.docId === doc.id ? wanted.page : 1;
    return { doc, page: clampPage(page, doc.pageCount) };
  }, [selection, data, documents]);

  // Navigation clavier : uniquement pour tester sur PC (aucune interaction requise dans le casque).
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      const index = documents.findIndex((d) => d.id === current.doc.id);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const delta = e.key === "ArrowRight" ? 1 : -1;
        setSelection({ docId: current.doc.id, page: clampPage(current.page + delta, current.doc.pageCount) });
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const next = documents[(index + delta + documents.length) % documents.length];
        setSelection({ docId: next.id, page: 1 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, documents]);

  const handleRenderError = useCallback((message: string | null) => setRenderError(message), []);

  const status: ViewerStatus =
    dataStatus === "ok"
      ? renderError
        ? "error"
        : "ok"
      : dataStatus === "loading"
        ? "connecting"
        : dataStatus === "stale"
          ? "degraded"
          : "error";
  const detail =
    dataStatus === "not_found"
      ? "URL invalide ou révoquée"
      : dataStatus === "error"
        ? "Serveur injoignable"
        : renderError;

  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      {current ? (
        <PageView doc={current.doc} page={current.page} onError={handleRenderError} />
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
