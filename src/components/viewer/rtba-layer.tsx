"use client";

import { memo } from "react";
import type { Rotation } from "@/lib/database.types";
import { RTBA_PAGE, rtbaLayout } from "@/lib/rtba/layout";
import { EMPTY, passTimes, slotSeconds, type RtbaSlot } from "@/lib/rtba/model";
import type { Size } from "@/lib/viewer/fit";

interface RtbaLayerProps {
  rows: { wp: string; offset: string }[];
  /** Slot réglé depuis la remote (null : jamais réglé) */
  slot: RtbaSlot | null;
  rotation: Rotation;
  /** Taille d'affichage de la page (px CSS, avant zoom, page tournée) */
  size: Size;
}

/**
 * Calque de la planche RTBA : chiffres du slot dans leurs cases (case en
 * cours de réglage surlignée) et heures de passage dans la colonne TOT.
 * Dessiné dans le repère de la page, tourné comme elle.
 */
export const RtbaLayer = memo(function RtbaLayer({ rows, slot, rotation, size }: RtbaLayerProps) {
  if (size.width <= 0 || size.height <= 0) return null;
  const g = rtbaLayout(rows.length);
  const digits = slot?.digits ?? [];
  const times = passTimes(slotSeconds(digits), rows.map((r) => r.offset));
  const turned = rotation === 90 || rotation === 270;
  // Repère du document (avant rotation) : largeur / hauteur échangées si la page est tournée d'un quart.
  const width = turned ? size.height : size.width;
  const height = turned ? size.width : size.height;
  const t = g.table;
  const tot = t.cols[2];
  const font = Math.round(Math.min(52, t.rowH * 0.58));

  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{ width, height, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      viewBox={`0 0 ${RTBA_PAGE.width} ${RTBA_PAGE.height}`}
      aria-hidden="true"
    >
      {g.boxes.map((b, i) => (
        <g key={i}>
          {slot?.edit === i && (
            <rect
              x={b.x - 6}
              y={b.y - 6}
              width={b.w + 12}
              height={b.h + 12}
              fill="rgba(245,166,35,0.25)"
              stroke="#f5a623"
              strokeWidth={10}
            />
          )}
          {digits[i] !== undefined && digits[i] !== EMPTY && (
            <text
              x={b.x + b.w / 2}
              y={b.y + b.h / 2 + 4}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="sans-serif"
              fontWeight={700}
              fontSize={110}
              fill="#111111"
            >
              {digits[i]}
            </text>
          )}
        </g>
      ))}
      {times.map((time, i) =>
        time ? (
          <text
            key={i}
            x={tot.x + tot.w / 2}
            y={t.y + t.headH + i * t.rowH + t.rowH / 2 + 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="sans-serif"
            fontWeight={700}
            fontSize={font}
            fill="#0b4fa8"
          >
            {time}
          </text>
        ) : null,
      )}
    </svg>
  );
});
