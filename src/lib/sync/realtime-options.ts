/**
 * Réglages du socket Realtime (viewer et remote). Battement toutes les 5 s
 * au lieu de 25 s : une coupure wifi est détectée (et la reconnexion lancée)
 * en quelques secondes, au lieu d'envoyer des gestes dans le vide pendant
 * une demi-minute.
 */
export const REALTIME_OPTIONS = {
  heartbeatIntervalMs: 5_000,
  timeout: 5_000,
} as const;
