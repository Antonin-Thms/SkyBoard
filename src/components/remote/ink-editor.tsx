"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDocumentFileUrl } from "@/app/(app)/remote/actions";
import { InkLayer } from "@/components/viewer/ink-layer";
import { useElementSize } from "@/hooks/use-element-size";
import { forgetSessionStrokes, INK_PREF_KEY, readInkPref, useInkSession } from "@/hooks/use-ink-session";
import { writeLocalStorage } from "@/hooks/use-local-storage";
import {
  INK_COLOR_NAMES,
  INK_COLORS,
  INK_WIDTHS,
  pageKey,
  parseStrokes,
  strokeHit,
  toDocumentPoint,
  type InkColor,
  type InkMessage,
  type Stroke,
} from "@/lib/annotations/model";
import { clearAnnotations, removeStrokes } from "@/lib/annotations/persist";
import type { RemoteDocument } from "@/lib/remote/types";
import { createClient } from "@/lib/supabase/client";
import { renderBase, type BaseRender } from "@/lib/viewer/base-cache";
import type { Size } from "@/lib/viewer/fit";
import { blit } from "@/lib/viewer/render";

interface InkEditorProps {
  doc: RemoteDocument;
  page: number;
  sendInk: (message: InkMessage) => void;
  onClose: () => void;
}

/** Tolérance de la gomme (repère normalisé de la page). */
const ERASER_TOLERANCE = 0.015;

/**
 * Éditeur d'annotations du mode préparation : la page est affichée sur la
 * tablette et l'on dessine en la regardant (doigt ou stylet). Chaque trait
 * apparaît en direct dans le casque et est enregistré.
 */
export function InkEditor({ doc, page, sendInk, onClose }: InkEditorProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const area = useElementSize(areaRef);
  const [display, setDisplay] = useState<Size | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [live, setLive] = useState<Stroke | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [ink, setInk] = useState(readInkPref);
  const session = useInkSession(sendInk);
  const drawing = useRef<number | null>(null);
  const target = { docId: doc.id, page, rotation: doc.rotation };

  // Annotations existantes de la page.
  useEffect(() => {
    let alive = true;
    void createClient()
      .from("annotations")
      .select("strokes")
      .eq("document_id", doc.id)
      .eq("page", page)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setStrokes(parseStrokes(data?.strokes));
      });
    return () => {
      alive = false;
    };
  }, [doc.id, page]);

  // Rendu de la page, ajusté à la zone disponible.
  useEffect(() => {
    if (!area || area.width === 0 || area.height === 0) return;
    let cancelled = false;
    (async () => {
      const res = await getDocumentFileUrl(doc.id);
      if (!res.url) throw new Error(res.error ?? "Fichier indisponible.");
      const ref = {
        doc: { id: doc.id, name: doc.name, type: doc.type, pageCount: doc.pageCount, rotation: doc.rotation, url: res.url },
        page,
        rotation: doc.rotation,
      };
      const render: BaseRender = await renderBase(ref, area, window.devicePixelRatio || 1);
      if (cancelled || !canvasRef.current) return;
      blit(render.canvas, canvasRef.current);
      setDisplay(render.display);
      setLoadError(null);
    })().catch((err: unknown) => {
      if (!cancelled) setLoadError(err instanceof Error ? err.message : "Affichage impossible.");
    });
    return () => {
      cancelled = true;
    };
  }, [area, doc.id, doc.name, doc.type, doc.pageCount, doc.rotation, page]);

  const choose = (patch: Partial<{ color: InkColor; width: number }>) => {
    const next = { ...ink, ...patch };
    setInk(next);
    setTool("pen");
    writeLocalStorage(INK_PREF_KEY, JSON.stringify(next));
  };

  /** Position du pointeur dans la page affichée (0..1). */
  const pointOf = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const eraseAt = useCallback(
    (point: { x: number; y: number }) => {
      const p = toDocumentPoint(point, doc.rotation);
      const hit = strokes.filter((s) => strokeHit(s, p, ERASER_TOLERANCE)).map((s) => s.id);
      if (!hit.length) return;
      setStrokes((list) => list.filter((s) => !hit.includes(s.id)));
      forgetSessionStrokes(pageKey(doc.id, page), hit);
      sendInk({ op: "erase", docId: doc.id, page, ids: hit });
      void removeStrokes(doc.id, page, hit);
    },
    [doc.id, doc.rotation, page, sendInk, strokes],
  );

  const refreshLive = () => {
    const s = session.liveStroke();
    setLive(s ? { ...s, points: [...s.points] } : null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawing.current !== null) return; // un seul doigt / stylet à la fois
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = e.pointerId;
    const point = pointOf(e);
    if (tool === "eraser") {
      eraseAt(point);
    } else {
      session.start(target, point, ink);
      refreshLive();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawing.current !== e.pointerId) return;
    // Événements coalescés : tracé plus fin avec un stylet.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const rect = e.currentTarget.getBoundingClientRect();
    for (const ev of events) {
      const point = { x: (ev.clientX - rect.left) / rect.width, y: (ev.clientY - rect.top) / rect.height };
      if (tool === "eraser") eraseAt(point);
      else session.addPoint(point);
    }
    if (tool === "pen") refreshLive();
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (drawing.current !== e.pointerId) return;
    drawing.current = null;
    if (tool !== "pen") return;
    const stroke = session.liveStroke();
    if (cancelled) {
      session.cancel();
    } else {
      session.end();
      if (stroke) setStrokes((list) => [...list.filter((s) => s.id !== stroke.id), stroke]);
    }
    setLive(null);
  };

  const undo = () => {
    const id = session.undo(doc.id, page);
    if (id) setStrokes((list) => list.filter((s) => s.id !== id));
  };

  const clearPage = () => {
    if (!strokes.length || !window.confirm("Effacer toutes les annotations de cette page ?")) return;
    setStrokes([]);
    forgetSessionStrokes(pageKey(doc.id, page), null);
    sendInk({ op: "clear", docId: doc.id, page });
    void clearAnnotations([doc.id], page);
  };

  // Fermeture : un trait en cours est terminé.
  const endSession = session.end;
  useEffect(() => () => endSession(), [endSession]);

  const shown = live ? [...strokes, live] : strokes;
  const toolBtn = (active: boolean) =>
    `h-11 min-w-11 px-3 text-sm ${active ? "bg-sky-500 text-slate-950" : "border border-slate-700 text-slate-200"}`;

  return (
    <div className="fixed inset-0 z-50 flex select-none flex-col bg-slate-950 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <button type="button" className="btn-secondary h-11" onClick={onClose}>
          ✕ Fermer
        </button>
        <span className="mr-auto min-w-0 truncate px-2 text-sm text-slate-400">
          {doc.name}
          {doc.pageCount > 1 && ` · page ${page}`}
        </span>
        <div className="flex items-center gap-1" role="group" aria-label="Couleur">
          {INK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={INK_COLOR_NAMES[c]}
              aria-pressed={tool === "pen" && ink.color === c}
              onClick={() => choose({ color: c })}
              className={`flex h-11 w-11 items-center justify-center ${
                tool === "pen" && ink.color === c ? "ring-2 ring-sky-500" : ""
              }`}
            >
              <span className="h-6 w-6 rounded-full border border-white/30" style={{ background: c }} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className={toolBtn(tool === "pen" && ink.width === INK_WIDTHS.fin)}
          onClick={() => choose({ width: INK_WIDTHS.fin })}
        >
          Fin
        </button>
        <button
          type="button"
          className={toolBtn(tool === "pen" && ink.width === INK_WIDTHS.epais)}
          onClick={() => choose({ width: INK_WIDTHS.epais })}
        >
          Épais
        </button>
        <button type="button" className={toolBtn(tool === "eraser")} onClick={() => setTool("eraser")}>
          Gomme
        </button>
        <button type="button" className={toolBtn(false)} onClick={undo}>
          ↶ Annuler
        </button>
        <button type="button" className={`${toolBtn(false)} text-red-300`} onClick={clearPage}>
          Effacer la page
        </button>
      </div>

      <div ref={areaRef} className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
        {loadError && <p className="text-sm text-red-400">{loadError}</p>}
        <div className="relative bg-white" style={display ?? { width: 0, height: 0 }}>
          <canvas ref={canvasRef} className="block h-full w-full" />
          {display && <InkLayer strokes={shown} rotation={doc.rotation} size={display} />}
          <div
            className="absolute inset-0 touch-none"
            style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finish(e)}
            onPointerCancel={(e) => finish(e, true)}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>
    </div>
  );
}
