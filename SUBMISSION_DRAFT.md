# Hack Hydra submission form — draft answers

Copy-paste into forms.gle/GrMYKxLj9zPQcqqc8. Fill in the bracketed bits before submitting.

---

**Project name**
Imprint × HydraDB

**Short description**
A persistent memory layer for AI agents, rebuilt on HydraDB's graph engine for
cross-session recall: facts that get updated become explicit graph edges
instead of silently-stale rows, and "I don't know" is a structural answer,
not a hopeful prompt.

**Track**
Track 03 — Memory + Context Retrieval

**The problem you are addressing**
LongMemEval-style agent memory: synthesizing facts across 30–40 sessions,
tracking which facts have been overwritten, reasoning about *when* things
happened, and — the hard part per the track brief — correctly abstaining
when the answer genuinely isn't in the history instead of inventing one.
Long-context models lose 30–60% accuracy here, mostly from that abstention
failure.

**What you built**
Adapted [Imprint](https://github.com/YashasviThakur/Imprint) (an existing
persistent-memory product for AI coding agents) onto HydraDB: every saved
memory becomes a graph node; the existing contradiction-detection engine now
produces explicit `SUPERSEDES` edges instead of a flat conflict flag; a new
`/api/ask-graph` endpoint answers questions grounded in the graph's
*current* (non-superseded) facts, ordered by time, and abstains structurally
— if the graph query returns nothing, the LLM is never called. Also built
and ran a real evaluation harness against the LongMemEval benchmark
(`scripts/benchmark-longmemeval.ts`), including explicit scoring of
abstention instances, which the official eval script actually skips.

**HydraDB — where is it used, and why does it matter**
Every memory write dual-writes into HydraDB as `(:Session)-[:CONTAINS]->
(:Memory)-[:SUPERSEDES]->(:Memory)-[:ABOUT]->(:Entity)`. "Current truth" for
a question is resolved by walking `SUPERSEDES` edges to find facts nothing
has superseded, ordered by `ts` — structural, not inferred. A vector store
finds the nearest facts by similarity; it has no notion that one fact
supersedes another. That's the specific failure mode HydraDB's graph model
closes: a memory layer can retrieve a semantically-relevant but *outdated*
fact and answer confidently with it. Here that's structurally impossible —
the graph, not the prompt, decides what's current.

**Deployed project link**
https://imprint-hydra.vercel.app — note: HydraDB itself runs via a local
Docker + ngrok tunnel (see README's "Deploying" section), so the app is only
fully functional (dual-write, /api/ask-graph) while that tunnel is up. Check
it's live before sharing, or fall back to the demo video if the tunnel isn't
running at judging time.

**Tech stack**
Next.js 16 (App Router) · HydraDB (Bolt via neo4j-driver) · AWS DynamoDB ·
Groq (llama-3.3-70b extraction, llama-3.1-8b-instant answering) · Jina
embeddings · NextAuth · Docker Compose (HydraDB + MinIO for local dev)

**Team members and contributions**
[Yashasvi Thakur — solo, all of the above] — adjust if there's a team

**GitHub repository**
https://github.com/YashasviThakur/imprint-hydra

**Demo video**
[link after recording — see DEMO_SCRIPT.md]
