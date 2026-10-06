"use client";

import { memo } from "react";
import { toDisplayPoint, type Stroke } from "@/lib/annotations/model";
import type { Rotation } from "@/lib/database.types";
import type { Size } from "@/lib/viewer/fit";

interface InkLayerProps {
  strokes: Stroke[];
  rotation: Rotation;
  /** Taille d'affichage de la page (px CSS, avant zoom) */
  size: Size;
}

/** Tracé SVG d'un trait dans le repère affiché (page tournée). */
function strokePath(points: number[], rotation: Rotation, size: Size): string {
  let d = "";
  for (let i = 0; i < points.length; i += 2) {
    const p = toDisplayPoint({ x: points[i], y: points[i + 1] }, rotation);
    const x = (p.x * size.width).toFixed(1);
    const y = (p.y * size.height).toFixed(1);
    d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
  }
  // Un seul point : segment nul, dessiné comme un point par l'extrémité ronde.
  if (points.length === 2) d += d.replace("M", " L");
  return d;
}

/**
 * Calque des annotations, superposé à la page (suit zoom et déplacement
 * avec elle). Vectoriel : net à tout niveau de zoom. L'épaisseur est une
 * fraction du petit côté de la page, comme de l'encre sur le papier.
 */
export const InkLayer = memo(function InkLayer({ strokes, rotation, size }: InkLayerProps) {
  if (!strokes.length || size.width <= 0 || size.height <= 0) return null;
  const unit = Math.min(size.width, size.height);
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${size.width} ${size.height}`}
      aria-hidden="true"
    >
      {strokes.map((s) => (
        <path
          key={s.id}
          d={strokePath(s.points, rotation, size)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width * unit}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
});
