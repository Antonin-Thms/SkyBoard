"use client";

import { useEffect, useRef } from "react";
import type { DeviceKind } from "@/lib/device/kind";
import { DEVICE_GESTURE_OVERRIDES, GESTURE_CONFIG } from "@/lib/gestures/constants";
import { GestureRecognizer, type GestureAction } from "@/lib/gestures/recognizer";
import type { ViewTransform } from "@/lib/gestures/transform";
import { fmt } from "@/lib/i18n/define";
import { useLocale, useT } from "@/lib/i18n/client";
import type { LinkStatus } from "@/lib/sync/cockpit-link";
import { LogOut, Moon, MousePointer2, PenLine } from "lucide-react";
import { HoldButton } from "@/components/hold-button";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";

interface FlightModeProps {
  getView: () => ViewTransform;
  onActions: (actions: GestureAction[]) => void;
  device: DeviceKind;
  onExit: () => void;
  status: LinkStatus;
  cursorEnabled: boolean;
  onToggleCursor: () => void;
  night: boolean;
  onToggleNight: () => void;
  /** Crayon actif (affichage) */
  pen: boolean;
  info: { docName: string | null; page: number; pageCount: number; zoom: number };
}

const STATUS_TONE: Record<LinkStatus, StatusTone> = {
  connecting: "pending",
  connected: "ok",
  disconnected: "pending",
};

/** Bouton de la barre du haut : icône seule sur téléphone. */
const topButton = (active: boolean) =>
  `flex h-10 items-center gap-2 rounded-[2px] px-3 text-sm ${active ? "bg-accent-subtle text-accent" : "text-muted"}`;

/**
 * Mode vol : tout l'écran reçoit les gestes, sans bouton au centre.
 * Le zoom / défilement natifs de Safari sont neutralisés.
 */
export function FlightMode({
  getView,
  onActions,
  device,
  onExit,
  status,
  cursorEnabled,
  onToggleCursor,
  night,
  onToggleNight,
  pen,
  info,
}: FlightModeProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const config = { ...GESTURE_CONFIG, ...DEVICE_GESTURE_OVERRIDES[device] };
  const compact = device === "phone";
  const t = useT().remote.flight;
  const locale = useLocale();
  const statusLabel = {
    connecting: t.statusConnecting,
    connected: t.statusConnected,
    disconnected: t.statusDisconnected,
  }[status];
  const holdSeconds = new Intl.NumberFormat(locale).format(config.penHoldMs / 1000);
  // Références stables pour les écouteurs natifs.
  const getViewRef = useRef(getView);
  const onActionsRef = useRef(onActions);
  useEffect(() => {
    getViewRef.current = getView;
    onActionsRef.current = onActions;
  });

  // Plein écran (tablettes) et blocage du défilement de la page pendant le mode vol.
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
    const recognizer = new GestureRecognizer(
      size(),
      () => getViewRef.current(),
      DEVICE_GESTURE_OVERRIDES[device],
    );
    // Position de la surface mémorisée (pas de getBoundingClientRect, qui
    // force une mise en page, à chaque événement tactile).
    let origin = el.getBoundingClientRect();
    const resize = new ResizeObserver(() => {
      recognizer.setSurface(size());
      origin = el.getBoundingClientRect();
    });
    resize.observe(el);

    const local = (e: PointerEvent) => [e.clientX - origin.left, e.clientY - origin.top] as const;
    const emit = (actions: GestureAction[]) => {
      if (actions.length) onActionsRef.current(actions);
    };

    // Appui long (crayon) : vérifié par un minuteur, sans attendre un mouvement.
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const holdMs = (DEVICE_GESTURE_OVERRIDES[device].penHoldMs ?? GESTURE_CONFIG.penHoldMs) + 30;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      // Début de geste : position relue une fois (rotation d'écran, barre d'adresse…).
      origin = el.getBoundingClientRect();
      el.setPointerCapture?.(e.pointerId);
      emit(recognizer.down(e.pointerId, ...local(e), e.timeStamp));
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => emit(recognizer.poll(performance.now())), holdMs);
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
      clearTimeout(holdTimer);
      resize.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("touchstart", prevent);
      el.removeEventListener("touchmove", prevent);
      el.removeEventListener("contextmenu", prevent);
    };
  }, [device]);

  const edgeStyle = { width: config.edgeWidthPx };

  return (
    <div className="fixed inset-0 z-50 flex select-none flex-col bg-black pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] text-slate-500 [-webkit-touch-callout:none]">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-2 text-sm">
        {/* Appui long : un tap à l'aveugle près du bord ne fait pas sortir du mode vol. */}
        <HoldButton
          label={t.exitLabel}
          onHold={onExit}
          className={`${topButton(false)} text-slate-300`}
        >
          <LogOut size={18} strokeWidth={1.75} className="rotate-180" />
          {compact ? t.exit : t.exitHold}
        </HoldButton>
        <span role="status" className="flex items-center gap-2" aria-label={statusLabel}>
          <StatusDot tone={STATUS_TONE[status]} />
          {status !== "connected" && <span className="text-xs text-muted">{statusLabel}</span>}
        </span>
        <span className="flex items-center gap-1">
          <HoldButton
            label={night ? t.nightOnLabel : t.nightOffLabel}
            onHold={onToggleNight}
            className={topButton(night)}
          >
            <Moon size={18} strokeWidth={1.75} />
            {!compact && t.night}
          </HoldButton>
          <HoldButton
            label={cursorEnabled ? t.cursorOnLabel : t.cursorOffLabel}
            onHold={onToggleCursor}
            className={topButton(cursorEnabled)}
          >
            <MousePointer2 size={18} strokeWidth={1.75} />
            {!compact && t.cursor}
          </HoldButton>
        </span>
      </div>

      <div ref={surfaceRef} className="relative flex-1 touch-none overflow-hidden">
        {/* Bandes latérales : swipe vertical = page précédente / suivante (désactivées avec le crayon) */}
        {!pen && (
          <>
            <div style={edgeStyle} className="pointer-events-none absolute inset-y-0 left-0 border-r border-dashed border-line-strong bg-sunken" />
            <div style={edgeStyle} className="pointer-events-none absolute inset-y-0 right-0 border-l border-dashed border-line-strong bg-sunken" />
          </>
        )}
        {pen && <div className="pointer-events-none absolute inset-0 border-[3px] border-accent/80" />}

        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center"
          style={{ paddingInline: config.edgeWidthPx + 12 }}
        >
          {pen && (
            <p className="mb-2 flex items-center gap-2 text-lg font-semibold text-accent">
              <PenLine size={22} strokeWidth={1.75} />
              {t.penActive}
            </p>
          )}
          <p className={`max-w-full truncate text-slate-300 ${compact ? "text-base" : "text-lg"}`}>{info.docName ?? t.noDocument}</p>
          {info.docName && (
            <p className="numeric text-sm tracking-wider text-subtle">
              {fmt(t.pageInfo, { page: info.page, count: info.pageCount, zoom: info.zoom.toFixed(1) })}
            </p>
          )}
        </div>

        <p
          className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs leading-relaxed text-subtle"
          style={{ paddingInline: config.edgeWidthPx + 12 }}
        >
          {pen
            ? fmt(t.hintPen, { s: holdSeconds })
            : compact
              ? t.hintCompact
              : fmt(t.hint, { s: holdSeconds })}
        </p>
      </div>
    </div>
  );
}
