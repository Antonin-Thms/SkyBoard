import { parseGeneratedSource } from "@/lib/documents/generated";
import type { RtbaRow } from "@/lib/documents/tactical";

/**
 * Waypoints RTBA de la fiche tactique du vol : une fiche par vol, la plus
 * récente parmi les documents du cockpit. Null s'il n'y en a pas (ou sans
 * section RTBA).
 */
export function flightRtba(docs: { source: unknown; created_at: string }[]): RtbaRow[] | null {
  let best: { rows: RtbaRow[]; at: string } | null = null;
  for (const d of docs) {
    const parsed = parseGeneratedSource(d.source);
    if (parsed?.kind !== "tactical" || !parsed.rtba.length) continue;
    if (!best || d.created_at > best.at) best = { rows: parsed.rtba, at: d.created_at };
  }
  return best?.rows ?? null;
}
