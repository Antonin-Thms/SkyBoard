"use client";

import { memo } from "react";
import type { Rotation } from "@/lib/database.types";
import { RTBA_PAGE, rtbaLayout } from "@/lib/rtba/layout";
import { EMPTY, passTimes, slotSeconds, type RtbaSlot } from "@/lib/rtba/model";
import type { Size } from "@/lib/viewer/fit";

interface RtbaLayerProps {
  rows: { wp: string; offset: string }[];
  /** En-tête de la première colonne (langue de l'interface) */
  waypointLabel: string;
  /** Slot réglé depuis la remote (null : jamais réglé) */
  slot: RtbaSlot | null;
  rotation: Rotation;
  /** Taille d'affichage de la page (px CSS, avant zoom, page tournée) */
  size: Size;
}

/**
 * Calque de la planche RTBA : chiffres du slot dans leurs cases (case en
 * cours de réglage surlignée) et tableau des waypoints redessiné avec les
 * valeurs à jour (fiche tactique du vol), heures de passage comprises. Il
 * recouvre le tableau de l'image, figé à la création de la planche.
 * Dessiné dans le repère de la page, tourné comme elle.
 */
export const RtbaLayer = memo(function RtbaLayer({ rows, waypointLabel, slot, rotation, size }: RtbaLayerProps) {
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
  const font = Math.round(Math.min(48, t.rowH * 0.55));
  const bottom = t.y + t.headH + rows.length * t.rowH;
  const mid = (i: number) => t.y + t.headH + i * t.rowH + t.rowH / 2 + 2;

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
      {/* Tableau à jour par-dessus celui de l'image */}
      <rect x={t.x - 4} y={t.y - 4} width={t.w + 8} height={RTBA_PAGE.height - 40 - t.y} fill="#ffffff" />
      <rect x={t.x} y={t.y} width={t.w} height={t.headH} fill="#4a4a4a" />
      {[waypointLabel, "T+", "TOT"].map((text, i) => (
        <text
          key={text}
          x={t.cols[i].x + t.cols[i].w / 2}
          y={t.y + t.headH / 2 + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="sans-serif"
          fontWeight={700}
          fontSize={32}
          fill="#ffffff"
        >
          {text}
        </text>
      ))}
      {rows.map((r, i) => (
        <g key={i}>
          <rect x={t.cols[0].x} y={mid(i) - 2 - t.rowH / 2} width={t.cols[0].w + t.cols[1].w} height={t.rowH} fill="#fdf1d6" />
          <text x={t.cols[0].x + 18} y={mid(i)} dominantBaseline="middle" fontFamily="sans-serif" fontWeight={600} fontSize={font} fill="#111111">
            {r.wp}
          </text>
          <text
            x={t.cols[1].x + t.cols[1].w / 2}
            y={mid(i)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="sans-serif"
            fontWeight={700}
            fontSize={font}
            fill="#111111"
          >
            {r.offset}
          </text>
        </g>
      ))}
      <g stroke="#2a2a2a" strokeWidth={3} fill="none">
        <rect x={t.x} y={t.y} width={t.w} height={bottom - t.y} />
        {rows.map((_, i) => (
          <line key={i} x1={t.x} x2={t.x + t.w} y1={t.y + t.headH + i * t.rowH} y2={t.y + t.headH + i * t.rowH} />
        ))}
        {t.cols.slice(1).map((c) => (
          <line key={c.x} x1={c.x} x2={c.x} y1={t.y} y2={bottom} />
        ))}
      </g>
      {times.map((time, i) =>
        time ? (
          <text
            key={i}
            x={tot.x + tot.w / 2}
            y={mid(i)}
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
