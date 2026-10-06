import type { Locale } from "@/lib/i18n/config";

/**
 * Drapeaux en SVG : Windows n'affiche pas les emoji drapeaux.
 * Format 3:2, dessin simplifié lisible en petit.
 */
const FLAGS: Record<Locale, React.ReactNode> = {
  fr: (
    <>
      <rect width="1" height="2" fill="#002654" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ce1126" />
    </>
  ),
  en: (
    <>
      <rect width="3" height="2" fill="#012169" />
      <path d="M0 0L3 2M3 0L0 2" stroke="#fff" strokeWidth="0.4" />
      <path d="M0 0L3 2M3 0L0 2" stroke="#c8102e" strokeWidth="0.15" />
      <path d="M1.5 0V2M0 1H3" stroke="#fff" strokeWidth="0.6" />
      <path d="M1.5 0V2M0 1H3" stroke="#c8102e" strokeWidth="0.35" />
    </>
  ),
  de: (
    <>
      <rect width="3" height="0.667" fill="#000" />
      <rect y="0.667" width="3" height="0.667" fill="#dd0000" />
      <rect y="1.333" width="3" height="0.667" fill="#ffce00" />
    </>
  ),
  es: (
    <>
      <rect width="3" height="2" fill="#aa151b" />
      <rect y="0.5" width="3" height="1" fill="#f1bf00" />
    </>
  ),
};

export function Flag({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <svg
      viewBox="0 0 3 2"
      aria-hidden="true"
      preserveAspectRatio="none"
      className={`h-3.5 w-[21px] shrink-0 rounded-[1px] shadow-[0_0_0_1px_rgb(255_255_255/0.12)] ${className}`}
    >
      {FLAGS[locale]}
    </svg>
  );
}
