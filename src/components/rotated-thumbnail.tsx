import type { Rotation } from "@/lib/database.types";

interface RotatedThumbnailProps {
  src: string;
  rotation: Rotation;
  /** Rapport largeur / hauteur du cadre (3/4 pour les cartes) */
  frameRatio?: number;
}

/**
 * Miniature tournée qui reste entièrement visible dans son cadre : à 90° et
 * 270°, l'image est réduite pour que sa nouvelle largeur tienne.
 */
export function RotatedThumbnail({ src, rotation, frameRatio = 3 / 4 }: RotatedThumbnailProps) {
  const quarter = rotation % 180 !== 0;
  const scale = quarter ? Math.min(frameRatio, 1 / frameRatio) : 1;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase
    <img
      src={src}
      alt=""
      draggable={false}
      className="h-full w-full object-contain transition-transform duration-200"
      style={rotation ? { transform: `rotate(${rotation}deg) scale(${scale})` } : undefined}
    />
  );
}
