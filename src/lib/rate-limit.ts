/**
 * Limiteur de débit en mémoire (fenêtre glissante simple), par clé.
 * Best effort : chaque instance serverless a sa propre mémoire. Suffit à
 * couper une boucle de requêtes depuis une même IP ; pour une protection
 * globale, ajouter une règle de rate limit dans le pare-feu Vercel.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function allow(key: string, now: number = Date.now()): boolean {
    // Ménage occasionnel pour borner la mémoire.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}
