import Link from "next/link";

const STEPS = [
  {
    href: "/documents",
    title: "Ajoute tes kneeboards",
    text: "PDF, images, ou les kneeboards d'une mission (.miz) ou d'un track (.trk). Range-les par dossier, un par serveur par exemple.",
    cta: "Documents",
    icon: (
      <svg viewBox="0 0 120 90" className="h-20 w-full" aria-hidden="true" fill="none" strokeWidth="2">
        <rect x="34" y="12" width="44" height="58" className="fill-slate-800 stroke-slate-600" />
        <rect x="44" y="20" width="44" height="58" className="fill-slate-900 stroke-slate-500" />
        <path d="M52 34 H80 M52 44 H76 M52 54 H72" className="stroke-slate-500" />
        <path d="M66 70 L82 54 L96 64" className="stroke-sky-500" />
      </svg>
    ),
  },
  {
    href: "/cockpits",
    title: "Branche le casque",
    text: "Crée un cockpit, copie son URL et colle-la dans un onglet Web Dashboard d'OpenKneeboard.",
    cta: "Cockpits",
    icon: (
      <svg viewBox="0 0 120 90" className="h-20 w-full" aria-hidden="true" fill="none" strokeWidth="2">
        <rect x="14" y="26" width="46" height="34" rx="4" className="fill-slate-900 stroke-slate-600" />
        <path d="M22 38 H52 M22 48 H44" className="stroke-slate-500" />
        <rect x="70" y="30" width="40" height="26" rx="9" className="fill-slate-900 stroke-slate-600" />
        <circle cx="82" cy="43" r="6" className="stroke-slate-500" />
        <circle cx="98" cy="43" r="6" className="stroke-slate-500" />
        <path d="M60 43 H68" className="stroke-sky-500" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    href: "/remote",
    title: "Pilote au doigt",
    text: "Ouvre la remote sur une tablette ou un téléphone (ou scanne le QR code affiché sur le PC). Préparation pour choisir, Vol pour piloter sans regarder.",
    cta: "Remote",
    icon: (
      <svg viewBox="0 0 120 90" className="h-20 w-full" aria-hidden="true" fill="none" strokeWidth="2">
        <rect x="34" y="10" width="52" height="70" rx="6" className="fill-slate-900 stroke-slate-600" />
        <rect x="41" y="18" width="38" height="52" className="fill-slate-800" />
        <circle cx="54" cy="40" r="6" className="fill-sky-500/80" />
        <circle cx="68" cy="52" r="6" className="fill-sky-500/80" />
        <path d="M48 32 L42 26 M74 60 L80 66" className="stroke-sky-500" />
      </svg>
    ),
  },
];

export function Steps() {
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {STEPS.map((step, i) => (
        <li key={step.href} className="flex flex-col gap-3 border border-slate-800 bg-slate-900/50 p-5">
          <div className="label-caps">Étape {i + 1}</div>
          {step.icon}
          <h3 className="text-lg font-medium text-slate-100">{step.title}</h3>
          <p className="flex-1 text-sm text-slate-400">{step.text}</p>
          <Link href={step.href} className="self-start text-sm font-medium text-sky-500 hover:text-sky-400">
            {step.cta} →
          </Link>
        </li>
      ))}
    </ol>
  );
}
