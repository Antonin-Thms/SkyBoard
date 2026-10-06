"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  /** Intitulé de groupe (options consécutives du même groupe réunies) */
  group?: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Nom accessible (si pas de libellé visible associé) */
  label: string;
  /** Texte du bouton quand aucune option ne correspond */
  placeholder?: string;
  disabled?: boolean;
  /** Icône devant la valeur affichée */
  icon?: ReactNode;
  size?: "sm" | "md";
  /** « chip » : discret, sans bordure (méta d'une carte) */
  variant?: "field" | "chip";
  align?: "start" | "end";
  className?: string;
}

/**
 * Liste déroulante aux couleurs du thème (remplace les <select> natifs,
 * blancs sous Windows) : clavier ↑ ↓ Entrée Échap, clic extérieur ferme.
 */
export function Select({
  value,
  options,
  onChange,
  label,
  placeholder,
  disabled = false,
  icon,
  size = "md",
  variant = "field",
  align = "start",
  className = "",
}: SelectProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    list.current?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (i: number) => {
    const opt = options[i];
    setOpen(false);
    if (opt && opt.value !== value) onChange(opt.value);
  };

  const height = size === "sm" ? "h-8 text-[13px]" : "h-10 text-sm";
  const look =
    variant === "chip"
      ? `-ml-1.5 h-7 w-auto max-w-full gap-1.5 border-transparent bg-transparent px-1.5 text-xs text-subtle hover:bg-raised hover:text-fg pointer-coarse:h-10 ${open ? "bg-raised text-fg" : ""}`
      : `w-full gap-2 border bg-raised px-2.5 text-fg hover:border-muted pointer-coarse:h-12 ${height} ${open ? "border-accent" : "border-line-strong"}`;

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => {
          setActive(Math.max(0, options.findIndex((o) => o.value === value)));
          setOpen((o) => !o);
        }}
        className={`flex min-w-0 items-center rounded-[2px] border text-left transition duration-[120ms] disabled:cursor-not-allowed disabled:opacity-40 ${look}`}
      >
        {(selected?.icon ?? icon) && <span className="flex shrink-0 text-muted">{selected?.icon ?? icon}</span>}
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-subtle"}`}>{selected?.label ?? placeholder ?? t.common.choose}</span>
        <ChevronsUpDown size={variant === "chip" ? 12 : 14} strokeWidth={1.75} className="shrink-0 text-subtle" />
      </button>
      {open && (
        <div
          ref={list}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          className={`absolute top-full z-40 mt-1 max-h-80 min-w-full w-max max-w-80 overflow-y-auto rounded-[4px] bg-overlay p-1.5 shadow-popover outline-none ${
            align === "end" ? "right-0" : "left-0"
          }`}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(options.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              choose(active);
            } else if (e.key === "Escape" || e.key === "Tab") {
              setOpen(false);
            }
          }}
        >
          {options.map((o, i) => (
            <div key={o.value}>
              {o.group && o.group !== options[i - 1]?.group && (
                <div className={`label-caps px-2.5 pb-1 pt-2 ${i > 0 ? "mt-1.5 border-t border-line-strong" : ""}`}>
                  {o.group}
                </div>
              )}
              <div
                id={`${id}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex h-9 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-[2px] px-2.5 text-sm pointer-coarse:h-11 ${
                  o.value === value ? "bg-accent-subtle text-fg" : "text-fg"
                } ${i === active ? "outline outline-1 outline-line-strong bg-line-strong/60" : ""}`}
              >
                {o.icon && <span className={`flex shrink-0 ${o.value === value ? "text-accent" : "text-muted"}`}>{o.icon}</span>}
                <span className="flex-1">{o.label}</span>
                {o.value === value && <Check size={15} strokeWidth={2} className="shrink-0 text-accent" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
