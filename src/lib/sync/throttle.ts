export interface Clock {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface ThrottledSender<T> {
  /** Propose une valeur : envoyée tout de suite si l'intervalle est écoulé, sinon à la fin de l'intervalle (seule la dernière compte). */
  push: (value: T) => void;
  /** Envoie immédiatement la valeur en attente (fin de geste). */
  flush: () => void;
  cancel: () => void;
}

/** Limite le débit d'envoi à 1 message par intervalle, en gardant toujours la dernière valeur. */
export function createThrottledSender<T>(
  send: (value: T) => void,
  intervalMs: number,
  clock: Clock = realClock,
): ThrottledSender<T> {
  let lastSent = Number.NEGATIVE_INFINITY;
  let pending: { value: T } | null = null;
  let timer: unknown = null;

  const flush = () => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const { value } = pending;
    pending = null;
    lastSent = clock.now();
    send(value);
  };

  return {
    push(value) {
      pending = { value };
      const wait = lastSent + intervalMs - clock.now();
      if (wait <= 0) flush();
      else if (timer === null) timer = clock.setTimeout(flush, wait);
    },
    flush,
    cancel() {
      if (timer !== null) clock.clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
