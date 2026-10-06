import { describe, expect, it } from "vitest";
import { LOCALES, negotiateLocale } from "./config";
import { fmt } from "./define";
import { allMessages } from "./dictionary";

/** Liste « a.b.c » de toutes les chaînes d'un objet de textes. */
function flatten(obj: object, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value as object, path));
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("negotiateLocale", () => {
  it("prend la première langue prise en charge, par ordre de préférence", () => {
    expect(negotiateLocale("de-CH,de;q=0.9,en;q=0.8")).toBe("de");
    expect(negotiateLocale("it-IT,it;q=0.9,es;q=0.5,en;q=0.7")).toBe("en");
    expect(negotiateLocale("en-US")).toBe("en");
  });
  it("revient au français sans préférence exploitable", () => {
    expect(negotiateLocale(null)).toBe("fr");
    expect(negotiateLocale("")).toBe("fr");
    expect(negotiateLocale("ja,zh;q=0.8")).toBe("fr");
    expect(negotiateLocale("en;q=0")).toBe("fr");
  });
});

describe("fmt", () => {
  it("remplace les variables connues et laisse les autres", () => {
    expect(fmt("{n} documents sur {max}", { n: 3, max: 500 })).toBe("3 documents sur 500");
    expect(fmt("{x}", {})).toBe("{x}");
  });
});

describe("dictionnaires", () => {
  for (const [name, messages] of Object.entries(allMessages)) {
    const reference = flatten(messages.fr);
    for (const locale of LOCALES) {
      it(`${name} · ${locale} : mêmes clés et mêmes variables que le français, aucun texte vide`, () => {
        const strings = flatten(messages[locale]);
        expect(Object.keys(strings).sort()).toEqual(Object.keys(reference).sort());
        for (const [key, value] of Object.entries(strings)) {
          expect(value.trim(), key).not.toBe("");
          expect(placeholders(value), key).toEqual(placeholders(reference[key]));
        }
      });
    }
  }
});
