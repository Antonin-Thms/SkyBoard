"use client";

import { useEffect, useState, useTransition } from "react";
import { createRemoteLink } from "@/app/(app)/remote/actions";
import { fmt } from "@/lib/i18n/define";
import { useT } from "@/lib/i18n/client";

/** Le QR code est masqué quand son code de jumelage expire. */
const QR_VISIBLE_MS = 2 * 60 * 1000;

interface RemoteQrProps {
  cockpitId: string;
  cockpitName: string;
}

/** QR code affiché sur le PC : scanné avec une tablette ou un téléphone, il ouvre directement le mode vol. */
export function RemoteQr({ cockpitId, cockpitName }: RemoteQrProps) {
  const [autoLogin, setAutoLogin] = useState(true);
  const [qr, setQr] = useState<{ svg: string; autoLogin: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tr = useT().remote;
  const t = tr.qr;

  // Masque le QR code après un délai, et dès qu'on change de cockpit.
  useEffect(() => {
    if (!qr) return;
    const t = setTimeout(() => setQr(null), QR_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [qr]);

  const generate = () =>
    startTransition(async () => {
      const res = await createRemoteLink(cockpitId, autoLogin);
      if (!res.url) {
        setError(res.error ?? tr.errors.qrFailed);
        setQr(null);
        return;
      }
      setError(null);
      // Bibliothèque chargée à la demande (absente du bundle initial de la remote).
      const { default: QRCode } = await import("qrcode");
      const svg = await QRCode.toString(res.url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      setQr({ svg, autoLogin: !!res.autoLogin });
    });

  return (
    <div className="flex flex-wrap items-start gap-4 border border-line bg-raised p-4">
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <h2 className="font-medium text-slate-200">{t.title}</h2>
        <p className="text-slate-400">
          {fmt(t.text, { name: cockpitName })}
        </p>
        <label className="flex items-start gap-2 text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={autoLogin}
            onChange={(e) => {
              setAutoLogin(e.target.checked);
              setQr(null);
            }}
          />
          <span>
            {t.autoLogin}
            <span className="block text-xs text-slate-500">{t.autoLoginHint}</span>
          </span>
        </label>
        <button type="button" className="btn-primary" onClick={generate} disabled={pending}>
          {pending ? t.generating : qr ? t.regenerate : t.show}
        </button>
        {error && <p className="text-danger">{error}</p>}
      </div>
      {qr && (
        <div className="space-y-1 text-center">
          <div
            className="h-48 w-48 rounded-[4px] bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            // SVG généré localement par la bibliothèque qrcode à partir de notre URL.
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
          <p className="text-xs text-slate-500">{qr.autoLogin ? t.singleUse : t.loginRequired}</p>
        </div>
      )}
    </div>
  );
}
