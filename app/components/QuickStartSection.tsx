"use client";

const STEPS = [
  {
    num: "01",
    time: "30 sec",
    title: "Sign in",
    desc: "Create your free Imprint account. No credit card, no install yet.",
    color: "var(--brass)",
  },
  {
    num: "02",
    time: "60 sec",
    title: "Connect your IDE",
    desc: "Paste one config block into Claude Code, Cursor, or Codex. MCP activates instantly.",
    color: "var(--ledger)",
  },
  {
    num: "03",
    time: "Forever",
    title: "AI remembers you",
    desc: "Switch IDEs, start a new chat, your full context is always there, automatically.",
    color: "var(--rust)",
  },
];

export default function QuickStartSection() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="p-8 md:p-12 border" style={{ borderColor: "var(--rule)", borderRadius: 3, background: "var(--surface)" }}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs tracking-widest uppercase mb-2 font-medium" style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                Quick start
              </p>
              <h2
                className="text-3xl md:text-4xl tracking-tight leading-tight"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
              >
                Up and running in under 2 minutes.
              </h2>
            </div>
            <a
              href="/login"
              className="flex items-center gap-3 px-6 py-3 text-sm font-medium self-start md:self-auto border transition-colors"
              style={{ borderColor: "var(--brass)", color: "var(--ink)", borderRadius: 3 }}
            >
              Get started free
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="p-5 flex flex-col gap-3 border"
                style={{ background: "var(--bg)", borderColor: "var(--rule)", borderRadius: 3 }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-2xl font-bold leading-none"
                    style={{ fontFamily: "var(--font-mono)", color: step.color }}
                  >
                    {step.num}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 border"
                    style={{ color: step.color, borderColor: "var(--rule)" }}
                  >
                    {step.time}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--ink)" }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-center mt-6 tracking-wide" style={{ color: "var(--ink-dim)" }}>
            Claude Code · Cursor · Codex · Antigravity · VS Code · Windsurf
          </p>
        </div>
      </div>
    </section>
  );
}
