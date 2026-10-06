import type { LinkStatus } from "@/lib/sync/cockpit-link";

const STYLE: Record<LinkStatus, { color: string; label: string }> = {
  connecting: { color: "bg-amber-400", label: "Connexion au temps réel…" },
  connected: { color: "bg-emerald-400", label: "Connecté" },
  disconnected: { color: "bg-amber-400", label: "Déconnecté, reconnexion automatique…" },
};

export function SyncStatus({ status }: { status: LinkStatus }) {
  const { color, label } = STYLE[status];
  return (
    <p className="flex items-center gap-2 text-sm text-slate-400" aria-live="polite">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </p>
  );
}
