import { ChevronDown, CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

/** Encadré d'aide repliable. */
interface HelpPanelProps {
  title?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function HelpPanel({ title = "Mode d'emploi", defaultOpen = true, children }: HelpPanelProps) {
  return (
    <details open={defaultOpen} className="group border border-line text-sm text-slate-300">
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-4 py-3 font-medium text-slate-200 [&::-webkit-details-marker]:hidden">
        <CircleHelp size={16} strokeWidth={1.75} className="text-muted" />
        <span className="flex-1">{title}</span>
        <ChevronDown size={16} strokeWidth={1.75} className="text-subtle transition group-open:rotate-180" />
      </summary>
      <div className="space-y-2 px-4 pb-4">{children}</div>
    </details>
  );
}
