"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

const STACK = [
  { name: "Next.js 16", role: "App + API layer", accent: "var(--ink-dim)", icon: "▲" },
  { name: "HydraDB", role: "Graph store · Bolt + HTTP", accent: "var(--brass)", icon: "◈" },
  { name: "AWS DynamoDB", role: "Legacy memory table", accent: "var(--ledger)", icon: "▤" },
  { name: "Groq API", role: "gpt-oss-120b · extraction", accent: "var(--rust)", icon: "◆" },
  { name: "Jina Embeddings", role: "1024-dim semantic retrieval", accent: "var(--ledger)", icon: "◎" },
  { name: "Vercel", role: "App deployment", accent: "var(--ink-dim)", icon: "⬡" },
];

export default function BuiltWithSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="stack" ref={ref} className="py-20 md:py-28 px-6 border-t" style={{ borderColor: "var(--rule)" }}>
      <div className="max-w-6xl mx-auto">

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-xs tracking-[0.2em] uppercase mb-4"
          style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}
        >
          Why we built this
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 36 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.08 }}
          className="text-3xl md:text-5xl leading-[1.2] tracking-tight mb-10"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          Your AI is brilliant. It just forgets you exist.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.15 }}
          className="max-w-3xl mb-24 flex flex-col gap-4"
        >
          <p className="text-sm md:text-base leading-relaxed" style={{ color: "var(--ink-dim)" }}>
            AI coding assistants forget everything the moment the context window resets. Every new
            session starts blind, with no memory of who you are, what you&apos;re building, or how
            you think. Imprint captures durable facts from every session, across every IDE, and
            writes them into a graph so the next session already knows you.
          </p>
          <p className="text-sm md:text-base leading-relaxed" style={{ color: "var(--ink-dim)" }}>
            When you say something that contradicts an earlier fact, Imprint links the two with a
            SUPERSEDES edge instead of silently overwriting. No other memory tool surfaces that.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-xs tracking-[0.2em] uppercase mb-4"
          style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}
        >
          The stack
        </motion.p>

        <motion.h3
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="text-2xl md:text-4xl tracking-tight mb-10"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          Production infrastructure, no ops.
        </motion.h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-14">
          {STACK.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.06 }}
              className="p-4 flex flex-col gap-2 border"
              style={{ borderColor: "var(--rule)", borderRadius: 3, background: "var(--surface)" }}
            >
              <span className="text-lg leading-none" style={{ color: tech.accent, fontFamily: "var(--font-mono)" }}>
                {tech.icon}
              </span>
              <p className="text-sm font-medium leading-tight mt-1" style={{ color: "var(--ink)" }}>{tech.name}</p>
              <p className="text-[11px] leading-snug" style={{ color: "var(--ink-dim)" }}>{tech.role}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="flex flex-wrap items-center gap-4"
        >
          <a
            href="https://github.com/YashasviThakur/Imprint"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 flex items-center gap-2.5 text-sm font-medium transition-colors border"
            style={{ borderColor: "var(--rule)", color: "var(--ink)", borderRadius: 3 }}
          >
            <GithubIcon size={15} />
            View source on GitHub
          </a>
          <a
            href="/chat"
            className="text-sm transition-colors"
            style={{ color: "var(--ink-dim)" }}
          >
            Try chat
          </a>
        </motion.div>
      </div>
    </section>
  );
}
