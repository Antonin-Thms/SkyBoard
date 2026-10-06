"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Menu } from "@/components/ui/menu";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALE_NAMES, LOCALES } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import { Flag } from "./flag";

/** Sélecteur de langue : drapeau de la langue active, menu des langues. */
export function LanguageSwitcher({ align = "end" }: { align?: "start" | "end" }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={pending ? "opacity-60" : ""}>
      <Menu
        label={`${t.common.language} : ${LOCALE_NAMES[locale]}`}
        align={align}
        triggerClassName="btn-icon w-auto gap-1.5 px-2"
        trigger={
          <>
            <Flag locale={locale} />
            <span className="font-condensed text-[13px] font-medium uppercase tracking-wider text-muted">{locale}</span>
            <ChevronDown size={14} strokeWidth={1.75} className="text-subtle" />
          </>
        }
        items={LOCALES.map((l) => ({
          label: LOCALE_NAMES[l],
          icon: <Flag locale={l} />,
          checked: l === locale,
          onSelect: () => {
            if (l === locale) return;
            startTransition(async () => {
              await setLocale(l);
              router.refresh();
            });
          },
        }))}
      />
    </div>
  );
}
