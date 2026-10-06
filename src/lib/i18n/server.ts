import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "./config";
import { getDictionary } from "./dictionary";

/** Langue de la requête : choix mémorisé, sinon langue du navigateur. */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return negotiateLocale((await headers()).get("accept-language"));
});

/** Textes de la langue de la requête (composants serveur, actions). */
export async function getT() {
  return getDictionary(await getLocale());
}
