"use client";

import { useEffect } from "react";

/**
 * Empêche la mise en veille de l'écran tant que le composant est affiché
 * (Screen Wake Lock API : Chrome / Edge Android, Safari iOS 16.4+).
 * Le verrou tombe quand la page passe en arrière-plan : il est repris au
 * retour, et au premier toucher si le navigateur exige un geste.
 * Sans prise en charge : rien ne se passe (l'appareil suit son réglage).
 */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let requesting = false;
    let disposed = false;

    const acquire = async () => {
      if (disposed || requesting || (lock && !lock.released) || document.visibilityState !== "visible") return;
      requesting = true;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (disposed) void sentinel.release();
        else lock = sentinel;
      } catch {
        // Refus (économie d'énergie, pas de geste…) : nouvel essai au prochain toucher.
      } finally {
        requesting = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("pointerdown", acquire, { passive: true });
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("pointerdown", acquire);
      void lock?.release().catch(() => {});
    };
  }, [enabled]);
}
