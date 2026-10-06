"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { useSmoothedView, type SmoothedFrame } from "@/hooks/use-smoothed-view";
import type { ViewTransform } from "@/lib/gestures/transform";
import type { NormalizedPoint } from "@/lib/sync/protocol";
import {
  DETAIL_DEBOUNCE_MS,
  DETAIL_MARGIN,
  DETAIL_MIN_ZOOM,
  expandRect,
  tileIsSufficient,
  visiblePageRect,
  type DetailTile,
} from "@/lib/viewer/detail";
import { fitScale, type Size } from "@/lib/viewer/fit";
import { blit, naturalSize, renderRegion } from "@/lib/viewer/render";
import { loadDocumentSource } from "@/lib/viewer/sources";
import type { ViewerDocument } from "@/lib/viewer/types";

interface PageViewProps {
  doc: ViewerDocument;
  page: number;
  /** Zoom / déplacement cibles (bornés), atteints en douceur */
  view: ViewTransform;
  /** Point de la page sous le doigt de la remote (null : masqué) */
  cursor: NormalizedPoint | null;
  onError?: (message: string | null) => void;
}

const isCancellation = (err: unknown) =>
  err instanceof Error && err.name === "RenderingCancelledException";

/**
 * Affiche une page (PDF ou image) :
 * 1. rendu de base ajusté à la fenêtre, à la résolution de l'écran ;
 * 2. zoom / déplacement appliqués en CSS et lissés à chaque frame ;
 * 3. une fois la vue stable, une « tuile de détail » re-rend la zone visible
 *    (avec une marge) à la résolution exacte du zoom : net à tout niveau,
 *    à coût borné. En attendant, le rendu de base agrandi reste affiché.
 * Les rendus se font hors écran puis remplacent l'ancien d'un coup.
 */
export function PageView({ doc, page, view, cursor, onError }: PageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detailRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const container = useElementSize(containerRef);
  const [displaySize, setDisplaySize] = useState<Size | null>(null);
  /** Page dont le rendu de base est affiché (la tuile doit correspondre). */
  const [shownKey, setShownKey] = useState<string | null>(null);
  const tileRef = useRef<DetailTile | null>(null);
  const pageKey = `${doc.id}:${page}`;

  const hideDetail = () => {
    tileRef.current = null;
    if (detailRef.current) detailRef.current.style.display = "none";
  };

  // 1. Rendu de base
  useEffect(() => {
    if (!container || container.width === 0 || container.height === 0) return;
    let cancelled = false;
    let cancelRender: (() => void) | undefined;

    (async () => {
      const source = await loadDocumentSource(doc);
      if (cancelled) return;
      const natural = await naturalSize(source, page);
      if (cancelled) return;
      const fit = fitScale(container, natural);
      const dpr = window.devicePixelRatio || 1;
      const rendered = await renderRegion(source, page, fit * dpr, undefined, (c) => (cancelRender = c));
      if (cancelled || !canvasRef.current) return;

      blit(rendered.canvas, canvasRef.current);
      hideDetail();
      setDisplaySize({ width: natural.width * fit, height: natural.height * fit });
      setShownKey(`${doc.id}:${page}`);
      onError?.(null);
    })().catch((err: unknown) => {
      if (cancelled || isCancellation(err)) return;
      onError?.(err instanceof Error ? err.message : "Erreur de rendu");
    });

    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [doc, page, container, onError]);

  // 3. Tuile de détail, après stabilisation de la vue cible
  useEffect(() => {
    if (!container || !displaySize || shownKey !== pageKey) return;
    if (view.zoom < DETAIL_MIN_ZOOM) {
      hideDetail();
      return;
    }
    const visible = visiblePageRect(view, displaySize, container);
    if (!visible || tileIsSufficient(tileRef.current, visible, view.zoom)) return;

    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    const timer = setTimeout(() => {
      (async () => {
        const source = await loadDocumentSource(doc);
        const natural = await naturalSize(source, page);
        if (cancelled) return;
        const rect = expandRect(visible, DETAIL_MARGIN);
        const dpr = window.devicePixelRatio || 1;
        const scale = (displaySize.width / natural.width) * view.zoom * dpr;
        const rendered = await renderRegion(source, page, scale, rect, (c) => (cancelRender = c));
        const el = detailRef.current;
        if (cancelled || !el) return;

        blit(rendered.canvas, el);
        Object.assign(el.style, {
          display: "block",
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`,
        });
        tileRef.current = { rect, zoom: view.zoom };
      })().catch((err: unknown) => {
        if (!cancelled && !isCancellation(err)) hideDetail();
      });
    }, DETAIL_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelRender?.();
    };
  }, [view, displaySize, container, doc, page, pageKey, shownKey]);

  // 2. Transformation écrite directement dans le DOM (appelé à chaque frame).
  const width = displaySize?.width ?? 0;
  const height = displaySize?.height ?? 0;
  const applyFrame = useCallback(
    ({ view: v, cursor: c }: SmoothedFrame) => {
      const stage = stageRef.current;
      if (stage) {
        const tx = v.panX * width * v.zoom;
        const ty = v.panY * height * v.zoom;
        stage.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${v.zoom})`;
      }
      const dot = cursorRef.current;
      if (dot) {
        if (c) {
          const x = width * v.zoom * (c.x - 0.5 + v.panX);
          const y = height * v.zoom * (c.y - 0.5 + v.panY);
          dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          dot.style.opacity = "1";
        } else {
          dot.style.opacity = "0";
        }
      }
    },
    [width, height],
  );
  useSmoothedView(view, cursor, pageKey, applyFrame);

  return (
    <div ref={containerRef} className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div
        ref={stageRef}
        className="relative origin-center will-change-transform"
        style={displaySize ?? { width: 0, height: 0 }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        <canvas ref={detailRef} className="absolute" style={{ display: "none" }} />
      </div>
      {/* Curseur : position du doigt sur la remote (centré sur la fenêtre puis décalé) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
        <div ref={cursorRef} className="h-0 w-0 opacity-0 transition-opacity duration-300">
          <div className="-ml-2.5 -mt-2.5 h-5 w-5 rounded-full border-2 border-white/90 bg-sky-400/50 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]" />
        </div>
      </div>
    </div>
  );
}
