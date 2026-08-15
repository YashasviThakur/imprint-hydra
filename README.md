# Imprint × HydraDB

A submission for **Hack Hydra** (Track 03: Memory + Context Retrieval) — [github.com/hydra-db/hydradb](https://github.com/hydra-db/hydradb).

Imprint is an existing persistent-memory layer for AI agents/coding assistants
([github.com/YashasviThakur/Imprint](https://github.com/YashasviThakur/Imprint),
live at [imprint-ebon.vercel.app](https://imprint-ebon.vercel.app)). This repo
adapts it for Hack Hydra: HydraDB's graph model replaces flat vector-cosine
retrieval for the part Track 03 actually asks for — cross-session synthesis,
chronological reasoning, tracking facts that get overwritten, and abstaining
correctly when the answer just isn't there.

**Disclosure** (per the submission rules): the Next.js dashboard, auth,
extraction pipeline, and contradiction-detection engine are carried over from
the existing Imprint product and predate this hackathon. What's new, built
during the Aug 12–20 window, is everything HydraDB-related below.

## What's actually new here

- **`lib/hydra.ts`** — the HydraDB graph client (Bolt protocol). Graph model:
  `(:Session)-[:CONTAINS]->(:Memory)-[:SUPERSEDES]->(:Memory)`,
  `(:Memory)-[:ABOUT]->(:Entity)`. "Current" fact for a user/entity = a Memory
  with no incoming `SUPERSEDES` edge; chronology comes from `ORDER BY ts`, not
  a separate linked list.
- **`app/api/memories`** — every save now dual-writes into the graph
  (`lib/hydra-sync.ts`) alongside the existing DynamoDB write. Confirmed
  contradictions become `SUPERSEDES` edges directly.
- **`app/api/ask-graph`** — the payoff. Answers are grounded in the graph's
  *current* facts (SUPERSEDES-resolved, timestamp-ordered), and abstention is
  structural: if the graph has nothing for a user, the LLM is never called at
  all, not just prompted to decline.
- **`lib/extract.ts`** — broadened from Imprint's original dev/hackathon-facts
  scope to general life facts and facts about third parties, which
  LongMemEval-style conversations rely on and the original prompt missed.
- **`scripts/benchmark-longmemeval.ts`** — an actual eval harness against
  [LongMemEval](https://github.com/xiaowu0162/LongMemEval): ingest → graph →
  retrieve → answer/abstain → score, including explicit scoring of
  abstention instances (the official `evaluate_qa.py` skips those; this
  harness doesn't, since Track 03 calls abstention "the hard part").

## Why a graph here, not just a bigger vector index

The old retrieval was a flat DynamoDB table ranked by embedding cosine
similarity — no sense of *when* something happened, no way to tell a current
fact from one that's been overwritten, and abstention was a prompt asking the
model to please not hallucinate. None of that holds up at LongMemEval's scale
(30–40 sessions, contradicting facts, ~30 genuinely unanswerable questions per
500). The graph makes revision and time explicit instead of leaving both to
the model's judgment: `SUPERSEDES` edges are structural fact history, not a
hope that the LLM infers "this is old news" from a flat context window.

## Run it locally

```bash
npm install

# HydraDB + MinIO (S3-compatible backend — see "A real HydraDB gotcha" below)
docker compose -f docker-compose.hydradb.yml up -d

npm run dev        # → http://localhost:4319
```

Run the benchmark harness (needs `GROQ_API_KEY` in your environment for real
LLM extraction/answering; falls back to a regex extractor and skips LLM
answering without one):

```bash
mkdir -p scripts/data
curl -sL https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_oracle.json \
  -o scripts/data/longmemeval_oracle.json
npx tsx scripts/benchmark-longmemeval.ts 8
```

## A real HydraDB gotcha (v0.1.1, the exact release this hackathon ships)

Building this surfaced several confirmed limitations in HydraDB's current
OpenCypher engine — worth knowing if you're building on it too:

- **No `MATCH`-then-`CREATE`.** Attaching a new node to something that
  already exists isn't supported yet ("write query is not executable by the
  mutation engine"). **`MERGE` is the workaround** the HydraDB team confirmed
  on Discord — every write here is a single `MERGE (a {...})-[:REL]->(b {...})`
  clause.
- **`id` must be a real integer**, on both `CREATE` and `MERGE` — string-only
  node identity gets rejected. `lib/hydra.ts` hashes application keys into a
  31-bit id and keeps the string as a separate `key` property for reads.
- **`WHERE NOT (pattern)` and whole-node `RETURN`** aren't supported yet —
  `WHERE` only does property comparisons, and `RETURN` only does
  `binding.property` or `count(*)`. "Is this memory superseded" is resolved
  client-side; every read projects scalar fields explicitly.
- **The default `CLOUD_PROVIDER=local` backend can't run `MERGE`** — its
  `LocalFileSystem` object store doesn't implement the conditional
  (`PutMode::Update`) writes `MERGE` needs. `docker-compose.hydradb.yml` runs
  HydraDB against MinIO (S3-compatible) instead, which does.
- Plain `MATCH ... SET` and `MATCH ... DETACH DELETE` **do** work fine
  (arithmetic `SET n.x = n.x + 1` doesn't — literals only), so updates and
  deletes are possible even without `MERGE`'s `ON CREATE`/`ON MATCH` (also
  unsupported).

## Tech

Next.js 16 (App Router) · HydraDB (Bolt via `neo4j-driver`) · AWS DynamoDB ·
Groq (`llama-3.3-70b` extraction, `llama-3.1-8b-instant` answering) · Jina
embeddings · NextAuth (Google OAuth). `docker-compose.hydradb.yml` runs
HydraDB + MinIO for local development.
