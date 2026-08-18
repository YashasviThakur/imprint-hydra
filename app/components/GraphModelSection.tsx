"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

// The actual write model behind Imprint on HydraDB — not a decorative
// diagram. (:Session)-[:CONTAINS]->(:Memory)-[:ABOUT]->(:Entity), with a
// SUPERSEDES edge linking a fact to the older one it replaces when a new
// session contradicts it.
function GraphDiagram() {
  return (
    <svg
      viewBox="0 0 640 220"
      width="100%"
      style={{ maxWidth: 640 }}
      aria-label="Graph schema: Session contains Memory, Memory is about Entity, a newer Memory supersedes an older one"
    >
      <line x1="90" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <line x1="300" y1="60" x2="520" y2="60" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <line x1="300" y1="170" x2="300" y2="60" stroke="#cf8f6d" strokeWidth="1" strokeDasharray="3 3" markerEnd="url(#gm-arrow)" />

      <defs>
        <marker id="gm-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="#cf8f6d" />
        </marker>
      </defs>

      <text x="195" y="52" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#4eecd8">CONTAINS</text>
      <text x="410" y="52" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#4eecd8">ABOUT</text>
      <text x="330" y="118" textAnchor="start" fontFamily="monospace" fontSize="10" fill="#cf8f6d">SUPERSEDES</text>

      <rect x="30" y="38" width="120" height="44" rx="8" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.14)" />
      <text x="90" y="65" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="rgba(255,255,255,0.85)">:Session</text>

      <rect x="240" y="38" width="120" height="44" rx="8" fill="rgba(255,255,255,0.03)" stroke="#4eecd8" strokeOpacity="0.6" />
      <text x="300" y="65" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="rgba(255,255,255,0.9)">:Memory</text>

      <rect x="460" y="38" width="120" height="44" rx="8" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.14)" />
      <text x="520" y="65" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="rgba(255,255,255,0.85)">:Entity</text>

      <rect x="240" y="148" width="120" height="44" rx="8" fill="rgba(255,255,255,0.02)" stroke="#cf8f6d" strokeOpacity="0.4" />
      <text x="300" y="175" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="rgba(255,255,255,0.4)">:Memory (old)</text>
    </svg>
  );
}

const FACTS = [
  { label: "Query language", value: "OpenCypher subset over Bolt + HTTP" },
  { label: "Write pattern", value: "MERGE, not MATCH-then-CREATE (v0.1.1 constraint)" },
  { label: "Measured cost", value: "97 reads · ~221ms avg — 590 writes · ~31ms avg" },
];

export default function GraphModelSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 md:py-36 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(78,236,216,0.04)_0%,_transparent_60%)] pointer-events-none" />
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-white/35 text-xs tracking-[0.2em] uppercase mb-4"
        >
          On HydraDB
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 36 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.08 }}
          className="text-4xl md:text-5xl lg:text-6xl text-white leading-[1.1] tracking-tight mb-14"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Memory as a graph,{" "}
          <em className="italic text-white/40 font-light">not a vector pool.</em>
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="liquid-glass rounded-3xl p-6 md:p-8 flex items-center justify-center"
          >
            <GraphDiagram />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="flex flex-col gap-6"
          >
            <p className="text-white/60 text-sm md:text-base leading-relaxed">
              Every fact Imprint captures is a <code className="text-white/80">:Memory</code> node,
              CONTAINS-linked to the session it came from and ABOUT-linked to the entity it
              describes. When a new fact contradicts an old one, Imprint writes a SUPERSEDES
              edge instead of deleting anything — the old fact stays in the graph, marked
              superseded, and reads always resolve to the current one.
            </p>

            <div className="flex flex-col gap-3">
              {FACTS.map((f) => (
                <div key={f.label} className="liquid-glass rounded-xl px-4 py-3 flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/30">{f.label}</span>
                  <span className="text-white/70 text-sm font-mono">{f.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
