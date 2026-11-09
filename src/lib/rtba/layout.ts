/**
 * Géométrie de la planche RTBA (unités de page A4 : 1240 × 1754), commune au
 * rendu de l'image et au calque du viewer qui y écrit le slot et les heures.
 */
import { SLOT_DIGITS } from "./model";

export const RTBA_PAGE = { width: 1240, height: 1754 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RtbaLayout {
  title: { x: number; y: number; w: number };
  slotLabel: { x: number; y: number };
  boxes: Rect[];
  colons: { x: number; y: number }[];
  table: {
    x: number;
    y: number;
    w: number;
    headH: number;
    rowH: number;
    /** Colonnes : waypoint, T+, TOT */
    cols: { x: number; w: number }[];
  };
}

const MARGIN = 70;
const BOX = { w: 120, h: 150, inner: 16, colon: 70 };
const TABLE_TOP = 450;
const HEAD_H = 70;

export function rtbaLayout(rows: number): RtbaLayout {
  const total = SLOT_DIGITS * BOX.w + 3 * BOX.inner + 2 * BOX.colon;
  let x = (RTBA_PAGE.width - total) / 2;
  const top = 250;
  const boxes: Rect[] = [];
  const colons: { x: number; y: number }[] = [];
  for (let i = 0; i < SLOT_DIGITS; i++) {
    boxes.push({ x, y: top, w: BOX.w, h: BOX.h });
    x += BOX.w;
    if (i % 2 === 0) x += BOX.inner;
    else if (i < SLOT_DIGITS - 1) {
      colons.push({ x: x + BOX.colon / 2, y: top + BOX.h / 2 });
      x += BOX.colon;
    }
  }
  const width = RTBA_PAGE.width - 2 * MARGIN;
  const available = RTBA_PAGE.height - 50 - TABLE_TOP - HEAD_H;
  const rowH = Math.min(110, available / Math.max(1, rows));
  const fractions = [0.36, 0.24, 0.4];
  let cx = MARGIN;
  const cols = fractions.map((f) => {
    const col = { x: cx, w: f * width };
    cx += col.w;
    return col;
  });
  return {
    title: { x: MARGIN, y: MARGIN + 50, w: width },
    slotLabel: { x: RTBA_PAGE.width / 2, y: top - 40 },
    boxes,
    colons,
    table: { x: MARGIN, y: TABLE_TOP, w: width, headH: HEAD_H, rowH, cols },
  };
}
