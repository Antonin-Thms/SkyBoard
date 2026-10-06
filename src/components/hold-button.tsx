"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface HoldButtonProps {
  /** Durée d'appui nécessaire (ms) */
  holdMs?: number;
  onHold: () => void;
  className?: string;
  /** Texte pour les lecteurs d'écran (le clavier déclenche directement) */
  label: string;
  children: ReactNode;
}

/**
 * Bouton à maintenir enfoncé : un simple tap (doigt qui cherche le bord de
 * l'écran sans regarder) ne le déclenche pas. Une barre se remplit pendant
 * l'appui ; relâcher avant la fin annule.
 */
export function HoldButton({ holdMs = 800, onHold, className = "", label, children }: HoldButtonProps) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onHoldRef = useRef(onHold);
  useEffect(() => {
    onHoldRef.current = onHold;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const start = () => {
    clearTimeout(timer.current);
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      onHoldRef.current();
    }, holdMs);
  };
  const stop = () => {
    clearTimeout(timer.current);
    setHolding(false);
  };

  return (
    <button
      type="button"
      aria-label={label}
      className={`relative overflow-hidden ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      // Clavier : Entrée / Espace déclenchent directement (pas de risque de tap accidentel).
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHoldRef.current();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-sky-500/30"
        style={{
          width: holding ? "100%" : "0%",
          transition: holding ? `width ${holdMs}ms linear` : "none",
        }}
      />
      <span className="relative">{children}</span>
    </button>
  );
}
