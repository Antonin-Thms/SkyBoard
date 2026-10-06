export type DeviceKind = "phone" | "tablet" | "desktop";

export interface DeviceSignals {
  /** (pointer: coarse) : pointeur principal tactile */
  coarsePointer: boolean;
  maxTouchPoints: number;
  userAgent: string;
  /** Plus petit côté de l'écran, en px CSS */
  shortSide: number;
}

/** En dessous de ce plus petit côté, un appareil tactile est un téléphone. */
export const PHONE_MAX_SHORT_SIDE = 600;

/**
 * Type d'appareil, pour adapter l'affichage et les gestes.
 * L'iPad récent se présente comme un Mac : on le reconnaît à ses points de
 * contact tactiles. Les PC Windows tactiles restent des ordinateurs.
 */
export function classifyDevice(s: DeviceSignals): DeviceKind {
  const mobileUa = /iPhone|iPad|iPod|Android|Mobile/i.test(s.userAgent);
  const ipadAsMac = /Macintosh/i.test(s.userAgent) && s.maxTouchPoints > 1;
  const touch = s.coarsePointer || ipadAsMac || (mobileUa && s.maxTouchPoints > 0);
  if (!touch) return "desktop";
  return s.shortSide < PHONE_MAX_SHORT_SIDE ? "phone" : "tablet";
}
