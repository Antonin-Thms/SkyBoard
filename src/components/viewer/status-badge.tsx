export type ViewerStatus = "connecting" | "ok" | "degraded" | "error";

const STYLE: Record<ViewerStatus, { color: string; label: string }> = {
  connecting: { color: "bg-amber-400", label: "Connexion…" },
  ok: { color: "bg-emerald-400", label: "Connecté" },
  degraded: { color: "bg-amber-400", label: "Hors ligne (dernier état affiché)" },
  error: { color: "bg-red-500", label: "Erreur" },
};

/** Petit indicateur discret dans un coin (masquable via ?status=0). */
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
  return (
    <div
      className="pointer-events-none fixed bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white/70"
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {status !== "ok" && <span>{detail ?? label}</span>}
      {status === "ok" && direct && <span title="Liaison directe avec la remote (réseau local)">LAN</span>}
    </div>
  );
}
