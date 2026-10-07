import { useT } from "@/lib/i18n/client";

interface ViewerHelpProps {
  cockpitName: string | null;
  docName: string | null;
  page: number;
  pageCount: number;
  docIndex: number;
  docCount: number;
}

const Key = ({ children }: { children: string }) => (
  <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-xs">{children}</kbd>
);

/** Légende du viewer (touche H). Jamais affichée sans action : rien ne s'impose dans le casque. */
export function ViewerHelp(props: ViewerHelpProps) {
  const t = useT().viewer.help;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-[4px] border border-white/10 bg-raised/95 p-5 text-sm text-slate-200 shadow-2xl">
        <div>
          <h2 className="text-lg font-semibold">SkyBoard Viewer</h2>
          <p className="text-slate-400">{t.intro}</p>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-slate-400">{t.cockpit}</dt>
          <dd>{props.cockpitName ?? "—"}</dd>
          <dt className="text-slate-400">{t.document}</dt>
          <dd>
            {props.docName ? `${props.docName} (${props.docIndex + 1}/${props.docCount})` : "—"}
          </dd>
          <dt className="text-slate-400">{t.page}</dt>
          <dd>{props.docName ? `${props.page} / ${props.pageCount}` : "—"}</dd>
        </dl>

        <div className="space-y-1">
          <h3 className="font-medium">{t.keyboardTitle}</h3>
          <p>
            <Key>←</Key> <Key>→</Key> {t.prevNextDocument}
          </p>
          <p>
            <Key>↑</Key> <Key>↓</Key> {t.prevNextPage}
          </p>
          <p>
            <Key>H</Key> {t.toggleHelp}
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium">{t.indicatorTitle}</h3>
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" /> {t.indicatorConnected}
            <span className="ml-3 h-2 w-2 rounded-full bg-accent" /> {t.indicatorConnecting}
            <span className="ml-3 h-2 w-2 rounded-full bg-red-500" /> {t.indicatorError}
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium">{t.urlOptionsTitle}</h3>
          <ul className="space-y-0.5">
            <li>
              <code className="whitespace-nowrap">?transparent=0</code> {t.optionTransparent}
            </li>
            <li>
              <code className="whitespace-nowrap">?status=0</code> {t.optionNoStatus}
            </li>
            <li>
              <code className="whitespace-nowrap">?cursor=0</code> {t.optionNoCursor}
            </li>
          </ul>
          <p className="text-slate-400">{t.urlOptionsNote}</p>
        </div>
      </div>
    </div>
  );
}
