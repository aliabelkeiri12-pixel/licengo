import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LICENGO – Licences, dossiers et boutique de votre club", template: "%s · LICENGO" },
  description: "LICENGO simplifie les inscriptions sportives : dossiers en ligne, documents depuis le téléphone, paiement en 1 à 4 fois et boutique du club.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "LICENGO", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#0B3D2E", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
