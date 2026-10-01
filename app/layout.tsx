import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Spieltisch Rhein-Main",
  description: "Neue Brettspiel-Events in Frankfurt und Umgebung – automatisch gesammelt.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Spieltisch", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ECF0EA" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1A14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&display=swap"
        />
      </head>
      <body className="min-h-dvh antialiased">
        <div className="mx-auto max-w-xl pb-28">{children}</div>
        <BottomNav />
        <RegisterSW />
      </body>
    </html>
  );
}
