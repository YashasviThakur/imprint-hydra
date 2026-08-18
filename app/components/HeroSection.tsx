"use client";

import ImprintLogo from "./ImprintLogo";

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

// The actual write model behind Imprint on HydraDB — not a decorative
// diagram. (:Session)-[:CONTAINS]->(:Memory)-[:ABOUT]->(:Entity), with
// SUPERSEDES edges linking a fact to the older one it replaces.
function GraphDiagram() {
  return (
    <svg viewBox="0 0 640 220" width="100%" style={{ maxWidth: 640 }} aria-label="Graph schema: Session contains Memory, Memory is about Entity, newer Memory supersedes older Memory">
      <line x1="90" y1="60" x2="300" y2="60" stroke="var(--rule)" strokeWidth="1" />
      <line x1="300" y1="60" x2="520" y2="60" stroke="var(--rule)" strokeWidth="1" />
      <line x1="300" y1="60" x2="300" y2="170" stroke="var(--rust)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="300" y1="170" x2="300" y2="60" stroke="var(--rust)" strokeWidth="1" strokeDasharray="3 3" markerEnd="url(#arrow)" />

      <defs>
        <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="var(--rust)" />
        </marker>
      </defs>

      <text x="195" y="52" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ledger)">CONTAINS</text>
      <text x="410" y="52" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ledger)">ABOUT</text>
      <text x="330" y="118" textAnchor="start" fontFamily="var(--font-mono)" fontSize="10" fill="var(--rust)">SUPERSEDES</text>

      <rect x="30" y="38" width="120" height="44" rx="2" fill="var(--surface)" stroke="var(--rule)" />
      <text x="90" y="65" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--ink)">:Session</text>

      <rect x="240" y="38" width="120" height="44" rx="2" fill="var(--surface)" stroke="var(--brass)" />
      <text x="300" y="65" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--ink)">:Memory</text>

      <rect x="460" y="38" width="120" height="44" rx="2" fill="var(--surface)" stroke="var(--rule)" />
      <text x="520" y="65" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--ink)">:Entity</text>

      <rect x="240" y="148" width="120" height="44" rx="2" fill="var(--surface)" stroke="var(--brass)" strokeOpacity="0.5" />
      <text x="300" y="175" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--ink-dim)">:Memory (old)</text>
    </svg>
  );
}

export default function HeroSection() {
  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      <nav className="relative z-20 px-6 py-5 border-b" style={{ borderColor: "var(--rule)" }}>
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ImprintLogo size={24} />
            <span
              className="text-lg tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
            >
              Imprint
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a
              href="#stack"
              className="text-sm transition-colors"
              style={{ color: "var(--ink-dim)" }}
            >
              Built with
            </a>
            <a
              href="https://github.com/YashasviThakur/imprint-hydra"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm transition-colors"
              style={{ color: "var(--ink-dim)" }}
            >
              <GithubIcon size={15} />
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-xs tracking-[0.2em] uppercase mb-6" style={{ color: "var(--ledger)", fontFamily: "var(--font-mono)" }}>
          Memory + Context Retrieval · Hack Hydra
        </p>

        <h1
          className="text-5xl md:text-7xl tracking-tight leading-[1.05] max-w-3xl"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          Leave an <span style={{ color: "var(--brass)" }}>imprint</span> on every IDE your agent uses.
        </h1>

        <p className="max-w-xl text-sm md:text-base leading-relaxed my-8 px-4" style={{ color: "var(--ink-dim)" }}>
          One memory graph for Claude Code, Cursor, Codex, and Antigravity. Facts are captured automatically,
          linked to the entities they describe, and superseded (never deleted) when you tell your agent something new.
        </p>

        <a
          href="/login"
          className="flex items-center gap-3 px-6 py-3 text-sm transition-colors border"
          style={{ borderColor: "var(--brass)", color: "var(--ink)", borderRadius: 3 }}
        >
          Connect your IDE
          <span aria-hidden="true">&rarr;</span>
        </a>

        <div className="mt-16">
          <GraphDiagram />
        </div>
      </div>

      <div className="relative z-10 flex flex-wrap justify-center gap-4 md:gap-6 pb-10 text-xs px-6" style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
        <span>HydraDB graph store</span>
        <span>&middot;</span>
        <span>MERGE-based writes</span>
        <span>&middot;</span>
        <span>SUPERSEDES resolution</span>
      </div>
    </div>
  );
}
