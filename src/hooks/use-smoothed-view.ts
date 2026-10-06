"use client";

import { useEffect, useRef } from "react";
import { SMOOTHING_TAU_MS } from "@/lib/gestures/constants";
import { IDENTITY_VIEW, type ViewTransform } from "@/lib/gestures/transform";
import type { NormalizedPoint } from "@/lib/sync/protocol";
import { smoothPoint, smoothView } from "@/lib/viewer/smoothing";

/** Délai max entre deux images si requestAnimationFrame ne répond pas. */
const FALLBACK_FRAME_MS = 100;

export interface SmoothedFrame {
  view: ViewTransform;
  cursor: NormalizedPoint | null;
}

/**
 * Anime la vue affichée vers la vue cible à chaque frame
 * (requestAnimationFrame), sans re-rendu React : `apply` écrit directement
 * dans le DOM. Quand `snapKey` change (autre page / document), la vue saute
 * directement à la cible.
 */
export function useSmoothedView(
  target: ViewTransform,
  cursor: NormalizedPoint | null,
  snapKey: string,
  apply: (frame: SmoothedFrame) => void,
) {
  const display = useRef<SmoothedFrame>({ view: IDENTITY_VIEW, cursor: null });
  const targetRef = useRef<SmoothedFrame>({ view: target, cursor });
  const applyRef = useRef(apply);
  const raf = useRef<{ frame: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const lastT = useRef(0);
  const lastSnapKey = useRef<string | null>(null);

  useEffect(() => {
    applyRef.current = apply;
    // Mise en page changée (taille de page, fenêtre) : réappliquer l'image courante.
    apply(display.current);
  }, [apply]);

  useEffect(() => {
    targetRef.current = { view: target, cursor };

    if (lastSnapKey.current !== snapKey) {
      lastSnapKey.current = snapKey;
      display.current = { view: { ...target }, cursor };
      applyRef.current(display.current);
      return;
    }

    // Curseur qui apparaît : il part directement de sa position.
    if (cursor && !display.current.cursor) display.current = { ...display.current, cursor };
    if (!cursor) display.current = { ...display.current, cursor: null };

    if (raf.current !== null) return;
    lastT.current = performance.now();

    // Prochaine image : requestAnimationFrame, avec un minuteur de secours si
    // le navigateur ne fournit plus d'images (onglet masqué, rendu hors écran).
    const schedule = () => {
      const run = () => {
        if (!raf.current) return;
        cancelAnimationFrame(raf.current.frame);
        clearTimeout(raf.current.timer);
        raf.current = null;
        frame(performance.now());
      };
      raf.current = { frame: requestAnimationFrame(run), timer: setTimeout(run, FALLBACK_FRAME_MS) };
    };

    const frame = (now: number) => {
      // Pas de borne sur dt : si les images sont rares (onglet en arrière-plan,
      // machine chargée), l'interpolation rattrape la cible au lieu de traîner.
      const dt = now - lastT.current;
      lastT.current = now;
      const t = targetRef.current;
      const v = smoothView(display.current.view, t.view, dt, SMOOTHING_TAU_MS);
      let cursorDone = true;
      let nextCursor = display.current.cursor;
      if (t.cursor && nextCursor) {
        const c = smoothPoint(nextCursor, t.cursor, dt, SMOOTHING_TAU_MS / 2);
        nextCursor = c.point;
        cursorDone = c.done;
      }
      display.current = { view: v.view, cursor: nextCursor };
      applyRef.current(display.current);
      if (!(v.done && cursorDone)) schedule();
    };
    schedule();
  }, [target, cursor, snapKey]);

  useEffect(
    () => () => {
      if (raf.current) {
        cancelAnimationFrame(raf.current.frame);
        clearTimeout(raf.current.timer);
      }
    },
    [],
  );
}
