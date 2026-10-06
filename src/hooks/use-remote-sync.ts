"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Json } from "@/lib/database.types";
import type { RemoteCockpit } from "@/lib/remote/types";
import { createClient } from "@/lib/supabase/client";
import { connectCockpit, type CockpitLink, type LinkStatus } from "@/lib/sync/cockpit-link";
import { INITIAL_VIEW_STATE, type ViewState } from "@/lib/sync/protocol";
import { isNewer, nextSeq } from "@/lib/sync/state";
import { createThrottledSender, type ThrottledSender } from "@/lib/sync/throttle";
import { SEND_INTERVAL_MS } from "@/lib/gestures/constants";

/** Délai d'écriture du dernier état en base après le dernier changement. */
const PERSIST_DELAY_MS = 1_000;

export type ViewUpdate = Omit<ViewState, "seq" | "ts">;

/**
 * État du cockpit piloté par la remote : diffusion en temps réel, réponse
 * aux viewers qui demandent l'état, et persistance en base (debounce).
 */
export function useRemoteSync(cockpit: RemoteCockpit) {
  const [state, setState] = useState<ViewState>(cockpit.lastState ?? INITIAL_VIEW_STATE);
  const [status, setStatus] = useState<LinkStatus>("connecting");
  const stateRef = useRef(state);
  const linkRef = useRef<CockpitLink | null>(null);
  const senderRef = useRef<ThrottledSender<ViewState> | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);

  const persist = useCallback(() => {
    clearTimeout(persistTimer.current);
    if (!dirty.current) return;
    dirty.current = false;
    void createClient()
      .from("cockpits")
      // Le curseur est éphémère : on ne le persiste pas.
      .update({ last_state: { ...stateRef.current, cursor: null } as unknown as Json })
      .eq("id", cockpit.id)
      .then(({ error }) => {
        if (error) dirty.current = true;
      });
  }, [cockpit.id]);

  useEffect(() => {
    const link = connectCockpit(createClient(), cockpit.channel, {
      // Un viewer vient de se connecter : on lui envoie l'état courant.
      onRequestState: () => {
        if (stateRef.current.seq > 0) link.sendState(stateRef.current);
      },
      // État envoyé par une autre remote (autre appareil) : on se synchronise.
      onState: (incoming) => {
        if (isNewer(incoming, stateRef.current)) {
          stateRef.current = incoming;
          setState(incoming);
        }
      },
      onStatus: setStatus,
    });
    linkRef.current = link;
    const sender = createThrottledSender<ViewState>((s) => link.sendState(s), SEND_INTERVAL_MS);
    senderRef.current = sender;

    const onHide = () => persist();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      sender.flush();
      persist();
      link.close();
      linkRef.current = null;
      senderRef.current = null;
    };
  }, [cockpit.channel, persist]);

  /**
   * Applique et diffuse un nouvel état. Pendant un geste continu, l'envoi est
   * limité (≈ 30 msg/s) ; `immediate` envoie tout de suite (commande ponctuelle).
   */
  const update = useCallback(
    (next: ViewUpdate, options: { immediate?: boolean } = {}) => {
      const now = Date.now();
      const s: ViewState = { ...next, seq: nextSeq(stateRef.current.seq, now), ts: now };
      stateRef.current = s;
      setState(s);
      senderRef.current?.push(s);
      if (options.immediate) senderRef.current?.flush();
      dirty.current = true;
      clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(persist, PERSIST_DELAY_MS);
    },
    [persist],
  );

  /** Fin de geste : envoi final garanti du dernier état. */
  const flush = useCallback(() => senderRef.current?.flush(), []);

  return { state, status, update, flush, stateRef };
}
