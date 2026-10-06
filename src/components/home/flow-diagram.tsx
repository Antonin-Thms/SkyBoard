/**
 * Schéma du fonctionnement : le PC envoie les documents, l'iPad pilote,
 * SkyBoard synchronise, le casque affiche. Version large (SVG) sur
 * ordinateur, liste verticale sur téléphone.
 */
export function FlowDiagram() {
  return (
    <>
      <svg
        viewBox="0 0 960 380"
        className="hidden w-full md:block"
        role="img"
        aria-label="Le PC envoie les documents à SkyBoard, l'iPad envoie les gestes, SkyBoard affiche le kneeboard dans le casque via OpenKneeboard."
        fontFamily="inherit"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="fill-slate-400" />
          </marker>
          <marker id="arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="fill-sky-500" />
          </marker>
        </defs>

        {/* Liaisons */}
        <g fill="none" strokeWidth="2">
          <path d="M228 110 H382" className="stroke-slate-500" markerEnd="url(#arrow)" />
          <path d="M578 110 H732" className="stroke-sky-500" markerEnd="url(#arrow-accent)" />
          <path d="M480 262 V178" className="stroke-sky-500" strokeDasharray="6 6" markerEnd="url(#arrow-accent)" />
        </g>
        <g fontSize="13" className="fill-slate-400" textAnchor="middle">
          <text x="305" y="96">fichiers</text>
          <text x="655" y="96">affichage</text>
          <text x="560" y="224">gestes, page, zoom</text>
          <text x="560" y="242" className="fill-slate-500">temps réel</text>
        </g>

        {/* PC */}
        <g>
          <rect x="70" y="58" width="150" height="100" rx="6" className="fill-slate-900 stroke-slate-600" strokeWidth="2" />
          <rect x="84" y="72" width="122" height="72" className="fill-slate-800" />
          <path d="M96 90 H160 M96 104 H184 M96 118 H150" className="stroke-slate-500" strokeWidth="3" />
          <path d="M145 158 V174 M115 176 H175" className="stroke-slate-600" strokeWidth="3" />
          <text x="145" y="206" textAnchor="middle" fontSize="16" className="fill-slate-100" fontWeight="600">PC</text>
          <text x="145" y="226" textAnchor="middle" fontSize="13" className="fill-slate-400">Documents · Cockpits</text>
        </g>

        {/* SkyBoard */}
        <g>
          <rect x="390" y="56" width="180" height="108" rx="6" className="fill-slate-900 stroke-sky-500" strokeWidth="2" />
          <circle cx="480" cy="96" r="6" className="fill-sky-500" />
          <text x="480" y="128" textAnchor="middle" fontSize="18" letterSpacing="4" className="fill-slate-100" fontWeight="600">SKYBOARD</text>
          <text x="480" y="148" textAnchor="middle" fontSize="12" className="fill-slate-400">stockage · synchro</text>
        </g>

        {/* Casque */}
        <g>
          <rect x="740" y="74" width="150" height="72" rx="20" className="fill-slate-900 stroke-slate-600" strokeWidth="2" />
          <circle cx="784" cy="110" r="18" className="fill-slate-800 stroke-slate-500" strokeWidth="2" />
          <circle cx="846" cy="110" r="18" className="fill-slate-800 stroke-slate-500" strokeWidth="2" />
          <rect x="772" y="98" width="24" height="24" className="fill-sky-500/80" />
          <text x="815" y="206" textAnchor="middle" fontSize="16" className="fill-slate-100" fontWeight="600">Casque VR</text>
          <text x="815" y="226" textAnchor="middle" fontSize="13" className="fill-slate-400">OpenKneeboard · Web Dashboard</text>
        </g>

        {/* iPad */}
        <g>
          <rect x="420" y="268" width="120" height="86" rx="8" className="fill-slate-900 stroke-slate-600" strokeWidth="2" />
          <rect x="432" y="278" width="96" height="66" className="fill-slate-800" />
          <circle cx="463" cy="305" r="7" className="fill-sky-500/80" />
          <circle cx="497" cy="317" r="7" className="fill-sky-500/80" />
          <text x="600" y="306" fontSize="16" className="fill-slate-100" fontWeight="600">iPad / iPhone</text>
          <text x="600" y="326" fontSize="13" className="fill-slate-400">Remote · Préparation et Vol</text>
        </g>
      </svg>

      <ol className="space-y-3 md:hidden">
        {[
          ["PC", "Tu ajoutes tes documents et crées un cockpit."],
          ["SkyBoard", "Stocke les fichiers et synchronise en temps réel."],
          ["iPad / iPhone", "La remote envoie page, zoom et déplacements."],
          ["Casque VR", "OpenKneeboard affiche le kneeboard (Web Dashboard)."],
        ].map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-slate-800 text-xs text-sky-500">
              {i + 1}
            </span>
            <span>
              <span className="font-medium text-slate-100">{title}</span>
              <span className="block text-sm text-slate-400">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
