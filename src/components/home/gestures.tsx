/** Pictogrammes des gestes du mode vol (écran de tablette + doigts). */

const Tablet = ({ children }: { children?: React.ReactNode }) => (
  <svg viewBox="0 0 160 110" className="h-24 w-full" aria-hidden="true" fill="none" strokeWidth="2">
    <defs>
      <marker id="g-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" className="fill-sky-500" />
      </marker>
    </defs>
    <rect x="10" y="8" width="140" height="94" rx="8" className="fill-slate-900 stroke-slate-600" />
    {children}
  </svg>
);

const Finger = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="8" className="fill-sky-500/80" />;
const Arrow = ({ d }: { d: string }) => <path d={d} className="stroke-sky-500" markerEnd="url(#g-arrow)" />;

const GESTURES = [
  {
    title: "Pincer",
    text: "Zoom centré entre les doigts (×1 à ×6)",
    art: (
      <Tablet>
        <Finger x={66} y={64} />
        <Finger x={94} y={46} />
        <Arrow d="M58 72 L42 86" />
        <Arrow d="M102 38 L118 24" />
      </Tablet>
    ),
  },
  {
    title: "Glisser à deux doigts",
    text: "Déplacer la page (ou à un doigt si zoomé)",
    art: (
      <Tablet>
        <Finger x={60} y={48} />
        <Finger x={60} y={70} />
        <Arrow d="M74 59 H118" />
      </Tablet>
    ),
  },
  {
    title: "Swipe horizontal",
    text: "← page suivante · → page précédente",
    art: (
      <Tablet>
        <Finger x={80} y={56} />
        <Arrow d="M68 56 H34" />
        <Arrow d="M92 56 H126" />
      </Tablet>
    ),
  },
  {
    title: "Double tap",
    text: "Revenir à la page entière",
    art: (
      <Tablet>
        <Finger x={80} y={56} />
        <circle cx="80" cy="56" r="16" className="stroke-sky-500" />
        <circle cx="80" cy="56" r="24" className="stroke-sky-500/50" />
      </Tablet>
    ),
  },
  {
    title: "Bords de l'écran",
    text: "Swipe vertical : ↓ document suivant · ↑ précédent",
    art: (
      <Tablet>
        <rect x="12" y="10" width="16" height="90" className="fill-slate-800" />
        <rect x="132" y="10" width="16" height="90" className="fill-slate-800" />
        <Finger x={140} y={40} />
        <Arrow d="M140 52 V86" />
        <Arrow d="M20 70 V26" />
      </Tablet>
    ),
  },
  {
    title: "Curseur",
    text: "Bouton « Curseur » : ton doigt apparaît dans le casque",
    art: (
      <Tablet>
        <Finger x={70} y={60} />
        <circle cx="104" cy="40" r="7" className="stroke-sky-500" />
        <path d="M78 54 L96 44" className="stroke-sky-500/60" strokeDasharray="3 3" />
      </Tablet>
    ),
  },
];

export function Gestures() {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {GESTURES.map((g) => (
        <li key={g.title} className="flex flex-col gap-2 border border-slate-800 p-4">
          {g.art}
          <div className="font-medium text-slate-100">{g.title}</div>
          <div className="text-sm text-slate-400">{g.text}</div>
        </li>
      ))}
    </ul>
  );
}
