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
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-slate-900/95 p-5 text-sm text-slate-200 shadow-2xl">
        <div>
          <h2 className="text-lg font-semibold">SkyBoard Viewer</h2>
          <p className="text-slate-400">
            Page affichée dans OpenKneeboard (onglet Web Dashboard). Elle se pilote depuis la
            télécommande ; le clavier sert seulement à tester sur PC.
          </p>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-slate-400">Cockpit</dt>
          <dd>{props.cockpitName ?? "—"}</dd>
          <dt className="text-slate-400">Document</dt>
          <dd>
            {props.docName ? `${props.docName} (${props.docIndex + 1}/${props.docCount})` : "—"}
          </dd>
          <dt className="text-slate-400">Page</dt>
          <dd>{props.docName ? `${props.page} / ${props.pageCount}` : "—"}</dd>
        </dl>

        <div className="space-y-1">
          <h3 className="font-medium">Clavier (test)</h3>
          <p>
            <Key>←</Key> <Key>→</Key> page précédente / suivante
          </p>
          <p>
            <Key>↑</Key> <Key>↓</Key> document précédent / suivant
          </p>
          <p>
            <Key>H</Key> afficher / masquer cette aide
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium">Indicateur (coin bas droit)</h3>
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> connecté
            <span className="ml-3 h-2 w-2 rounded-full bg-amber-400" /> connexion / hors ligne
            <span className="ml-3 h-2 w-2 rounded-full bg-red-500" /> erreur
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium">Options d&apos;URL</h3>
          <ul className="space-y-0.5">
            <li>
              <code className="whitespace-nowrap">?transparent=1</code> fond transparent
            </li>
            <li>
              <code className="whitespace-nowrap">?status=0</code> sans indicateur
            </li>
            <li>
              <code className="whitespace-nowrap">?cursor=0</code> jamais de curseur
            </li>
          </ul>
          <p className="text-slate-400">Facultatives, à ajouter à la main à la fin de l&apos;URL.</p>
        </div>
      </div>
    </div>
  );
}
