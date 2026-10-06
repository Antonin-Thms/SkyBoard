"use client";

import { Ellipsis } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  /** Trait de séparation avant cet élément */
  separator?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  /** Nom accessible du bouton */
  label: string;
  items: MenuItem[];
  /** Alignement du menu sous le bouton */
  align?: "start" | "end";
  /** Ouverture vers le bas (défaut) ou vers le haut (barre en bas d'écran) */
  side?: "bottom" | "top";
  /** Contenu du bouton (par défaut : ⋯) */
  trigger?: ReactNode;
  triggerClassName?: string;
}

/** Menu d'actions (bouton ⋯) : clavier, clic extérieur et Échap ferment. */
export function Menu({ label, items, align = "end", side = "bottom", trigger, triggerClassName = "btn-icon" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) buttons.current[active]?.focus();
  }, [open, active]);

  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const move = (dir: 1 | -1) => {
    const pos = enabled.indexOf(active);
    setActive(enabled[(pos + dir + enabled.length) % enabled.length] ?? 0);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={`${triggerClassName} ${open ? "bg-overlay text-fg" : ""}`}
        onClick={() => {
          setActive(enabled[0] ?? 0);
          setOpen((o) => !o);
        }}
      >
        {trigger ?? <Ellipsis size={18} strokeWidth={1.75} />}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className={`absolute z-40 min-w-52 ${side === "top" ? "bottom-full mb-1" : "top-full mt-1"} rounded-[4px] bg-overlay p-1.5 shadow-popover ${
            align === "end" ? "right-0" : "left-0"
          }`}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            } else if (e.key === "Escape" || e.key === "Tab") {
              setOpen(false);
            }
          }}
        >
          {items.map((it, i) => (
            <div key={it.label}>
              {it.separator && <div className="mx-1 my-1.5 h-px bg-line-strong" />}
              <button
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                tabIndex={i === active ? 0 : -1}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={`flex h-9 w-full items-center gap-2.5 rounded-[2px] px-2.5 text-left text-sm transition hover:bg-line-strong focus:bg-line-strong disabled:opacity-40 pointer-coarse:h-11 ${
                  it.danger ? "text-danger" : "text-fg [&>svg]:text-muted"
                }`}
              >
                {it.icon}
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
