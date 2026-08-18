"use client";

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

const PANELS = [
  {
    number: "01",
    tag: "Unified memory",
    title: "One store, every tool",
    description:
      "Imprint sits beneath every coding agent you use. Claude Code, Cursor, Codex, and Antigravity all draw from the same memory graph, so your projects, preferences, and context travel with you no matter which IDE you open.",
    cta: "See how it connects",
    href: "#install",
    accent: "var(--brass)",
    detail: "One HydraDB graph, all tools share it",
    steps: [
      { n: "1", label: "Claude Code remembers", code: "get_memories -> injects context at session start" },
      { n: "2", label: "Cursor picks up where you left off", code: "Same memory graph, different editor" },
      { n: "3", label: "Codex & Antigravity too", code: "Every MCP agent reads and writes the same graph" },
      { n: "4", label: "All writes go to one place", code: "save_memory -> HydraDB -> available everywhere" },
    ],
  },
  {
    number: "02",
    tag: "MCP · all IDEs",
    title: "Every coding agent",
    description:
      "Install the MCP server once. Register it with Claude Code, Cursor, Codex, Antigravity, or any IDE that speaks MCP. Set IMPRINT_PLATFORM and every agent silently recalls your full context at session start.",
    cta: "Install MCP",
    href: "https://github.com/YashasviThakur/imprint#mcp-server-setup",
    accent: "var(--ledger)",
    detail: "Claude Code, Cursor, Codex, Antigravity, custom",
    steps: [
      { n: "1", label: "Clone & install once", code: "cd mcp && npm install" },
      { n: "2", label: "Register with your IDE", code: "claude mcp add imprint -- node /path/to/server.js\n# or add to .cursor/mcp.json, codex.json, etc." },
      { n: "3", label: "Tag the platform", code: "IMPRINT_PLATFORM=cursor   # or claude-code, codex\nIMPRINT_USER_ID=your-id" },
      { n: "4", label: "Switch IDEs freely", code: "All agents share the same memory graph.\nSwitch editors without losing context." },
    ],
  },
];

function StepBlock({ step, accent }: { step: typeof PANELS[0]["steps"][0]; accent: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{
        width: 20, height: 20, flexShrink: 0,
        background: "var(--surface-2)", border: `1px solid var(--rule)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 600, color: accent, marginTop: 2,
      }}>
        {step.n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--ink-dim)", marginBottom: 4, fontWeight: 500 }}>
          {step.label}
        </div>
        <pre style={{
          fontSize: 10, lineHeight: 1.6,
          color: "var(--ink-dim)",
          background: "var(--bg)",
          border: "1px solid var(--rule)",
          padding: "8px 10px",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
          margin: 0, fontFamily: "var(--font-mono)",
        }}>
          {step.code}
        </pre>
      </div>
    </div>
  );
}

export default function TiersSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section className="py-24 md:py-32 px-6 border-t" style={{ borderColor: "var(--rule)" }}>
      <div className="max-w-6xl mx-auto" ref={ref}>

        <div className="flex justify-between items-baseline mb-14">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
            className="text-3xl md:text-5xl tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
          >
            One memory layer, every coding agent.
          </motion.h2>
          <span className="hidden md:block text-sm" style={{ color: "var(--ink-dim)" }}>One store, all tools</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PANELS.map((panel, i) => {
            const isOpen = expanded === i;
            return (
              <motion.div
                key={panel.number}
                initial={{ opacity: 0, y: 50 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
                transition={{ duration: 0.7, delay: i * 0.12 }}
                className="flex flex-col border"
                style={{ borderColor: "var(--rule)", borderRadius: 3, background: "var(--surface)" }}
              >
                <div className="p-7 md:p-8 flex flex-col gap-6">
                  <div className="flex items-start justify-between">
                    <span
                      className="text-3xl font-light tracking-tighter"
                      style={{ color: panel.accent, opacity: 0.5, fontFamily: "var(--font-mono)" }}
                    >
                      {panel.number}
                    </span>
                    <span
                      className="text-xs tracking-widest uppercase px-2 py-1 border"
                      style={{ color: panel.accent, borderColor: "var(--rule)", fontFamily: "var(--font-mono)" }}
                    >
                      {panel.tag}
                    </span>
                  </div>

                  <div>
                    <h3
                      className="text-2xl md:text-3xl mb-3 tracking-tight"
                      style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
                    >
                      {panel.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>{panel.description}</p>
                  </div>

                  <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: "var(--rule)" }}>
                    <span className="text-xs" style={{ color: "var(--ink-dim)" }}>{panel.detail}</span>
                    <a
                      href={panel.href}
                      className="text-sm font-medium transition-opacity hover:opacity-70"
                      style={{ color: panel.accent }}
                    >
                      {panel.cta}
                    </a>
                  </div>
                </div>

                <div style={{ borderTop: `1px solid var(--rule)` }}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : i)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 28px", background: "transparent", border: "none", cursor: "pointer",
                      color: isOpen ? panel.accent : "var(--ink-dim)",
                      fontSize: 12, fontWeight: 500, transition: "color 0.2s",
                    }}
                  >
                    <span>How it works</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      style={{ display: "inline-block", fontSize: 14 }}
                    >
                      &darr;
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="steps"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{
                          padding: "4px 28px 24px",
                          display: "flex", flexDirection: "column", gap: 14,
                        }}>
                          {panel.steps.map(step => (
                            <StepBlock key={step.n} step={step} accent={panel.accent} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
