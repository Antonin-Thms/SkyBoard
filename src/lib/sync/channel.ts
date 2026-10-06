import "server-only";

import { createHmac } from "node:crypto";

/**
 * Nom du canal Realtime d'un cockpit : HMAC du token viewer avec un secret
 * serveur. Non devinable, ne révèle pas le token, et change quand le token
 * est régénéré (l'ancienne URL perd aussi l'accès au canal).
 */
export function channelNameForToken(token: string): string {
  const secret = process.env.VIEWER_CHANNEL_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "VIEWER_CHANNEL_SECRET manquante ou trop courte (32 caractères min., voir .env.example)",
    );
  }
  return deriveChannelName(token, secret);
}

export function deriveChannelName(token: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(token).digest("base64url");
  return `cockpit:${digest}`;
}
