import type { MetadataRoute } from "next";

/** PWA : « Ajouter à l'écran d'accueil » sur iPad ouvre directement la remote, en plein écran. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkyBoard",
    short_name: "SkyBoard",
    description: "Télécommande des kneeboards OpenKneeboard pour DCS World en VR.",
    start_url: "/remote",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b0f14",
    theme_color: "#0b0f14",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
