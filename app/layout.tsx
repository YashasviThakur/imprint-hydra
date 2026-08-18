import type { Metadata } from "next";
import { IBM_Plex_Serif, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const plexSlab = IBM_Plex_Serif({
  variable: "--font-display",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Imprint x HydraDB: graph-backed agent memory",
  description: "Persistent memory for AI agents, rebuilt on HydraDB's graph engine for cross-session recall, overwritten facts, and correct abstention. Built for Hack Hydra.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SessionProvider>
      <html
        lang="en"
        className={`${plexSlab.variable} ${plexSans.variable} ${plexMono.variable} antialiased`}
      >
        <body style={{ fontFamily: "var(--font-body)" }}>{children}</body>
      </html>
    </SessionProvider>
  );
}
