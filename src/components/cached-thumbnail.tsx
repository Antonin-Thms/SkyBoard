"use client";

import { useEffect, useState } from "react";
import type { Rotation } from "@/lib/database.types";
import { loadThumbnail, peekThumbnail } from "@/lib/documents/thumb-cache";
import { RotatedThumbnail } from "./rotated-thumbnail";

interface CachedThumbnailProps {
  docId: string;
  url: string;
  rotation: Rotation;
}

/** Miniature servie depuis le cache navigateur (instantanée après le premier affichage). */
export function CachedThumbnail({ docId, url, rotation }: CachedThumbnailProps) {
  const [src, setSrc] = useState<string | undefined>(() => peekThumbnail(docId));

  useEffect(() => {
    if (src) return;
    let alive = true;
    loadThumbnail(docId, url)
      .then((local) => alive && setSrc(local))
      // Cache indisponible ou erreur : on affiche l'URL signée directement.
      .catch(() => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [docId, url, src]);

  if (!src) return null;
  return <RotatedThumbnail src={src} rotation={rotation} />;
}
