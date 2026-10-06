import type { Locale } from "./config";
import auth from "./messages/auth";
import cockpits from "./messages/cockpits";
import common from "./messages/common";
import documents from "./messages/documents";
import home from "./messages/home";
import nav from "./messages/nav";
import remote from "./messages/remote";
import squadrons from "./messages/squadrons";
import viewer from "./messages/viewer";

const namespaces = { common, nav, auth, home, documents, remote, cockpits, squadrons, viewer };

export type Dictionary = { [K in keyof typeof namespaces]: (typeof namespaces)[K]["fr"] };

/** Tous les textes d'une langue (objet sérialisable : transmis aux composants client). */
export function getDictionary(locale: Locale): Dictionary {
  return Object.fromEntries(
    Object.entries(namespaces).map(([name, messages]) => [name, messages[locale]]),
  ) as Dictionary;
}

/** Pour les tests : toutes les langues de chaque espace de noms. */
export const allMessages = namespaces;
