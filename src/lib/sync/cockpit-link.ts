"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { parseViewState, type ViewState } from "./protocol";

/** Événements Broadcast échangés sur le canal d'un cockpit. */
export const SYNC_EVENTS = {
  /** remote → viewers (et autres remotes) : nouvel état */
  state: "state",
  /** viewer → remotes : « envoyez-moi l'état courant » */
  requestState: "request_state",
} as const;

/** Délai avant de recréer un canal fermé de façon inattendue (ms). */
const REOPEN_DELAY_MS = 2_000;

export type LinkStatus = "connecting" | "connected" | "disconnected";

export interface CockpitLinkHandlers {
  onState?: (state: ViewState) => void;
  onRequestState?: () => void;
  onStatus?: (status: LinkStatus) => void;
  /** Appelé à chaque (re)connexion effective au canal. */
  onConnected?: () => void;
}

export interface CockpitLink {
  sendState: (state: ViewState) => void;
  requestState: () => void;
  close: () => void;
}

/**
 * Rejoint le canal Broadcast d'un cockpit et le maintient ouvert.
 * Après une erreur ou un timeout, supabase-js reconnecte le socket et
 * rejoint le canal tout seul (SUBSCRIBED est alors signalé à nouveau) ;
 * on ne recrée le canal que s'il est fermé de façon inattendue. Retour
 * réseau ou retour au premier plan relancent le socket immédiatement.
 */
export function connectCockpit(
  supabase: SupabaseClient,
  channelName: string,
  handlers: CockpitLinkHandlers,
): CockpitLink {
  let channel: RealtimeChannel | null = null;
  let status: LinkStatus = "connecting";
  let closed = false;
  let reopenTimer: ReturnType<typeof setTimeout> | undefined;
  /** Dernier état non envoyé faute de connexion : parti dès la reconnexion. */
  let pending: ViewState | null = null;

  const setStatus = (next: LinkStatus) => {
    if (next === status) return;
    status = next;
    handlers.onStatus?.(next);
  };

  const broadcast = (event: string, payload: unknown) => {
    void channel?.send({ type: "broadcast", event, payload }).catch(() => {});
  };

  async function open() {
    // supabase.channel() renvoie un canal existant de même nom : on attend
    // que tout canal précédent (fermeture en cours, double montage React en
    // dev…) soit vraiment retiré avant d'en créer un neuf.
    const topic = `realtime:${channelName}`;
    for (const stale of supabase.getChannels().filter((c) => c.topic === topic)) {
      await supabase.removeChannel(stale);
      stale.teardown();
      supabase.realtime.channels = supabase.realtime.channels.filter((c) => c !== stale);
    }
    if (closed) return;

    const ch = supabase.channel(channelName, {
      config: { broadcast: { self: false, ack: false } },
    });
    channel = ch;
    setStatus("connecting");

    ch.on("broadcast", { event: SYNC_EVENTS.state }, ({ payload }) => {
      const state = parseViewState(payload);
      if (state) handlers.onState?.(state);
    });
    ch.on("broadcast", { event: SYNC_EVENTS.requestState }, () => handlers.onRequestState?.());

    ch.subscribe((s) => {
      if (closed || ch !== channel) return;
      if (s === "SUBSCRIBED") {
        setStatus("connected");
        if (pending) {
          broadcast(SYNC_EVENTS.state, pending);
          pending = null;
        }
        handlers.onConnected?.();
      } else if (s === "CLOSED") {
        setStatus("disconnected");
        clearTimeout(reopenTimer);
        reopenTimer = setTimeout(() => void open(), REOPEN_DELAY_MS);
      } else {
        // CHANNEL_ERROR / TIMED_OUT : nouvelle tentative automatique.
        setStatus("disconnected");
      }
    });
  }

  const wake = () => {
    if (!closed && status !== "connected" && !supabase.realtime.isConnected()) {
      supabase.realtime.connect();
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") wake();
  };
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", onVisibility);

  void open();

  return {
    sendState(state) {
      if (status === "connected") broadcast(SYNC_EVENTS.state, state);
      else pending = state;
    },
    requestState() {
      if (status === "connected") broadcast(SYNC_EVENTS.requestState, {});
    },
    close() {
      closed = true;
      clearTimeout(reopenTimer);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", onVisibility);
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    },
  };
}
