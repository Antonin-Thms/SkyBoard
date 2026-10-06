import "server-only";

import { createHash, randomBytes } from "node:crypto";

/** Durée de validité d'un code de jumelage (QR code affiché sur le PC). */
export const PAIRING_TTL_MS = 2 * 60 * 1000;

/** Code aléatoire (128 bits, base64url) : seul son hash est stocké. */
export function newPairingCode(): string {
  return randomBytes(16).toString("base64url");
}

export function hashPairingCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Format attendu d'un code (22 caractères base64url). */
export function isPairingCode(value: string | null): value is string {
  return !!value && /^[A-Za-z0-9_-]{22}$/.test(value);
}
