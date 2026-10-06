import type { Metadata, Viewport } from "next";
import { Saira, Saira_Condensed } from "next/font/google";
import "./globals.css";

const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
});

const sairaCondensed = Saira_Condensed({
  variable: "--font-saira-condensed",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "SkyBoard",
  description: "Pilote tes kneeboards OpenKneeboard depuis une tablette ou un téléphone.",
  applicationName: "SkyBoard",
  // iOS : « Ajouter à l'écran d'accueil » → application plein écran.
  appleWebApp: { capable: true, title: "SkyBoard", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // Ancienne balise Apple, encore lue par les iOS < 16.4 (sinon le manifest suffit).
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#121314",
  // Contenu jusqu'aux bords (encoche, barre d'état) : marges via env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${saira.variable} ${sairaCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
