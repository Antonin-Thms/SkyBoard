import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Petit libellé de contexte au-dessus du titre */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Boutons alignés à droite du titre */
  actions?: ReactNode;
}

/** En-tête commun à toutes les pages : contexte, titre, description, actions. */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <div className="label-caps">{eyebrow}</div>}
        <h1 className="mt-1.5 text-[26px] font-medium leading-[1.15] md:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
