"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // stockage indisponible (navigation privée…) : préférence non mémorisée
  }
  listeners.forEach((l) => l());
}

/** Valeur texte persistée dans localStorage (null côté serveur ou si absente). */
export function useLocalStorage(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readLocalStorage(key),
    () => null,
  );
  const set = useCallback((v: string | null) => writeLocalStorage(key, v), [key]);
  return [value, set];
}
