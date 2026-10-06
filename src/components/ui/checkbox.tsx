"use client";

import { Check, Minus } from "lucide-react";
import type { MouseEvent } from "react";

interface CheckboxProps {
  checked: boolean;
  /** Une partie seulement est cochée (« tout sélectionner ») */
  indeterminate?: boolean;
  onToggle: (e: MouseEvent<HTMLButtonElement>) => void;
  label: string;
  /** Libellé visible à côté de la case */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Case à cocher unique de l'application : un bouton (et non un input natif)
 * dont l'affichage dépend seulement de l'état React.
 */
export function Checkbox({ checked, indeterminate = false, onToggle, label, children, className = "" }: CheckboxProps) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={children ? undefined : label}
      onClick={onToggle}
      className={`inline-flex items-center gap-2.5 text-sm ${className}`}
    >
      <span
        className={`flex size-[18px] shrink-0 items-center justify-center rounded-[2px] border-[1.5px] transition duration-[120ms] ${
          on ? "border-accent bg-accent text-on-accent" : "border-muted bg-sunken/70 text-transparent"
        }`}
      >
        {indeterminate ? <Minus size={13} strokeWidth={3} /> : <Check size={13} strokeWidth={3} />}
      </span>
      {children}
    </button>
  );
}
