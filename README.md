# Imprint × HydraDB

A submission for **Hack Hydra** (Track 03: Memory + Context Retrieval) — [github.com/hydra-db/hydradb](https://github.com/hydra-db/hydradb).

Imprint is an existing persistent-memory layer for AI coding agents
([github.com/YashasviThakur/Imprint](https://github.com/YashasviThakur/Imprint),
live at [imprint-ebon.vercel.app](https://imprint-ebon.vercel.app)). This repo
is a fork of that project (from commit `cc5015c`) adapted for Hack Hydra:
HydraDB's graph model replaces flat vector-cosine retrieval for the part
Track 03 actually asks for — cross-session synthesis, chronological
reasoning, tracking facts that get overwritten, and abstaining correctly
when the answer just isn't there.

**Disclosure** (per the submission rules): the Next.js dashboard, auth,
extraction pipeline, and contradiction-detection engine are carried over from
the existing Imprint product and predate this hackathon — see its own
[README](https://github.com/YashasviThakur/Imprint#readme) and
[CHANGELOG](https://github.com/YashasviThakur/Imprint/blob/main/CHANGELOG.md)
for that history. What's new, built during the Aug 12–20 window, is
everything HydraDB-related below.

## What's actually new here

- **`lib/hydra.ts`** — the HydraDB graph client (Bolt protocol). Graph model:
  `(:Session)-[:CONTAINS]->(:Memory)-[:SUPERSEDES]->(:Memory)`,
  `(:Memory)-[:ABOUT]->(:Entity)`. "Current" fact for a user/entity = a Memory
  with no incoming `SUPERSEDES` edge; chronology comes from `ORDER BY ts`, not
  a separate linked list.
- **`lib/hydra-http.ts`** + **`lib/hydra-client.ts`** — an HTTP-based client
  against HydraDB's query API (same interface as the Bolt client), for when
  only an HTTP(S) endpoint is reachable — e.g. this app deployed on Vercel,
  reaching a tunneled HydraDB instance. `hydra-client.ts` picks Bolt or HTTP
  automatically based on environment; nothing else in the app needs to know
  which transport is live.
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
- **Read/write cost tracking + a `superseded` flag** — after reading HydraDB's
  actual `cypher-compat.md` (not just inferring behavior from error messages),
  found that plain `MATCH ... SET` on an already-matched node is supported.
  `linkSupersedes` now flips a `superseded` property directly, so every read
  is one query with a plain `WHERE` clause instead of two queries plus
  client-side filtering against a fetched set of superseded keys. Query
  timing is tracked per read/write and reported by the benchmark harness —
  see the real numbers below, answering Track 03's "read and write cost that
  would survive real usage" criterion, which had zero coverage before this.
- **`getGraphStats`** — total current facts, superseded facts, and distinct
  entities via HydraDB's `count()`/`collect()` aggregates, surfaced in
  `/api/ask-graph`'s response.

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

npm run dev
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

For the full-scale benchmark (the ~40-session/~115K-token haystacks the track
brief actually describes, not just the oracle's evidence-only sessions —
277MB download):

```bash
curl -sL https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_s_cleaned.json \
  -o scripts/data/longmemeval_s_cleaned.json
npx tsx scripts/benchmark-longmemeval.ts 5 --full
```

## Full-scale benchmark result

The 8-instance oracle-file run (evidence sessions only) hits 3/8 correct on a
deliberately crude proxy scorer, 3/3 correct abstentions, with real measured
HydraDB cost: **25 reads averaging ~102ms, 176 writes averaging ~34ms** for
the run.

At the real `longmemeval_s_cleaned.json` scale (60-88 extracted facts per
instance, matching the track brief's ~40-session/~115K-token description),
the answer step now narrows to the 25 most query-relevant facts first
(`lib/relevance.ts`, keyword overlap scored and ranked in application code)
before calling the model, instead of handing it every current fact. HydraDB
can't help with this ranking directly: property values are ints, floats,
booleans, and strings only, with no array/list type
(`cypher-compat.md`), so a fact's embedding can't be stored on the node and
searched in the graph.

A 3-instance full-scale run hit a real scale limit before this narrowing
mattered: `linkEntity` failed with `client_query_runtime exceeded query
timeout after 29999ms` partway through instance one, once the graph had
accumulated enough nodes from prior facts in the same run. A 2-instance run
completed cleanly: 1/2 correct on the proxy scorer, 1/1 correct abstention,
real cost **97 reads averaging ~221ms, 590 writes averaging ~31ms**. The
30-second query timeout at high node counts is a genuine v0.1.1 scale
limit worth flagging, not a bug in this integration.

## A real HydraDB gotcha (v0.1.1, the exact release this hackathon ships)

Building this surfaced several confirmed limitations in HydraDB's current
OpenCypher engine — worth knowing if you're building on it too:

- **No `MATCH`-then-`CREATE`.** Attaching a new node to something that
  already exists isn't supported yet ("write query is not executable by the
  mutation engine"). **`MERGE` is the workaround** the HydraDB team confirmed
  on Discord — every write here is a single `MERGE (a {...})-[:REL]->(b {...})`
  clause.
- **`id` must be a real integer**, on both `CREATE` and `MERGE` — string-only
  node identity gets rejected, and it must arrive as a true Bolt integer
  (plain JS numbers passed as driver parameters serialize as floats and get
  rejected too — wrap with `neo4j.int()`). `lib/hydra.ts` hashes application
  keys into a 31-bit id and keeps the string as a separate `key` property.
- **`WHERE NOT (pattern)` and whole-node `RETURN`** aren't supported —
  `WHERE` only does property comparisons (`NOT` on a comparison is fine, just
  not on a pattern's existence), and `RETURN` only does `binding.property` or
  an aggregate (`count`, `sum`, `avg`, `collect` — `min`/`max` aren't
  supported, and no `DISTINCT` inside an aggregate argument, so a distinct
  count is `collect()` + a client-side `Set`). "Is this memory superseded"
  is a plain `superseded` boolean property, flipped by `MATCH ... SET` — see
  above.
- **The default `CLOUD_PROVIDER=local` backend can't run `MERGE`** — its
  `LocalFileSystem` object store doesn't implement the conditional
  (`PutMode::Update`) writes `MERGE` needs. `docker-compose.hydradb.yml` runs
  HydraDB against MinIO (S3-compatible) instead, which does.
- Plain `MATCH ... SET` and `MATCH ... DETACH DELETE` **do** work fine
  (arithmetic `SET n.x = n.x + 1` doesn't — literals only), so updates and
  deletes are possible even without `MERGE`'s `ON CREATE`/`ON MATCH` (also
  unsupported).
- **`UNWIND` batches writes**, but narrower than it first looks: the
  `MERGE`-based batch form only upserts a single bare vertex per row (`MERGE
  (n {id: row.x}) SET ...`) — it rejects an edge pattern outright ("UNWIND
  vertex MERGE requires exactly one node"). The `MATCH`-then-`CREATE` batch
  form (shown in HydraDB's own docs) needs *both* relationship endpoints to
  already exist via separate `MATCH` clauses — it can't attach a new node to
  one existing anchor in a single batched write. Batching our
  session→memory writes would need two round trips (batch-upsert the memory
  vertices, then batch-attach them to the session), not the one hoped for;
  not implemented here given the time left.

## Deploying (Vercel + HydraDB reachability)

Vercel hosts the Next.js app fine — that's unchanged from how Imprint
already deploys. HydraDB itself can't go on Vercel: it's a long-running
server holding a raw TCP port open, and Vercel Functions are serverless
(spin up per request, no persistent process, no arbitrary Docker
containers). So HydraDB needs to keep running somewhere Vercel's functions
can reach it over the network.

This repo's setup: HydraDB stays on `docker-compose.hydradb.yml` (locally,
or on any host that can run it), exposed via an **ngrok HTTP tunnel** —
`ngrok http 8443` against HydraDB's HTTP query API. ngrok's *TCP* tunnels
(what the Bolt protocol needs) require a credit card on their free tier;
HTTP tunnels don't. `lib/hydra-http.ts` is the from-scratch client against
that HTTP API, correctness verified against a live tunnel in
`scripts/test-hydra-http.ts`.

```bash
ngrok http 8443
# copy the https://….ngrok-free.dev URL it prints
```

Set on Vercel: `HYDRA_HTTP_URL=https://your-tunnel.ngrok-free.dev`,
`HYDRA_AUTH_TOKEN=local-development-token-32-bytes` (or whatever
`hydradb-data/auth-token` / the compose file's init container actually
wrote), plus the existing DynamoDB/Groq/Jina/NextAuth secrets Imprint
already needs.

**Caveat, stated plainly:** this makes HydraDB reachable while your machine,
Docker, and the ngrok tunnel are all running — not a permanent 24/7
deployment. ngrok's free-tier URL also changes on every tunnel restart. Good
enough for a live demo or a judging window; a real always-on deployment
would mean hosting HydraDB on something like Fly.io instead (persistent
containers, a stable public address) — not done here for lack of a card to
put on file with a hosting provider mid-hackathon.

## A Groq gotcha, unrelated to HydraDB but worth flagging

While debugging why the LLM answer step kept returning `null`, found that
`llama-3.1-8b-instant` and `llama-3.3-70b` — the models this whole codebase's
Groq calls were hardcoded to (extraction, contradiction detection, `/api/ask`,
`/api/ask-graph`, semantic-search AI fallback, natural-language memory
editing) — have been retired from Groq's lineup entirely (`model_not_found`,
404). Every provider error in `lib/llm.ts` is caught and turned into a `null`
return so the app degrades gracefully, which is good for resilience and bad
for debugging: this was silently breaking every AI feature in the deployed
app before this pass, with no visible error anywhere. Fixed across the board
to `openai/gpt-oss-20b` / `openai/gpt-oss-120b` — Groq's current fast/cheap
and versatile-tier equivalents — plus `reasoning_effort: "low"`, since the
gpt-oss models emit hidden reasoning tokens that can consume the entire
`max_tokens` budget before producing any visible content otherwise.

## Tech

Next.js 16 (App Router) · HydraDB (Bolt via `neo4j-driver` locally, HTTP
query API via a tunnel when deployed) · AWS DynamoDB · Groq (`gpt-oss-120b`
extraction, `gpt-oss-20b` answering) · Jina embeddings · NextAuth (Google
OAuth). `docker-compose.hydradb.yml` runs HydraDB + MinIO for local
development.
