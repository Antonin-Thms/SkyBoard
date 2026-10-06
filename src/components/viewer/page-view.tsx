"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useElementSize } from "@/hooks/use-element-size";
import { useSmoothedView, type SmoothedFrame } from "@/hooks/use-smoothed-view";
import type { Rotation } from "@/lib/database.types";
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
import type { Size } from "@/lib/viewer/fit";
import { baseKey, peekBaseRender, renderBase, type BaseRender, type PageRef } from "@/lib/viewer/base-cache";
import { blit, naturalSize, renderRegion } from "@/lib/viewer/render";
import { loadDocumentSource } from "@/lib/viewer/sources";
import { DocumentDownloadError } from "@/lib/viewer/doc-cache";
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";
import type { Stroke } from "@/lib/annotations/model";
import { InkLayer } from "./ink-layer";
import type { ViewerDocument } from "@/lib/viewer/types";

interface PageViewProps {
  doc: ViewerDocument;
  page: number;
  /** Rotation de la page (sens horaire) */
  rotation: Rotation;
  /** Zoom / déplacement cibles (bornés), atteints en douceur */
  view: ViewTransform;
  /** Point de la page sous le doigt de la remote (null : masqué) */
  cursor: NormalizedPoint | null;
  onError?: (message: string | null) => void;
  /** Mode nuit : page atténuée */
  dim?: boolean;
  /** Annotations de la page (repère du document) */
  strokes?: Stroke[];
  /** Pages probablement affichées ensuite (documents voisins) : pré-rendues en arrière-plan */
  neighbors?: PageRef[];
}

const NO_STROKES: Stroke[] = [];

/** Luminosité de la page en mode nuit. */
const NIGHT_BRIGHTNESS = 0.4;

/** Délai avant de pré-rendre les voisins, une fois la page courante affichée. */
const PRERENDER_DELAY_MS = 300;

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
export function PageView({
  doc,
  page,
  rotation,
  view,
  cursor,
  dim = false,
  strokes = NO_STROKES,
  onError,
  neighbors,
}: PageViewProps) {
  const errorTexts = useT().viewer.errors;
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
  const pageKey = `${doc.id}:${page}:${rotation}`;
  // Le document est recréé à chaque rechargement de la liste (nouvelle URL
  // signée) : les rendus dépendent de son id, pas de l'objet. La ref donne
  // l'URL la plus récente si le fichier doit être téléchargé.
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  });
  const docId = doc.id;

  const hideDetail = () => {
    tileRef.current = null;
    if (detailRef.current) detailRef.current.style.display = "none";
  };

  // 1. Rendu de base (instantané s'il a déjà été pré-rendu)
  useEffect(() => {
    if (!container || container.width === 0 || container.height === 0) return;
    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    const ref = { doc: docRef.current, page, rotation };
    const dpr = window.devicePixelRatio || 1;

    const show = (render: BaseRender) => {
      if (!canvasRef.current) return;
      blit(render.canvas, canvasRef.current);
      hideDetail();
      setDisplaySize(render.display);
      setShownKey(`${docId}:${page}:${rotation}`);
      onError?.(null);
    };

    const hit = peekBaseRender(baseKey(ref, container, dpr));
    if (hit) {
      show(hit);
      return;
    }
    renderBase(ref, container, dpr, (c) => (cancelRender = c))
      .then((render) => {
        if (!cancelled) show(render);
      })
      .catch((err: unknown) => {
        if (cancelled || isCancellation(err)) return;
        onError?.(
          err instanceof DocumentDownloadError
            ? fmt(errorTexts.download, { status: err.status })
            : err instanceof Error
              ? err.message
              : errorTexts.render,
        );
      });

    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [docId, page, rotation, container, onError, errorTexts]);

  // Pré-rendu des voisins, un par un, une fois la page courante affichée.
  useEffect(() => {
    if (!container || !neighbors?.length || shownKey !== pageKey) return;
    let cancelled = false;
    const dpr = window.devicePixelRatio || 1;
    // Chaque pré-rendu attend un moment d'inactivité du navigateur : il ne
    // doit pas saccader un zoom ou un déplacement en cours.
    const idle = () =>
      new Promise<void>((resolve) =>
        typeof requestIdleCallback === "function"
          ? requestIdleCallback(() => resolve(), { timeout: 1_000 })
          : setTimeout(resolve, 50),
      );
    const timer = setTimeout(async () => {
      for (const ref of neighbors) {
        await idle();
        if (cancelled) return;
        await renderBase(ref, container, dpr).catch(() => {});
      }
    }, PRERENDER_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [neighbors, container, shownKey, pageKey]);

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
        const source = await loadDocumentSource(docRef.current);
        const natural = await naturalSize(source, page, rotation);
        if (cancelled) return;
        const rect = expandRect(visible, DETAIL_MARGIN);
        const dpr = window.devicePixelRatio || 1;
        const scale = (displaySize.width / natural.width) * view.zoom * dpr;
        const rendered = await renderRegion(
          source,
          page,
          scale,
          rect,
          (c) => (cancelRender = c),
          rotation,
        );
        const el = detailRef.current;
        if (cancelled || !el) return;

        blit(rendered.canvas, el);
        // Libère tout de suite le canvas hors écran (mémoire prise à DCS).
        rendered.canvas.width = rendered.canvas.height = 0;
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
  }, [view, displaySize, container, docId, page, rotation, pageKey, shownKey]);

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
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden transition-[filter] duration-500"
      // Mode nuit : luminosité réduite (une page blanche éblouit en vol de nuit).
      style={dim ? { filter: `brightness(${NIGHT_BRIGHTNESS})` } : undefined}
    >
      <div
        ref={stageRef}
        className="relative origin-center will-change-transform"
        style={displaySize ?? { width: 0, height: 0 }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        <canvas ref={detailRef} className="absolute" style={{ display: "none" }} />
        {/* Annotations : seulement une fois la page affichée (même taille, même repère). */}
        {displaySize && shownKey === pageKey && (
          <InkLayer strokes={strokes} rotation={rotation} size={displaySize} />
        )}
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
