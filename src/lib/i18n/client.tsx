"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import type { Dictionary } from "./dictionary";

const I18nContext = createContext<{ locale: Locale; t: Dictionary } | null>(null);

export function I18nProvider({ locale, t, children }: { locale: Locale; t: Dictionary; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider manquant");
  return value;
}

/** Textes de la langue active. */
export const useT = () => useI18n().t;
export const useLocale = (): Locale => useContext(I18nContext)?.locale ?? DEFAULT_LOCALE;
