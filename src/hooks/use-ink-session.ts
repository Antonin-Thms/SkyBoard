"use client";

import { useCallback, useEffect, useRef } from "react";
import { readLocalStorage } from "@/hooks/use-local-storage";
import {
  DEFAULT_INK,
  isInkColor,
  MAX_STROKE_POINTS,
  MIN_POINT_DISTANCE,
  newStrokeId,
  pageKey,
  quantize,
  toDocumentPoint,
  type InkColor,
  type InkMessage,
  type Stroke,
} from "@/lib/annotations/model";
import { removeStrokes, saveStroke } from "@/lib/annotations/persist";
import type { Rotation } from "@/lib/database.types";
import type { NormalizedPoint } from "@/lib/sync/protocol";

/** Préférence d'encre (couleur, épaisseur), partagée entre éditeur et mode vol. */
export const INK_PREF_KEY = "skyboard:ink";

export function readInkPref(): { color: InkColor; width: number } {
  try {
    const raw = readLocalStorage(INK_PREF_KEY);
    const v = raw ? (JSON.parse(raw) as { color?: unknown; width?: unknown }) : null;
    if (v && isInkColor(v.color) && typeof v.width === "number" && v.width > 0 && v.width < 0.03) {
      return { color: v.color, width: v.width };
    }
  } catch {
    // préférence illisible : valeurs par défaut
  }
  return DEFAULT_INK;
}

/** Traits créés pendant la session, par page : « annuler » retire le dernier. */
const sessionStrokes = new Map<string, string[]>();

export function rememberStroke(key: string, id: string) {
  const list = sessionStrokes.get(key) ?? [];
  list.push(id);
  sessionStrokes.set(key, list);
}

/** Traits supprimés autrement (gomme, effacement) : « annuler » ne les vise plus. */
export function forgetSessionStrokes(key: string, ids: string[] | null) {
  if (ids === null) sessionStrokes.delete(key);
  else sessionStrokes.set(key, (sessionStrokes.get(key) ?? []).filter((id) => !ids.includes(id)));
}

export function popSessionStroke(key: string): string | undefined {
  return sessionStrokes.get(key)?.pop();
}

export interface InkTarget {
  docId: string;
  page: number;
  rotation: Rotation;
}

/** Intervalle d'envoi des points d'un trait en cours (≈ 30 msg/s). */
const DRAW_INTERVAL_MS = 33;

/**
 * Tracé d'annotations depuis la remote : construit le trait (repère du
 * document), le diffuse en direct, l'enregistre à la fin, et gère
 * « annuler ». Utilisé par le mode vol et par l'éditeur du mode préparation.
 */
export function useInkSession(sendInk: (message: InkMessage) => void) {
  const current = useRef<{ target: InkTarget; stroke: Stroke; sent: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sendRef = useRef(sendInk);
  useEffect(() => {
    sendRef.current = sendInk;
  });

  /** Envoie les points pas encore diffusés. */
  const flushDraw = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const c = current.current;
    if (!c || c.sent * 2 >= c.stroke.points.length) return;
    const { target, stroke } = c;
    sendRef.current({
      op: "draw",
      docId: target.docId,
      page: target.page,
      id: stroke.id,
      color: stroke.color,
      width: stroke.width,
      from: c.sent,
      points: stroke.points.slice(c.sent * 2),
    });
    c.sent = stroke.points.length / 2;
  }, []);

  const scheduleDraw = useCallback(() => {
    if (timer.current === undefined) timer.current = setTimeout(flushDraw, DRAW_INTERVAL_MS);
  }, [flushDraw]);

  /** Trait terminé : diffusé complet, enregistré, mémorisé pour « annuler ». */
  const commit = useCallback(() => {
    const c = current.current;
    if (!c) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    current.current = null;
    const { target, stroke } = c;
    sendRef.current({ op: "commit", docId: target.docId, page: target.page, stroke });
    rememberStroke(pageKey(target.docId, target.page), stroke.id);
    void saveStroke(target.docId, target.page, stroke);
  }, []);

  const addPoint = useCallback(
    (point: NormalizedPoint) => {
      const c = current.current;
      if (!c) return;
      const p = toDocumentPoint(point, c.target.rotation);
      const x = quantize(p.x);
      const y = quantize(p.y);
      const pts = c.stroke.points;
      const n = pts.length;
      if (n >= 2 && Math.hypot(x - pts[n - 2], y - pts[n - 1]) < MIN_POINT_DISTANCE) return;
      if (n / 2 >= MAX_STROKE_POINTS) {
        // Trait très long : on le termine et on enchaîne sur un nouveau, sans trou.
        const { target, stroke } = c;
        const last = [pts[n - 2], pts[n - 1]];
        commit();
        current.current = {
          target,
          stroke: { id: newStrokeId(), color: stroke.color, width: stroke.width, points: [...last, x, y] },
          sent: 0,
        };
      } else {
        pts.push(x, y);
      }
      scheduleDraw();
    },
    [commit, scheduleDraw],
  );

  const start = useCallback(
    (target: InkTarget, point: NormalizedPoint, ink = readInkPref()) => {
      if (current.current) commit();
      current.current = {
        target,
        stroke: { id: newStrokeId(), color: ink.color, width: ink.width, points: [] },
        sent: 0,
      };
      addPoint(point);
    },
    [addPoint, commit],
  );

  const end = useCallback(() => {
    flushDraw();
    commit();
  }, [commit, flushDraw]);

  /** Trait abandonné (second doigt posé) : retiré des viewers, non enregistré. */
  const cancel = useCallback(() => {
    const c = current.current;
    if (!c) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    current.current = null;
    sendRef.current({ op: "erase", docId: c.target.docId, page: c.target.page, ids: [c.stroke.id] });
  }, []);

  /** Retire le dernier trait fait pendant la session sur cette page. */
  const undo = useCallback((docId: string, page: number): string | null => {
    const id = popSessionStroke(pageKey(docId, page));
    if (!id) return null;
    sendRef.current({ op: "erase", docId, page, ids: [id] });
    void removeStrokes(docId, page, [id]);
    return id;
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  /** Trait en cours (affichage local dans l'éditeur). */
  const liveStroke = useCallback(() => current.current?.stroke ?? null, []);

  return { start, addPoint, end, cancel, undo, liveStroke };
}
