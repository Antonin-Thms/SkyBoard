"use client";

import { useEffect, useRef } from "react";
import { GESTURE_CONFIG } from "@/lib/gestures/constants";
import { GestureRecognizer, type GestureAction } from "@/lib/gestures/recognizer";
import type { ViewTransform } from "@/lib/gestures/transform";
import type { LinkStatus } from "@/lib/sync/cockpit-link";

interface FlightModeProps {
  getView: () => ViewTransform;
  onActions: (actions: GestureAction[]) => void;
  onExit: () => void;
  status: LinkStatus;
  cursorEnabled: boolean;
  onToggleCursor: () => void;
  info: { docName: string | null; page: number; pageCount: number; zoom: number };
}

const STATUS_COLOR: Record<LinkStatus, string> = {
  connecting: "bg-amber-400",
  connected: "bg-emerald-400",
  disconnected: "bg-red-500",
};

/**
 * Mode vol : tout l'écran reçoit les gestes, sans bouton au centre.
 * Le zoom / défilement natifs de Safari sont neutralisés.
 */
export function FlightMode({
  getView,
  onActions,
  onExit,
  status,
  cursorEnabled,
  onToggleCursor,
  info,
}: FlightModeProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  // Références stables pour les écouteurs natifs.
  const getViewRef = useRef(getView);
  const onActionsRef = useRef(onActions);
  useEffect(() => {
    getViewRef.current = getView;
    onActionsRef.current = onActions;
  });

  // Plein écran (iPad) et blocage du défilement de la page pendant le mode vol.
  useEffect(() => {
    const root = document.documentElement;
    const prev = { overflow: root.style.overflow, overscroll: root.style.overscrollBehavior };
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    root.requestFullscreen?.().catch(() => {});
    const blockGesture = (e: Event) => e.preventDefault();
    // Safari : pincement natif (événements gesture*, non standard).
    document.addEventListener("gesturestart", blockGesture);
    document.addEventListener("gesturechange", blockGesture);
    return () => {
      root.style.overflow = prev.overflow;
      root.style.overscrollBehavior = prev.overscroll;
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Gestes : Pointer Events natifs, multi-touch.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const size = () => ({ width: el.clientWidth || 1, height: el.clientHeight || 1 });
    const recognizer = new GestureRecognizer(size(), () => getViewRef.current());
    const resize = new ResizeObserver(() => recognizer.setSurface(size()));
    resize.observe(el);

    const local = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top] as const;
    };
    const emit = (actions: GestureAction[]) => {
      if (actions.length) onActionsRef.current(actions);
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      emit(recognizer.down(e.pointerId, ...local(e), e.timeStamp));
    };
    const onMove = (e: PointerEvent) => {
      // Événements coalescés : on prend la position la plus récente.
      emit(recognizer.move(e.pointerId, ...local(e)));
    };
    const onUp = (e: PointerEvent) => emit(recognizer.up(e.pointerId, ...local(e), e.timeStamp));
    const onCancel = (e: PointerEvent) => emit(recognizer.cancel(e.pointerId));
    // iOS : empêche défilement, zoom double tap, loupe et menu contextuel.
    const prevent = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("touchstart", prevent, { passive: false });
    el.addEventListener("touchmove", prevent, { passive: false });
    el.addEventListener("contextmenu", prevent);
    return () => {
      resize.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("touchstart", prevent);
      el.removeEventListener("touchmove", prevent);
      el.removeEventListener("contextmenu", prevent);
    };
  }, []);

  const edgeStyle = { width: GESTURE_CONFIG.edgeWidthPx };

  return (
    <div className="fixed inset-0 z-50 flex select-none flex-col bg-black pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] text-slate-500 [-webkit-touch-callout:none]">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-900 px-3 text-sm">
        <button type="button" className="rounded-lg px-3 py-1.5 text-slate-300 active:bg-slate-800" onClick={onExit}>
          ✕ Quitter le mode vol
        </button>
        <span className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLOR[status]}`} />
        </span>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 ${cursorEnabled ? "bg-sky-900 text-sky-200" : "text-slate-400"}`}
          onClick={onToggleCursor}
        >
          Curseur {cursorEnabled ? "activé" : "désactivé"}
        </button>
      </div>

      <div ref={surfaceRef} className="relative flex-1 touch-none overflow-hidden">
        {/* Bandes latérales : swipe vertical = document précédent / suivant */}
        <div style={edgeStyle} className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center bg-slate-900/60">
          <span className="text-xs [writing-mode:vertical-rl] rotate-180">▲ document ▼</span>
        </div>
        <div style={edgeStyle} className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center bg-slate-900/60">
          <span className="text-xs [writing-mode:vertical-rl]">▲ document ▼</span>
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-20 text-center">
          <p className="max-w-full truncate text-lg text-slate-300">{info.docName ?? "Aucun document"}</p>
          {info.docName && (
            <p className="text-sm">
              Page {info.page} / {info.pageCount} · zoom ×{info.zoom.toFixed(1)}
            </p>
          )}
        </div>

        <p className="pointer-events-none absolute inset-x-0 bottom-3 px-20 text-center text-xs leading-relaxed text-slate-600">
          Pincer : zoom · 2 doigts : déplacer · 1 doigt (zoomé) : déplacer · Swipe ← → : page · Double
          tap : réinitialiser · Bords ↕ : document
        </p>
      </div>
    </div>
  );
}
