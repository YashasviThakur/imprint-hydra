"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export default function AboutSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="pt-24 md:pt-32 pb-10 md:pb-14 px-6 border-t"
      style={{ borderColor: "var(--rule)" }}
    >
      <div className="max-w-6xl mx-auto">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-sm tracking-widest uppercase mb-4"
          style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}
        >
          The cognitive gap
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-3xl md:text-5xl lg:text-6xl leading-[1.2] tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          LLMs forget conversations when the context window resets.{" "}
          <span style={{ color: "var(--ledger)" }}>Imprint on HydraDB fixes that.</span>
        </motion.h2>
      </div>
    </section>
  );
}
