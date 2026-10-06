export type ViewerStatus = "connecting" | "ok" | "degraded" | "error";

const STYLE: Record<ViewerStatus, { color: string; label: string }> = {
  connecting: { color: "bg-accent", label: "Connexion…" },
  ok: { color: "bg-success", label: "Connecté" },
  degraded: { color: "bg-accent", label: "Hors ligne (dernier état affiché)" },
  error: { color: "bg-danger", label: "Erreur" },
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
  const { color, label } = STYLE[status];
  if (status === "ok") {
    return (
      <div
        className="pointer-events-none fixed bottom-2.5 right-2.5 flex items-center gap-1.5 text-[11px] text-white/40"
        aria-live="polite"
        title={direct ? "Connecté · liaison directe avec la remote" : "Connecté"}
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
