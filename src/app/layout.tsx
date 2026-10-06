import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Saira, Saira_Condensed } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getLocale, getT } from "@/lib/i18n/server";
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

/** Adresses, tokens, versions : une seule police à chasse fixe, cohérente partout. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: "SkyBoard",
    description: t.home.description,
    applicationName: "SkyBoard",
    // iOS : « Ajouter à l'écran d'accueil » → application plein écran.
    appleWebApp: { capable: true, title: "SkyBoard", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    // Ancienne balise Apple, encore lue par les iOS < 16.4 (sinon le manifest suffit).
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

export const viewport: Viewport = {
  themeColor: "#121314",
  // Contenu jusqu'aux bords (encoche, barre d'état) : marges via env(safe-area-inset-*).
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${saira.variable} ${sairaCondensed.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <I18nProvider locale={locale} t={getDictionary(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
