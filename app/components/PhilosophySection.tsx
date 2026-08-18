"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export default function PhilosophySection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 md:py-32 px-6 border-t" style={{ borderColor: "var(--rule)" }}>
      <div className="max-w-6xl mx-auto" ref={ref}>
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl tracking-tight mb-16 md:mb-20"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          Graph store, not vector soup.
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="overflow-hidden aspect-[4/3] border"
            style={{ borderColor: "var(--rule)", borderRadius: 3 }}
          >
            <video
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4"
              className="w-full h-full object-cover"
              muted
              autoPlay
              loop
              playsInline
              preload="auto"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col justify-center gap-8"
          >
            <div>
              <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                Explicit edges
              </p>
              <p className="text-base md:text-lg leading-relaxed" style={{ color: "var(--ink)" }}>
                Facts aren&apos;t just embedded and pooled. Every memory is a node,
                CONTAINS-linked to the session it came from and ABOUT-linked to
                the entity it describes, so recall can traverse relationships,
                not just rank similarity.
              </p>
            </div>

            <div className="w-full h-px" style={{ background: "var(--rule)" }} />

            <div>
              <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>
                Correction, not overwrite
              </p>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: "var(--ink)" }}>
                When a new fact contradicts an old one, Imprint writes a
                SUPERSEDES edge instead of deleting the original. The graph
                keeps both, marks the old one as superseded, and answers
                always resolve to the current fact.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
