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
/** Nouvel essai d'écriture après un échec. */
const PERSIST_RETRY_MS = 10_000;
/** Intervalle minimal entre deux réponses à une demande d'état. */
const REPLY_INTERVAL_MS = 500;

export type ViewUpdate = Omit<ViewState, "seq" | "ts">;

/**
 * État du cockpit piloté par la remote : diffusion en temps réel, réponse
 * aux viewers qui demandent l'état, et persistance en base (debounce).
 */
export function useRemoteSync(cockpit: RemoteCockpit, onDocumentsChanged?: () => void) {
  const [state, setState] = useState<ViewState>(cockpit.lastState ?? INITIAL_VIEW_STATE);
  const [status, setStatus] = useState<LinkStatus>("connecting");
  const stateRef = useRef(state);
  const linkRef = useRef<CockpitLink | null>(null);
  const senderRef = useRef<ThrottledSender<ViewState> | null>(null);
  const onDocsChangedRef = useRef(onDocumentsChanged);
  useEffect(() => {
    onDocsChangedRef.current = onDocumentsChanged;
  });
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);

  const persist = useCallback(() => {
    const attempt = () => {
      clearTimeout(persistTimer.current);
      if (!dirty.current) return;
      dirty.current = false;
      void createClient()
        // Écriture conditionnelle en base : un état plus ancien (autre remote)
        // n'écrase jamais un plus récent. Le curseur est éphémère : non persisté.
        .rpc("save_last_state", {
          cockpit_id: cockpit.id,
          state: { ...stateRef.current, cursor: null } as unknown as Json,
        })
        .then(({ error }) => {
          if (error) {
            // Nouvel essai plus tard (réseau coupé…).
            dirty.current = true;
            clearTimeout(persistTimer.current);
            persistTimer.current = setTimeout(attempt, PERSIST_RETRY_MS);
          }
        });
    };
    attempt();
  }, [cockpit.id]);

  useEffect(() => {
    // Réponses aux demandes d'état limitées : une rafale de request_state
    // (canal public) ne doit pas faire émettre la remote en boucle.
    let lastReply = 0;
    let replyTimer: ReturnType<typeof setTimeout> | undefined;
    const reply = () => {
      replyTimer = undefined;
      lastReply = Date.now();
      if (stateRef.current.seq > 0) link.sendState(stateRef.current);
    };
    const link = connectCockpit(createClient(), cockpit.channel, {
      // Un viewer vient de se connecter : on lui envoie l'état courant.
      onRequestState: () => {
        if (replyTimer) return;
        const wait = lastReply + REPLY_INTERVAL_MS - Date.now();
        if (wait <= 0) reply();
        else replyTimer = setTimeout(reply, wait);
      },
      // État envoyé par une autre remote (autre appareil) : on se synchronise.
      onState: (incoming) => {
        if (isNewer(incoming, stateRef.current)) {
          stateRef.current = incoming;
          setState(incoming);
        }
      },
      onStatus: setStatus,
      onDocumentsChanged: () => onDocsChangedRef.current?.(),
    });
    linkRef.current = link;
    const sender = createThrottledSender<ViewState>((s) => link.sendState(s), SEND_INTERVAL_MS);
    senderRef.current = sender;

    const onHide = () => persist();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      clearTimeout(replyTimer);
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
