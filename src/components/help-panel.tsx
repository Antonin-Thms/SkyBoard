import type { ReactNode } from "react";

/** Encadré d'aide repliable. */
interface HelpPanelProps {
  title?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function HelpPanel({ title = "Mode d'emploi", defaultOpen = true, children }: HelpPanelProps) {
  return (
    <details open={defaultOpen} className="group border border-slate-800 p-4 text-sm text-slate-300">
      <summary className="cursor-pointer select-none font-medium text-slate-200">
        {title}
        <span className="ml-2 text-xs font-normal text-slate-500 group-open:hidden">(cliquer pour afficher)</span>
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}
