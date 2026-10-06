"use client";

import { useEffect, useRef, useState } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { capRenderScale, fitScale, type Size } from "@/lib/viewer/fit";
import { loadDocumentSource } from "@/lib/viewer/sources";
import type { ViewerDocument } from "@/lib/viewer/types";

/** Plafond de pixels d'un canvas de rendu (≈ 4096 × 4096). */
const MAX_CANVAS_PIXELS = 16_777_216;

interface PageViewProps {
  doc: ViewerDocument;
  page: number;
  onError?: (message: string | null) => void;
}

/**
 * Affiche une page (PDF ou image) ajustée à la fenêtre, rendue à la
 * résolution de l'écran. Le rendu se fait hors écran puis remplace l'ancien
 * d'un coup : pas d'écran vide entre deux pages.
 */
export function PageView({ doc, page, onError }: PageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  return (
    <div ref={containerRef} className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        style={
          displaySize
            ? { width: displaySize.width, height: displaySize.height }
            : { width: 0, height: 0 }
        }
      />
    </div>
  );
}
