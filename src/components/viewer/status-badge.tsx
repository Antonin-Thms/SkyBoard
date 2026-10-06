import { useT } from "@/lib/i18n/client";

export type ViewerStatus = "connecting" | "ok" | "degraded" | "error";

const COLOR: Record<ViewerStatus, string> = {
  connecting: "bg-accent",
  ok: "bg-success",
  degraded: "bg-accent",
  error: "bg-danger",
};

/**
 * Indicateur discret dans un coin (masquable via ?status=0). Tout va bien :
 * un simple point estompé. Sinon, un texte lisible dans le casque (14 px).
 */
export function StatusBadge({
  status,
  detail,
  direct = false,
}: {
  status: ViewerStatus;
  detail?: string | null;
  /** Liaison directe avec la remote (réseau local) */
  direct?: boolean;
}) {
  const t = useT().viewer.status;
  const color = COLOR[status];
  const label = t[status];
  if (status === "ok") {
    return (
      <div
        className="pointer-events-none fixed bottom-2.5 right-2.5 flex items-center gap-1.5 text-[11px] text-white/40"
        aria-live="polite"
        title={direct ? t.okDirect : t.ok}
      >
        {direct && <span className="font-condensed font-semibold tracking-widest">LAN</span>}
        <span className={`size-1.5 rounded-full opacity-40 ${color}`} />
      </div>
    );
  }
  return (
    <div
      className="pointer-events-none fixed bottom-2 right-2 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm text-white/90"
      aria-live="polite"
    >
      <span className={`size-2 rounded-full ${color}`} />
      <span>{detail ?? label}</span>
    </div>
  );
}
