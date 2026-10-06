"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readLocalStorage, writeLocalStorage } from "@/hooks/use-local-storage";
import { pruneDocumentCache } from "@/lib/viewer/doc-cache";
import type { ViewerPayload } from "@/lib/viewer/types";

/** Renouvelle les URLs signées 5 min avant leur expiration. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
/** Délais entre deux tentatives après une erreur. */
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

/** Dernière réponse conservée localement : un viewer qui redémarre hors ligne affiche quand même. */
const payloadKey = (token: string) => `skyboard:viewer:${token}`;

function readStoredPayload(token: string): ViewerPayload | null {
  try {
    const raw = readLocalStorage(payloadKey(token));
    return raw ? (JSON.parse(raw) as ViewerPayload) : null;
  } catch {
    return null;
  }
}

export type ViewerDataStatus = "loading" | "ok" | "stale" | "not_found" | "error";

/**
 * Charge (et recharge périodiquement) la liste des documents du cockpit.
 * En cas d'erreur réseau, garde les dernières données et réessaie.
 */
export function useViewerData(token: string) {
  const [data, setData] = useState<ViewerPayload | null>(null);
  const [status, setStatus] = useState<ViewerDataStatus>("loading");
  const reloadRef = useRef<() => void>(() => {});

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;
    let hasData = false;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(load, Math.max(1_000, ms));
    };

    async function load() {
      try {
        const res = await fetch(`/api/viewer/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (stopped) return;
        if (res.status === 404) {
          // Token révoqué : on oublie les données locales.
          writeLocalStorage(payloadKey(token), null);
          void pruneDocumentCache(new Set());
          hasData = false;
          setData(null);
          setStatus("not_found");
          schedule(60_000);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const payload = (await res.json()) as ViewerPayload;
        if (stopped) return;
        attempt = 0;
        hasData = true;
        setData(payload);
        writeLocalStorage(payloadKey(token), JSON.stringify(payload));
        void pruneDocumentCache(new Set(payload.documents.map((d) => d.id)));
        setStatus("ok");
        schedule(payload.expiresAt - Date.now() - REFRESH_MARGIN_MS);
      } catch {
        if (stopped) return;
        if (!hasData) {
          const stored = readStoredPayload(token);
          if (stored) {
            hasData = true;
            setData(stored);
          }
        }
        setStatus(hasData ? "stale" : "error");
        schedule(RETRY_DELAYS_MS[Math.min(attempt++, RETRY_DELAYS_MS.length - 1)]);
      }
    }

    void load();
    reloadRef.current = () => schedule(0);
    // Au retour de veille / reconnexion réseau : recharger tout de suite.
    const onOnline = () => schedule(0);
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [token]);

  /** Recharge la liste tout de suite (dossier actif changé, documents ajoutés…). */
  const reload = useCallback(() => reloadRef.current(), []);

  return { data, status, reload };
}
