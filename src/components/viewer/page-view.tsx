"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { useSmoothedView, type SmoothedFrame } from "@/hooks/use-smoothed-view";
import type { ViewTransform } from "@/lib/gestures/transform";
import type { NormalizedPoint } from "@/lib/sync/protocol";
import { capRenderScale, fitScale, type Size } from "@/lib/viewer/fit";
import { loadDocumentSource } from "@/lib/viewer/sources";
import type { ViewerDocument } from "@/lib/viewer/types";

/** Plafond de pixels d'un canvas de rendu (≈ 4096 × 4096). */
const MAX_CANVAS_PIXELS = 16_777_216;

interface PageViewProps {
  doc: ViewerDocument;
  page: number;
  /** Zoom / déplacement cibles (bornés), atteints en douceur */
  view: ViewTransform;
  /** Point de la page sous le doigt de la remote (null : masqué) */
  cursor: NormalizedPoint | null;
  onError?: (message: string | null) => void;
}

/**
 * Affiche une page (PDF ou image) ajustée à la fenêtre, rendue à la
 * résolution de l'écran, puis applique zoom et déplacement (lissés).
 * Le rendu se fait hors écran puis remplace l'ancien d'un coup : pas
 * d'écran vide entre deux pages.
 */
export function PageView({ doc, page, view, cursor, onError }: PageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const container = useElementSize(containerRef);
  const [displaySize, setDisplaySize] = useState<Size | null>(null);

  useEffect(() => {
    if (!container || container.width === 0 || container.height === 0) return;
    let cancelled = false;
    let cancelRender: (() => void) | undefined;

    (async () => {
      const source = await loadDocumentSource(doc);
      if (cancelled) return;

      const dpr = window.devicePixelRatio || 1;
      const offscreen = document.createElement("canvas");
      let natural: Size;

      if (source.kind === "pdf") {
        const pdfPage = await source.pdf.getPage(Math.min(page, source.pdf.numPages));
        if (cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        natural = { width: base.width, height: base.height };
        const scale = capRenderScale(natural, fitScale(container, natural) * dpr, MAX_CANVAS_PIXELS);
        const viewport = pdfPage.getViewport({ scale });
        offscreen.width = Math.max(1, Math.floor(viewport.width));
        offscreen.height = Math.max(1, Math.floor(viewport.height));
        const task = pdfPage.render({ canvas: offscreen, viewport });
        cancelRender = () => task.cancel();
        await task.promise;
      } else {
        const { image } = source;
        natural = { width: image.width, height: image.height };
        const scale = capRenderScale(natural, fitScale(container, natural) * dpr, MAX_CANVAS_PIXELS);
        offscreen.width = Math.max(1, Math.round(natural.width * scale));
        offscreen.height = Math.max(1, Math.round(natural.height * scale));
        const ctx = offscreen.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(image, 0, 0, offscreen.width, offscreen.height);
        }
      }
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
      const fit = fitScale(container, natural);
      setDisplaySize({ width: natural.width * fit, height: natural.height * fit });
      onError?.(null);
    })().catch((err: unknown) => {
      if (cancelled) return;
      // Annulation d'un rendu pdf.js en cours : normal lors d'un changement rapide.
      if (err instanceof Error && err.name === "RenderingCancelledException") return;
      onError?.(err instanceof Error ? err.message : "Erreur de rendu");
    });

    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [doc, page, container, onError]);

  // Écrit la transformation directement dans le DOM (appelé à chaque frame).
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
  useSmoothedView(view, cursor, `${doc.id}:${page}`, applyFrame);

  return (
    <div ref={containerRef} className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div
        ref={stageRef}
        className="origin-center will-change-transform"
        style={displaySize ?? { width: 0, height: 0 }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
      {/* Curseur : position du doigt sur la remote (centré sur la fenêtre puis décalé) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
        <div
          ref={cursorRef}
          className="h-0 w-0 opacity-0 transition-opacity duration-300"
        >
          <div className="-ml-2.5 -mt-2.5 h-5 w-5 rounded-full border-2 border-white/90 bg-sky-400/50 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]" />
        </div>
      </div>
    </div>
  );
}
