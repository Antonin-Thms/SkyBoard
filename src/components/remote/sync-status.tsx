"use client";

import { StatusDot, type StatusTone } from "@/components/ui/status-dot";
import { useT } from "@/lib/i18n/client";
import type { LinkStatus } from "@/lib/sync/cockpit-link";

const TONE: Record<LinkStatus, StatusTone> = {
  connecting: "pending",
  connected: "ok",
  disconnected: "pending",
};

export function SyncStatus({ status, direct = false }: { status: LinkStatus; direct?: boolean }) {
  const t = useT().remote.sync;
  const tone = TONE[status];
  const label = t[status];
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted" aria-live="polite">
      <StatusDot tone={tone} />
      {label}
      {status === "connected" && direct && (
        <span title={t.directTitle}>{t.direct}</span>
      )}
    </p>
  );
}
