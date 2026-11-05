import type { TacticalRefs } from "../tactical";

/**
 * Listes « MANEX Germany » du Digital Joint Squadron (MANEX Germany V2.0) :
 * terrains (pages Home Bases), COMPLAN Blue (COM 1 / COM 2) et ravitailleurs
 * (pages AAR Tracks). UHF des terrains : canal puis fréquence.
 */
export const MANEX_GERMANY: TacticalRefs = {
  airbases: [
    { name: "ETAD", tacan: "32X", vhf: "", uhf: "U12 252.800", elev: "984", runway: "05/23", ils: "109.15 / 108.10" },
    { name: "EDDH", tacan: "79X", vhf: "", uhf: "U14 253.350", elev: "72", runway: "05/23 · 15/33", ils: "110.5 / 111.5" },
    { name: "CVN-75", tacan: "75X", vhf: "", uhf: "U10 275.500", elev: "0", runway: "", ils: "ICLS 1" },
    { name: "EDRB (RED)", tacan: "", vhf: "", uhf: "U12 252.800", elev: "", runway: "06/24", ils: "" },
    { name: "EDHI (RED)", tacan: "", vhf: "", uhf: "U14 253.350", elev: "", runway: "05/23", ils: "" },
  ],
  stations: [
    { code: "U1", name: "Garde", freq: "243.000" },
    { code: "U2", name: "MAGIC AWACS", freq: "280.000" },
    { code: "U3", name: "SHELL 31 (R205)", freq: "231.000" },
    { code: "U4", name: "TEXACO 41 MAGGIE", freq: "241.000" },
    { code: "U5", name: "TACTICAL", freq: "284.300" },
    { code: "U6", name: "TACTICAL", freq: "286.500" },
    { code: "U7", name: "TACTICAL", freq: "257.950" },
    { code: "U8", name: "TACTICAL", freq: "248.500" },
    { code: "U9", name: "NANNY", freq: "275.200" },
    { code: "U10", name: "AIRBOSS / MARSHALL", freq: "275.500" },
    { code: "U11", name: "LSO", freq: "275.800" },
    { code: "U12", name: "Spangdahlem TWR", freq: "252.800" },
    { code: "U13", name: "Bremen Radar (TMA)", freq: "357.550" },
    { code: "U14", name: "Hamburg TWR", freq: "253.350" },
    { code: "U15", name: "SHELL 51 (R202)", freq: "251.000" },
    { code: "U16", name: "TACTICAL", freq: "251.500" },
    { code: "U17", name: "Langen Radar R165", freq: "342.725" },
    { code: "U18", name: "TACTICAL", freq: "255.525" },
    { code: "U19", name: "CRC LONESHIP", freq: "339.725" },
    { code: "U20", name: "SHELL 71 (R166)", freq: "271.000" },
    { code: "V1", name: "Garde", freq: "121.500" },
    { code: "V3", name: "JTAC", freq: "132.300" },
    { code: "V4", name: "Particulière Escadron", freq: "125.500" },
    { code: "V5", name: "TACTICAL", freq: "124.300" },
    { code: "V6", name: "TACTICAL", freq: "136.500" },
    { code: "V7", name: "Particulière Escadron", freq: "123.300" },
    { code: "V8", name: "Particulière Escadron", freq: "122.100" },
    { code: "V9", name: "Particulière Escadron", freq: "139.850" },
    { code: "V10", name: "Particulière Escadron", freq: "129.925" },
    { code: "V11", name: "Particulière Escadron", freq: "142.450" },
    { code: "V12", name: "JTAC", freq: "137.950" },
    { code: "V13", name: "TACTICAL", freq: "138.500" },
    { code: "V14", name: "JTAC", freq: "126.100" },
    { code: "U/V15", name: "Particulière Escadron", freq: "282.025" },
    { code: "U/V16", name: "Particulière Escadron", freq: "344.175" },
    { code: "U/V17", name: "Particulière Escadron", freq: "338.725" },
    { code: "U/V18", name: "Particulière Escadron", freq: "240.450" },
    { code: "V19", name: "TACTICAL", freq: "119.450" },
    { code: "V20", name: "TACTICAL", freq: "135.850" },
    // Ravitailleurs hors COMPLAN (pages AAR Tracks) : TACAN dans le nom.
    { code: "", name: "SHELL 61 VIRGIN 61X", freq: "261.000" },
    { code: "", name: "SHELL 21 SAXON 21X", freq: "241.500" },
    { code: "", name: "TEXACO 91 ROSY 91X", freq: "291.000" },
    { code: "", name: "TEXACO 81 MAGGIE 81X", freq: "281.000" },
    { code: "", name: "NANNY recovery 75Y", freq: "275.200" },
  ],
};
