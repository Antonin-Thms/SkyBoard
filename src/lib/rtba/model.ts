/**
 * Planche RTBA : slot T0 en 6 chiffres (HH MM SS), réglé en vol au doigt,
 * et heures de passage aux waypoints calculées à partir des temps de
 * branche (T+) : WP0 = T0 + T+0, WPn = WPn-1 + T+n.
 */

/** Chiffre vide (pas encore réglé). */
export const EMPTY = -1;
export const SLOT_DIGITS = 6;

/** Valeur max de chaque chiffre HH MM SS (dizaines des heures : 0-2…). */
function maxDigit(digits: number[], i: number): number {
  switch (i) {
    case 0:
      return 2;
    case 1:
      return digits[0] === 2 ? 3 : 9;
    case 2:
    case 4:
      return 5;
    default:
      return 9;
  }
}

/** Chiffre i augmenté / diminué de `delta` (boucle dans ses bornes ; vide → 0 ou max). */
export function stepDigit(digits: number[], i: number, delta: 1 | -1): number[] {
  const next = [...digits];
  const max = maxDigit(digits, i);
  const cur = digits[i];
  next[i] = cur === EMPTY ? (delta > 0 ? 0 : max) : (((cur + delta) % (max + 1)) + max + 1) % (max + 1);
  // Heures 2x : l'unité ne peut pas dépasser 3.
  if (i === 0 && next[0] === 2 && next[1] > 3) next[1] = 3;
  return next;
}

/** Secondes depuis minuit du slot, ou null s'il n'est pas complet. */
export function slotSeconds(digits: number[]): number | null {
  if (digits.length !== SLOT_DIGITS || digits.some((d) => d === EMPTY)) return null;
  const [h1, h2, m1, m2, s1, s2] = digits;
  const h = h1 * 10 + h2;
  const m = m1 * 10 + m2;
  const s = s1 * 10 + s2;
  if (h > 23 || m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * Temps de branche (T+) en secondes : « 1:35 », « 01:35 », « 1:02:30 »,
 * « +1:35 » ou un nombre de secondes. null si illisible.
 */
export function parseLeg(text: string): number | null {
  const t = text.trim().replace(/^\+/, "");
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const [, h, min, s] = m;
  if (Number(s) > 59 || (h !== undefined && Number(min) > 59)) return null;
  return (Number(h ?? 0) * 60 + Number(min)) * 60 + Number(s);
}

/** « HH:MM:SS » (boucle sur 24 h). */
export function formatTime(seconds: number): string {
  const s = ((Math.round(seconds) % 86400) + 86400) % 86400;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * Heures de passage : cumul des T+ depuis le slot. Un T+ illisible laisse
 * sa ligne (et les suivantes) vide.
 */
export function passTimes(slot: number | null, legs: string[]): string[] {
  if (slot === null) return legs.map(() => "");
  let t = slot;
  let broken = false;
  return legs.map((leg) => {
    const s = parseLeg(leg);
    if (s === null || broken) {
      broken = true;
      return "";
    }
    t += s;
    return formatTime(t);
  });
}

/** Réglage en cours : chiffre édité (null : pas d'édition). */
export interface RtbaSlot {
  /** Document RTBA auquel le slot appartient */
  docId: string;
  /** 6 chiffres HH MM SS (EMPTY si non réglé) */
  digits: number[];
  /** Index du chiffre en cours de réglage, null hors réglage */
  edit: number | null;
}

export const emptyDigits = () => Array<number>(SLOT_DIGITS).fill(EMPTY);

/** Lecture prudente (état reçu du réseau ou de la base). */
export function parseSlot(value: unknown): RtbaSlot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.docId !== "string" || v.docId.length > 64) return null;
  if (!Array.isArray(v.digits) || v.digits.length !== SLOT_DIGITS) return null;
  if (!v.digits.every((d) => Number.isInteger(d) && d >= EMPTY && d <= 9)) return null;
  const edit = v.edit === null || v.edit === undefined ? null : v.edit;
  if (edit !== null && !(Number.isInteger(edit) && (edit as number) >= 0 && (edit as number) < SLOT_DIGITS)) return null;
  return { docId: v.docId, digits: v.digits as number[], edit: edit as number | null };
}
