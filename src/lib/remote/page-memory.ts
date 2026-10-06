"use client";

import { readLocalStorage, writeLocalStorage } from "@/hooks/use-local-storage";

/** Dernière page vue par document, mémorisée par cockpit sur cet appareil. */
const key = (cockpitId: string) => `skyboard:pages:${cockpitId}`;

export function readPageMemory(cockpitId: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(readLocalStorage(key(cockpitId)) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (e): e is [string, number] => Number.isInteger(e[1]) && (e[1] as number) >= 1,
      ),
    );
  } catch {
    return {};
  }
}

export function rememberPage(cockpitId: string, docId: string, page: number) {
  const memory = readPageMemory(cockpitId);
  memory[docId] = page;
  writeLocalStorage(key(cockpitId), JSON.stringify(memory));
}
