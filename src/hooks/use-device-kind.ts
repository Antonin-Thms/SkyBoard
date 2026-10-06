"use client";

import { useSyncExternalStore } from "react";
import { classifyDevice, type DeviceKind } from "@/lib/device/kind";

function subscribe(onChange: () => void) {
  const coarse = window.matchMedia("(pointer: coarse)");
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  coarse.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
    coarse.removeEventListener("change", onChange);
  };
}

function snapshot(): DeviceKind {
  return classifyDevice({
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    userAgent: navigator.userAgent,
    shortSide: Math.min(window.screen.width, window.screen.height),
  });
}

/** Type d'appareil (null côté serveur, avant hydratation). */
export function useDeviceKind(): DeviceKind | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
