import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SkyBoard",
  description: "Pilote tes kneeboards OpenKneeboard depuis un iPad.",
  applicationName: "SkyBoard",
  // iOS : « Ajouter à l'écran d'accueil » → application plein écran.
  appleWebApp: { capable: true, title: "SkyBoard", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // Ancienne balise Apple, encore lue par les iOS < 16.4 (sinon le manifest suffit).
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
  // Contenu jusqu'aux bords (encoche, barre d'état) : marges via env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
