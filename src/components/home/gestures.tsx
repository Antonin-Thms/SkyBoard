/** Pictogrammes des gestes du mode vol (écran de tablette + doigts). */

import { getT } from "@/lib/i18n/server";

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
    key: "pinch",
    art: (
      <Tablet>
        <Finger x={64} y={66} />
        <Finger x={96} y={44} />
        <Arrow d="M52 78 L36 92" />
        <Arrow d="M108 32 L124 18" />
      </Tablet>
    ),
  },
  {
    key: "pan",
    art: (
      <Tablet>
        <Finger x={44} y={36} />
        <Finger x={44} y={76} />
        <Arrow d="M64 36 H124" />
        <Arrow d="M64 76 H124" />
      </Tablet>
    ),
  },
  {
    key: "swipe",
    art: (
      <Tablet>
        <Finger x={80} y={56} />
        <Arrow d="M62 56 H28" />
        <Arrow d="M98 56 H132" />
      </Tablet>
    ),
  },
  {
    key: "doubleTap",
    art: (
      <Tablet>
        <Finger x={80} y={56} />
        <circle cx="80" cy="56" r="16" className="stroke-sky-500" />
        <circle cx="80" cy="56" r="24" className="stroke-sky-500/50" />
      </Tablet>
    ),
  },
  {
    key: "favorites",
    art: (
      <Tablet>
        <Finger x={80} y={76} />
        <Arrow d="M80 56 V18" />
        <path d="M112 30 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" className="fill-amber-400 stroke-none" />
      </Tablet>
    ),
  },
  {
    key: "cursor",
    art: (
      <Tablet>
        <Finger x={62} y={66} />
        <circle cx="110" cy="36" r="7" className="stroke-sky-500" />
        <path d="M76 56 L102 41" className="stroke-sky-500/60" strokeDasharray="3 3" />
      </Tablet>
    ),
  },
] as const;

export async function Gestures() {
  const t = await getT();
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {GESTURES.map((g) => (
        <li key={g.key} className="flex flex-col gap-2 border border-slate-800 p-4">
          {g.art}
          <div className="font-medium text-slate-100">{t.home.gestures[g.key].title}</div>
          <div className="text-sm text-slate-400">{t.home.gestures[g.key].text}</div>
        </li>
      ))}
    </ul>
  );
}
