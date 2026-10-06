import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  text?: string;
  action?: ReactNode;
}

/** État vide : pictogramme au trait (style de l'accueil), phrase, action. */
export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 border border-dashed border-line-strong px-6 py-10 text-center">
      <svg viewBox="0 0 64 64" className="mb-1 size-14" fill="none" strokeWidth="1.5" aria-hidden="true">
        <rect x="16" y="8" width="32" height="44" className="stroke-disabled" />
        <path d="M22 18h20M22 26h14M22 34h18" className="stroke-disabled" />
        <circle cx="46" cy="48" r="9" className="stroke-accent" />
        <path d="M46 44v8M42 48h8" className="stroke-accent" />
      </svg>
      <p className="text-[15px] font-medium">{title}</p>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
