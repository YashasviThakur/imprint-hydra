/**
 * LongMemEval harness — proves the ingest -> graph store -> retrieve -> answer/abstain
 * -> score pipeline end to end, against the real HydraDB (lib/hydra.ts).
 *
 * Without GROQ_API_KEY set, extraction falls back to regex (lib/extract.ts) and there's
 * no LLM to phrase answers, so this run is a plumbing check, not a real accuracy number —
 * it's printed as such below.
 *
 * Usage: npx tsx scripts/benchmark-longmemeval.ts [count]
 */
import fs from "node:fs";
import path from "node:path";
import { extractMemories } from "../lib/extract";
import { detectSemanticContradictions } from "../lib/contradiction";
import { llmComplete } from "../lib/llm";
import { rankByRelevance } from "../lib/relevance";
import {
  ensureSession,
  saveMemory,
  linkEntity,
  linkSupersedes,
  getCurrentFactsForUser,
  getQueryStats,
  resetQueryStats,
  closeHydraDriver,
} from "../lib/hydra";

interface Turn { role: string; content: string; has_answer?: boolean }
interface Instance {
  question_id: string;
  question_type: string;
  question: string;
  answer: string;
  haystack_dates: string[];
  haystack_session_ids: string[];
  haystack_sessions: Turn[][];
}

const GROQ_KEY = process.env.GROQ_API_KEY;
const STOPWORDS = new Set(["the", "a", "an", "is", "was", "were", "did", "do", "does", "i", "my", "me", "you", "your", "what", "when", "where", "which", "how", "in", "on", "at", "to", "of", "for", "and"]);

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function parseHaystackDate(d: string): string {
  // "2023/04/10 (Mon) 17:50" -> ISO
  const m = d.match(/(\d{4})\/(\d{2})\/(\d{2}).*?(\d{2}):(\d{2})/);
  if (!m) return new Date().toISOString();
  const [, y, mo, day, hh, mm] = m;
  return new Date(`${y}-${mo}-${day}T${hh}:${mm}:00Z`).toISOString();
}

const ABSTAIN_THRESHOLD = 1; // min shared keyword tokens to answer instead of abstaining
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Global pacing gate (not per-call sleeps) — every call into Groq, across every
// instance in the run, waits until at least LLM_CALL_DELAY_MS has passed since
// the last one. A per-instance-only delay wasn't enough: rate-limit pressure
// accumulates across the whole run, and a single 429 makes extraction silently
// fall back to regex (lib/extract.ts swallows the failure), which looked like
// a prompt bug until traced back to this.
const LLM_CALL_DELAY_MS = 2500;
let lastLLMCallAt = 0;
async function paceLLMCall(): Promise<void> {
  if (!GROQ_KEY) return;
  const wait = lastLLMCallAt + LLM_CALL_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastLLMCallAt = Date.now();
}

async function runInstance(inst: Instance, runId: string) {
  // HydraDB is real, persistent storage now (not the mock) — every id is a
  // deterministic hash of {type}:{key}, and MERGE requires an exact property
  // match to reuse a node rather than create a new one. Rerunning the harness
  // without a per-run namespace would collide with a prior run's nodes under
  // the same hashed id (LLM output isn't perfectly deterministic between
  // runs), so runId scopes every session/memory key to this run only.
  const userId = `${runId}:${inst.question_id}`;

  let factCount = 0;
  for (let i = 0; i < inst.haystack_sessions.length; i++) {
    const sessionId = `${runId}:${inst.haystack_session_ids[i]}`;
    const ts = parseHaystackDate(inst.haystack_dates[i]);
    await ensureSession(userId, sessionId, ts);

    const turns = inst.haystack_sessions[i].map((t) => ({ role: t.role, content: t.content }));
    await paceLLMCall();
    const extracted = await extractMemories(turns, GROQ_KEY);

    const existing = await getCurrentFactsForUser(userId, 1000);
    for (const fact of extracted) {
      const key = `${sessionId}-${factCount++}`;
      await saveMemory({ key, userId, sessionId, content: fact.content, topic: fact.topic, ts, confidence: fact.confidence });
      for (const kw of fact.keywords.slice(0, 2)) await linkEntity(key, userId, kw);

      // Best-effort contradiction check -> SUPERSEDES edge (no-ops cleanly without an LLM key)
      if (GROQ_KEY && existing.length) {
        await paceLLMCall();
        const hits = await detectSemanticContradictions(
          [{ content: fact.content, topic: fact.topic }],
          existing.map((e) => ({ memoryId: e.key, content: e.content, topic: e.topic })),
          GROQ_KEY
        );
        for (const h of hits) await linkSupersedes(key, h.existingMemoryId, h.explanation, h.confidence);
      }
    }
  }

  const currentFacts = await getCurrentFactsForUser(userId, 1000);
  const isAbstentionCase = inst.question_id.endsWith("_abs");

  // Structural pre-filter: only hard-abstain before calling the LLM when the
  // graph has literally nothing for this user (the one case abstention is
  // fully mechanical). Otherwise every current fact goes to the LLM and its
  // grounded prompt ("NOT_ENOUGH_INFO" if the facts don't cover it) does the
  // abstention judgment — a keyword pre-filter on question phrasing turned
  // out to reject facts that answer the question in different words.
  const qTokens = new Set(tokenize(inst.question));
  const candidateFacts = currentFacts;

  let predicted: string;
  let abstained: boolean;

  if (!candidateFacts.length) {
    predicted = "[ABSTAIN] not enough information";
    abstained = true;
  } else if (GROQ_KEY) {
    await paceLLMCall();
    // Narrow to the most query-relevant facts before answering — dumping
    // every current fact (60-83 at full scale) to an 8B model with no
    // ranking is the documented cause of the full-scale accuracy drop.
    // Re-sort the narrowed set back into chronological order for the prompt.
    const relevant = rankByRelevance(candidateFacts, inst.question, 25)
      .slice()
      .sort((a, b) => (a.ts < b.ts ? -1 : 1));
    const facts = relevant
      .map((f) => `- [${f.ts}] ${f.content}`)
      .join("\n");
    const system =
      "Answer the question using ONLY the facts below, which are ordered by timestamp. " +
      "If the facts don't contain the answer, say exactly 'NOT_ENOUGH_INFO'. Be concise (1 sentence).\n\n" +
      `=== FACTS ===\n${facts}\n=== END FACTS ===`;
    const answer = await llmComplete(
      [{ role: "system", content: system }, { role: "user", content: inst.question }],
      { temperature: 0, maxTokens: 100 }
    );
    abstained = !answer || /NOT_ENOUGH_INFO/i.test(answer);
    predicted = abstained ? "[ABSTAIN] not enough information" : answer!.trim();
  } else {
    // No key -> fall back to the naive best-overlap fact as the "answer".
    const best = candidateFacts.reduce((a, b) =>
      tokenize(b.content).filter((w) => qTokens.has(w)).length > tokenize(a.content).filter((w) => qTokens.has(w)).length ? b : a
    );
    predicted = best.content;
    abstained = false;
  }

  // Weak proxy scoring (token-overlap with ground truth), not the official autoeval —
  // this run is about proving the pipeline, not measuring official accuracy.
  const ansTokens = tokenize(inst.answer);
  const predTokens = tokenize(predicted);
  const answerOverlap = ansTokens.filter((w) => predTokens.includes(w)).length;
  const correct = isAbstentionCase ? abstained : (!abstained && answerOverlap >= 1);

  return {
    id: inst.question_id,
    type: inst.question_type,
    question: inst.question,
    groundTruth: inst.answer,
    predicted,
    factsExtracted: factCount,
    currentFacts: currentFacts.length,
    abstained,
    isAbstentionCase,
    correct,
  };
}

async function main() {
  const count = Number(process.argv[2]) || 8;
  const full = process.argv.includes("--full");
  const runId = `run${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  // --full = the actual scale the track brief describes (~40 sessions, ~115K
  // tokens/question) vs. the default oracle file (evidence sessions only,
  // much faster to iterate on).
  const dataFile = full ? "data/longmemeval_s_cleaned.json" : "data/longmemeval_oracle.json";
  const raw = fs.readFileSync(path.join(__dirname, dataFile), "utf-8");
  const all: Instance[] = JSON.parse(raw);

  // Sample: a mix of abstention + knowledge-update + everything-else instances.
  const abs = all.filter((d) => d.question_id.endsWith("_abs")).slice(0, Math.ceil(count / 3));
  const upd = all.filter((d) => d.question_type === "knowledge-update").slice(0, Math.ceil(count / 3));
  const rest = all.filter((d) => !abs.includes(d) && !upd.includes(d)).slice(0, count - abs.length - upd.length);
  const sample = [...abs, ...upd, ...rest];

  console.log(`Running ${sample.length} instances (GROQ_API_KEY ${GROQ_KEY ? "present" : "absent -> regex extraction, no LLM answering"})\n`);

  resetQueryStats(); // measure real HydraDB read/write cost for this run only
  const results = [];
  for (const inst of sample) {
    const r = await runInstance(inst, runId);
    results.push(r);
    console.log(`[${r.correct ? "OK" : "MISS"}] (${r.type}) ${r.id}`);
    console.log(`  Q: ${r.question}`);
    console.log(`  extracted ${r.factsExtracted} facts, ${r.currentFacts} current after SUPERSEDES resolution`);
    console.log(`  ground truth: ${r.groundTruth}`);
    console.log(`  predicted:    ${r.predicted}\n`);
  }

  const correctCount = results.filter((r) => r.correct).length;
  const absCases = results.filter((r) => r.isAbstentionCase);
  const absCorrect = absCases.filter((r) => r.correct).length;
  console.log("─".repeat(60));
  console.log(`Overall: ${correctCount}/${results.length} correct (proxy scoring, not official autoeval)`);
  console.log(`Abstention: ${absCorrect}/${absCases.length} correctly abstained`);

  const qs = getQueryStats();
  const avg = (ms: number, n: number) => (n ? (ms / n).toFixed(1) : "n/a");
  console.log(
    `HydraDB cost: ${qs.reads} reads (avg ${avg(qs.readMs, qs.reads)}ms, ${qs.readMs}ms total), ` +
    `${qs.writes} writes (avg ${avg(qs.writeMs, qs.writes)}ms, ${qs.writeMs}ms total)`
  );

  await closeHydraDriver();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
