import type { TacticalRefs } from "../tactical";

/**
 * Listes du briefing « Inter-escadrilles DJS Nov 26 » (serveur 06th MHR,
 * Syrie) : terrains et FARP (FARP ET AÉROPORTS), fréquences et indicatifs
 * (LIAISON ET COMMANDEMENT). Élévations : fiche de l'escadron.
 */
export const INTER_ESCADRILLES_NOV26: TacticalRefs = {
  airbases: [
    { name: "TIYAS AB", tacan: "", vhf: "122.000", uhf: "", elev: "1798", runway: "27", ils: "" },
    { name: "TABQA AB", tacan: "", vhf: "130.000", uhf: "", elev: "1099", runway: "27", ils: "" },
    { name: "SHAYRAT AB", tacan: "", vhf: "132.000", uhf: "", elev: "2638", runway: "29", ils: "" },
    { name: "FARP HEBECREVON", tacan: "", vhf: "126.000", uhf: "", elev: "", runway: "Axe 230", ils: "" },
    { name: "FARP SONIC", tacan: "", vhf: "124.000", uhf: "", elev: "", runway: "Axe 230", ils: "" },
  ],
  stations: [
    { code: "VHF", name: "SUNRAY · COM GLOBAL (Air-Ground)", freq: "121.000 AM" },
    { code: "VHF", name: "JFO", freq: "121.000" },
    { code: "VHF", name: "GUARDIAN", freq: "121.000 AM" },
    { code: "VHF", name: "TIYAS AB (ATC DJS / auto-info)", freq: "122.000" },
    { code: "VHF", name: "TABQA AB (ATC 06th MHR)", freq: "130.000" },
    { code: "VHF", name: "SHAYRAT AB (ATC 06th MHR)", freq: "132.000" },
    { code: "VHF", name: "FARP HEBECREVON (auto-info)", freq: "126.000" },
    { code: "VHF", name: "FARP SONIC (auto-info)", freq: "124.000" },
    { code: "FM", name: "GUARDIAN", freq: "FM 32" },
    { code: "FM", name: "CONDOR / RHINO / FENNEC", freq: "FM 40" },
    { code: "FM", name: "LYNX", freq: "FM 42" },
    { code: "FM", name: "RAVEN", freq: "FM 44" },
    { code: "FM", name: "EAGLE", freq: "FM 50" },
    { code: "AM", name: "HOG", freq: "351.000" },
    { code: "AM", name: "DAGGER 21", freq: "344.175" },
    { code: "AM", name: "DAGGER 51 (INTERPAT)", freq: "338.725" },
    { code: "AM", name: "DAGGER 71", freq: "240.450" },
  ],
  support: [
    { role: "CMD", type: "", callsign: "SUNRAY", uhf: "", vhf: "121.000", tacan: "", alt: "", notes: "Chef de mission · Air-Ground" },
  ],
};
