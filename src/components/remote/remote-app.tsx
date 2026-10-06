"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import { HelpPanel } from "@/components/help-panel";
import { Select } from "@/components/ui/select";
import { useDeviceKind } from "@/hooks/use-device-kind";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { FolderSummary } from "@/lib/documents/folders";
import { GESTURE_CONFIG } from "@/lib/gestures/constants";
import { fmt } from "@/lib/i18n/define";
import { useLocale, useT } from "@/lib/i18n/client";
import type { RemoteCockpit, RemoteDocument } from "@/lib/remote/types";
import { CockpitRemote } from "./cockpit-remote";
import { RemoteQr } from "./remote-qr";

interface RemoteAppProps {
  cockpits: RemoteCockpit[];
  documents: RemoteDocument[];
  folders: FolderSummary[];
  /** Cockpit demandé par l'URL (QR code) */
  initialCockpitId: string | null;
  initialMode: "prep" | "flight";
}

export function RemoteApp({ cockpits, documents, folders, initialCockpitId, initialMode }: RemoteAppProps) {
  const [storedId, setStoredId] = useLocalStorage("skyboard:cockpit");
  const [mode, setMode] = useState<"prep" | "flight">(initialMode);
  const device = useDeviceKind();
  const t = useT().remote.app;
  const locale = useLocale();
  const holdSeconds = new Intl.NumberFormat(locale).format(GESTURE_CONFIG.penHoldMs / 1000);
  const cockpit =
    cockpits.find((c) => c.id === (initialCockpitId ?? storedId)) ??
    cockpits.find((c) => c.id === storedId) ??
    cockpits[0];

  // Ouverture par QR code : on mémorise le cockpit et on nettoie l'URL
  // (un rechargement ne doit pas forcer à nouveau le mode vol).
  useEffect(() => {
    if (initialCockpitId) setStoredId(initialCockpitId);
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [initialCockpitId, setStoredId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Select
          label={t.cockpit}
          value={cockpit.id}
          onChange={setStoredId}
          icon={<Plane size={15} strokeWidth={1.75} />}
          className="min-w-0 flex-1 sm:max-w-64"
          options={cockpits.map((c) => ({ value: c.id, label: c.name, icon: <Plane size={15} strokeWidth={1.75} /> }))}
        />

        <div className="flex shrink-0 rounded-[2px] border border-line-strong p-[3px] text-sm" role="tablist">
          {(
            [
              ["prep", t.modePrep],
              ["flight", t.modeFlight],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`h-[34px] rounded-[2px] px-3.5 transition sm:px-4 pointer-coarse:h-10 ${
                mode === value ? "bg-accent font-semibold text-on-accent" : "text-slate-300 hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {device === "desktop" ? (
        <RemoteQr key={cockpit.id} cockpitId={cockpit.id} cockpitName={cockpit.name} />
      ) : (
        device && (
          <details className="border border-line p-3 text-sm">
            <summary className="cursor-pointer text-muted">
              {t.openOnOtherDevice}
            </summary>
            <div className="mt-3">
              <RemoteQr key={cockpit.id} cockpitId={cockpit.id} cockpitName={cockpit.name} />
            </div>
          </details>
        )
      )}

      <HelpPanel defaultOpen={false}>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t.help.chooseCockpit}</li>
          <li>
            <strong>{t.help.prepTitle}</strong>
            {t.help.prepText}
          </li>
          <li>
            <strong>{t.help.flightTitle}</strong>
            {t.help.flightText}
            <ul className="mt-1 list-[circle] space-y-0.5 pl-5">
              <li>{t.help.pinch}</li>
              <li>{t.help.pan}</li>
              <li>{t.help.swipe}</li>
              <li>{t.help.doubleTap}</li>
              <li>{t.help.edges}</li>
              <li>{t.help.cursor}</li>
              <li>{fmt(t.help.pen, { s: holdSeconds })}</li>
            </ul>
          </li>
          <li>{t.help.status}</li>
        </ul>
      </HelpPanel>

      {documents.length === 0 ? (
        <p className="border border-dashed border-line-strong p-8 text-center text-muted">
          {t.noDocumentsBefore}
          <Link href="/documents" className="text-sky-400 hover:underline">
            {t.noDocumentsLink}
          </Link>
          {t.noDocumentsAfter}
        </p>
      ) : (
        <CockpitRemote
          key={cockpit.id}
          cockpit={cockpit}
          documents={documents}
          folders={folders}
          mode={mode}
          device={device ?? "tablet"}
          onExitFlight={() => setMode("prep")}
        />
      )}
    </div>
  );
}
