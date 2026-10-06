export type StatusTone = "ok" | "pending" | "error";

const TONE: Record<StatusTone, string> = {
  ok: "bg-success",
  pending: "bg-accent",
  error: "bg-danger",
};

/** Pastille d'état : un seul jeu de couleurs dans toute l'application. */
export function StatusDot({ tone, className = "" }: { tone: StatusTone; className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${TONE[tone]} ${className}`} />;
}
