import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import type { LinkStatus } from "@/lib/sync/cockpit-link";

const STYLE: Record<LinkStatus, { tone: StatusTone; label: string }> = {
  connecting: { tone: "pending", label: "Connexion au temps réel…" },
  connected: { tone: "ok", label: "Connecté" },
  disconnected: { tone: "pending", label: "Reconnexion automatique…" },
};

export function SyncStatus({ status, direct = false }: { status: LinkStatus; direct?: boolean }) {
  const { tone, label } = STYLE[status];
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted" aria-live="polite">
      <StatusDot tone={tone} />
      {label}
      {status === "connected" && direct && (
        <span title="Les gestes passent directement par le wifi, sans le cloud">· liaison directe</span>
      )}
    </p>
  );
}
