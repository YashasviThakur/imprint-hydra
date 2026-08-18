"use client";

import HeroSection from "./components/HeroSection";
import AboutSection from "./components/AboutSection";
import FeaturedVideoSection from "./components/FeaturedVideoSection";
import PhilosophySection from "./components/PhilosophySection";
import ServicesSection from "./components/ServicesSection";
import BuiltWithSection from "./components/BuiltWithSection";
import TiersSection from "./components/TiersSection";
import InstallSection from "./components/InstallSection";
import QuickStartSection from "./components/QuickStartSection";

export default function Home() {
  return (
    <main className="relative" style={{ background: "var(--bg)" }}>
      <div style={{ animation: "fadeInContent 0.8s ease 0.2s both" }}>
        <HeroSection />
        <QuickStartSection />
        <AboutSection />
        <TiersSection />
        <InstallSection />
        <FeaturedVideoSection />
        <PhilosophySection />
        <BuiltWithSection />
        <ServicesSection />

        <footer className="px-6 py-10 border-t flex flex-wrap justify-between items-center gap-4 text-xs" style={{ borderColor: "var(--rule)", color: "var(--ink-dim)" }}>
          <span>&copy; 2026 Imprint</span>
          <div className="flex gap-6">
            <a href="/terms" className="hover:underline">Terms</a>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="https://github.com/YashasviThakur/imprint-hydra" className="hover:underline">GitHub</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
