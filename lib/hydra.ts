import neo4j, { Driver, Session as BoltSession } from "neo4j-driver";

// HydraDB client — Bolt protocol (Neo4j-compatible), OpenCypher subset.
// Graph model:
//   (:Session {id, key, userId, ts})-[:CONTAINS]->(:Memory {id, key, content, topic, ts, confidence, superseded})
//   (:Memory)-[:SUPERSEDES {reason, confidence}]->(:Memory)   -- new fact supersedes old fact
//   (:Memory)-[:ABOUT]->(:Entity {id, key, userId})
//
// Every write is a SINGLE `MERGE (a {...})-[:REL]->(b {...})` clause. Two
// confirmed engine limitations shaped this (reported to the Hack Hydra
// Discord, workaround provided by their team 2026-08-15):
//   - No bare single-node CREATE/MERGE — every node must be created as part
//     of a one-hop edge pattern, never standalone.
//   - No ON CREATE/ON MATCH actions yet, and no MATCH-then-CREATE at all —
//     so a node's properties must all be given at the point it's first
//     merged; there's no way to conditionally set fields after the fact.
// MERGE correctly upserts on a SUBSET of a node's properties (verified: a
// later MERGE matching only `id` finds and reuses a node created earlier
// with more properties, without touching or duplicating it) — so any write
// that references an existing node only needs to carry its `id`.
//
// HydraDB reserves `id` as an internal integer vertex identifier (confirmed:
// string ids are rejected with "requires source/destination id"). Since our
// natural keys are strings (UUIDs, session ids, entity names), `id` here is
// a deterministic 31-bit hash of a type-prefixed string — collisions are
// astronomically unlikely at hackathon-benchmark scale, but this is a hash,
// not a guarantee; `key` (the original string) stays the source of truth
// for everything read-side.
//
// "Current" fact = a Memory with `superseded = false`. Per HydraDB's own
// cypher-compat.md, plain `MATCH ... SET` on an already-matched node is
// supported (just not MATCH-then-CREATE), so linkSupersedes flips this flag
// on the superseded memory directly — every read is then a single query with
// a plain property WHERE clause, not a second query plus client-side
// filtering against a fetched set of superseded keys (the original design,
// before this property existed).

function stableId(s: string) {
  let h = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return neo4j.int(h & 0x7fffffff); // positive, safely under int32 max — avoids the overflow HydraDB hit on Date.now()-sized ids
}
const sessionNodeId = (sessionId: string) => stableId(`session:${sessionId}`);
const memoryNodeId = (memoryKey: string) => stableId(`memory:${memoryKey}`);
const entityNodeId = (userId: string, entityName: string) => stableId(`entity:${userId}:${entityName}`);

let driver: Driver | null = null;

function getDriver(): Driver {
  if (driver) return driver;
  const url = process.env.HYDRA_BOLT_URL || "neo4j://127.0.0.1:7687";
  const token = process.env.HYDRA_AUTH_TOKEN || "local-development-token-32-bytes";
  driver = neo4j.driver(url, neo4j.auth.bearer(token));
  return driver;
}

// ── Cost tracking ───────────────────────────────────────────
// Track 03 explicitly asks for "read and write cost that would survive real
// usage" — this has real numbers to show for it instead of being unmeasured.
// Query text is classified by its leading clause; MERGE with no preceding
// MATCH is a write, everything starting MATCH is a read.
export interface QueryStats {
  reads: number;
  writes: number;
  readMs: number;
  writeMs: number;
}
let stats: QueryStats = { reads: 0, writes: 0, readMs: 0, writeMs: 0 };
export function getQueryStats(): QueryStats {
  return { ...stats };
}
export function resetQueryStats(): void {
  stats = { reads: 0, writes: 0, readMs: 0, writeMs: 0 };
}
function recordQuery(query: string, ms: number): void {
  const isWrite = /^\s*MERGE/.test(query);
  if (isWrite) {
    stats.writes++;
    stats.writeMs += ms;
  } else {
    stats.reads++;
    stats.readMs += ms;
  }
}

// The Bolt driver's routing discovery is flaky against this single-instance
// (non-cluster) server, especially on the first call after driver creation —
// observed failing 1-4 times in a row before succeeding. Retrying is safe;
// it's a client-side discovery hiccup, not a query correctness issue.
async function withSession<T>(fn: (s: BoltSession) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const session = getDriver().session();
    try {
      return await fn(session);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : "";
      if (attempt < 5 && /No routing servers available/.test(msg)) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      throw err;
    } finally {
      await session.close();
    }
  }
  throw lastErr;
}

// Timed wrapper around session.run — every query in this file goes through
// this instead of calling s.run() directly, so cost tracking can't be
// forgotten on a new query site.
async function run(s: BoltSession, query: string, params: Record<string, unknown> = {}) {
  const t0 = Date.now();
  try {
    return await s.run(query, params);
  } finally {
    recordQuery(query, Date.now() - t0);
  }
}

export interface HydraMemory {
  key: string;
  userId: string;
  sessionId: string;
  content: string;
  topic: string;
  ts: string; // ISO timestamp
  confidence: number;
}

// ── Writes ──────────────────────────────────────────────────

export async function ensureSession(userId: string, sessionId: string, ts: string): Promise<void> {
  await withSession(async (s) => {
    await run(
      s,
      `MERGE (u:User {id: $userNodeId})-[:HAS_SESSION]->(sess:Session {id: $sessionNodeId, key: $sessionId, userId: $userId, ts: $ts})`,
      { userNodeId: stableId(`user:${userId}`), sessionNodeId: sessionNodeId(sessionId), sessionId, userId, ts }
    );
  });
}

export async function saveMemory(memory: HydraMemory): Promise<void> {
  await withSession(async (s) => {
    await run(
      s,
      `MERGE (sess:Session {id: $sessionNodeId})-[:CONTAINS]->(m:Memory {
         id: $memoryNodeId, key: $key, userId: $userId, sessionId: $sessionId, content: $content,
         topic: $topic, ts: $ts, confidence: $confidence, superseded: false
       })`,
      { ...memory, sessionNodeId: sessionNodeId(memory.sessionId), memoryNodeId: memoryNodeId(memory.key) }
    );
  });
}

// Attach a memory to an entity, upserting the entity (MERGE reuses the same
// Entity node across every memory that links to it, matched by id).
export async function linkEntity(memoryKey: string, userId: string, entityName: string): Promise<void> {
  await withSession(async (s) => {
    await run(
      s,
      `MERGE (m:Memory {id: $memoryNodeId})-[:ABOUT]->(e:Entity {id: $entityNodeId, key: $entityName, userId: $userId})`,
      { memoryNodeId: memoryNodeId(memoryKey), entityNodeId: entityNodeId(userId, entityName), entityName, userId }
    );
  });
}

export async function linkSupersedes(
  newMemoryKey: string,
  oldMemoryKey: string,
  reason: string,
  confidence: number
): Promise<void> {
  await withSession(async (s) => {
    await run(
      s,
      `MERGE (n:Memory {id: $newId})-[:SUPERSEDES {reason: $reason, confidence: $confidence}]->(o:Memory {id: $oldId})`,
      { newId: memoryNodeId(newMemoryKey), oldId: memoryNodeId(oldMemoryKey), reason, confidence }
    );
    // Flip the old fact's flag directly (MATCH...SET is supported) instead of
    // leaving every reader to re-derive "superseded" from edge existence.
    await run(
      s,
      `MATCH (o:Memory {id: $oldId}) SET o.superseded = true`,
      { oldId: memoryNodeId(oldMemoryKey) }
    );
  });
}

// ── Reads ───────────────────────────────────────────────────

// RETURN only supports `<binding>.<property>` or an aggregate — no whole-node
// RETURN — so every read projects scalars explicitly and reassembles the
// object here.
const MEMORY_FIELDS =
  "m.key AS key, m.userId AS userId, m.sessionId AS sessionId, m.content AS content, " +
  "m.topic AS topic, m.ts AS ts, m.confidence AS confidence";

function recordToMemory(r: import("neo4j-driver").Record): HydraMemory {
  return {
    key: r.get("key"),
    userId: r.get("userId"),
    sessionId: r.get("sessionId"),
    content: r.get("content"),
    topic: r.get("topic"),
    ts: r.get("ts"),
    confidence: r.get("confidence"),
  };
}

// Current (non-superseded) facts about an entity, newest first.
export async function getCurrentFactsAboutEntity(
  userId: string,
  entityName: string
): Promise<HydraMemory[]> {
  return withSession(async (s) => {
    const result = await run(
      s,
      `MATCH (m:Memory {userId: $userId, superseded: false})-[:ABOUT]->(e:Entity {id: $entityNodeId})
       RETURN ${MEMORY_FIELDS} ORDER BY m.ts DESC`,
      { userId, entityNodeId: entityNodeId(userId, entityName) }
    );
    return result.records.map(recordToMemory);
  });
}

// Full revision history for a fact, oldest last — the audit trail behind
// "what changed and when" (bounded to 10 hops; HydraDB supports bounded
// variable-length paths).
export async function getSupersedeChain(memoryKey: string): Promise<HydraMemory[]> {
  return withSession(async (s) => {
    const result = await run(
      s,
      `MATCH (m:Memory {id: $memoryNodeId})-[:SUPERSEDES*0..10]->(old:Memory)
       RETURN old.key AS key, old.userId AS userId, old.sessionId AS sessionId, old.content AS content,
              old.topic AS topic, old.ts AS ts, old.confidence AS confidence
       ORDER BY old.ts DESC`,
      { memoryNodeId: memoryNodeId(memoryKey) }
    );
    return result.records.map(recordToMemory);
  });
}

// Cross-session synthesis: every current fact for a user, in session order —
// the shape a LongMemEval-style multi-hop question needs. One query, not two
// plus a client-side filter.
export async function getCurrentFactsForUser(userId: string, limit = 200): Promise<HydraMemory[]> {
  return withSession(async (s) => {
    const result = await run(
      s,
      `MATCH (sess:Session {userId: $userId})-[:CONTAINS]->(m:Memory {superseded: false})
       RETURN ${MEMORY_FIELDS} ORDER BY m.ts ASC
       LIMIT $limit`,
      { userId, limit: neo4j.int(limit) }
    );
    return result.records.map(recordToMemory);
  });
}

// Aggregate counts via HydraDB's count() — current facts, superseded facts,
// distinct entities for a user. Three cheap queries using a real HydraDB
// feature (aggregates) the rest of this client didn't otherwise touch.
export interface GraphStats {
  currentFacts: number;
  supersededFacts: number;
  entities: number;
}
export async function getGraphStats(userId: string): Promise<GraphStats> {
  return withSession(async (s) => {
    // Sequential, not Promise.all — a Bolt session doesn't support concurrent
    // queries. count(DISTINCT ...) isn't supported either (cypher-compat.md:
    // "Aggregate arguments marked DISTINCT" is explicitly rejected) —
    // collect() + a client-side Set is the actual supported way to get a
    // distinct count.
    const current = await run(s, `MATCH (:Session {userId: $userId})-[:CONTAINS]->(m:Memory {superseded: false}) RETURN count(*) AS c`, { userId });
    const superseded = await run(s, `MATCH (:Session {userId: $userId})-[:CONTAINS]->(m:Memory {superseded: true}) RETURN count(*) AS c`, { userId });
    const entityKeys = await run(s, `MATCH (:Memory {userId: $userId})-[:ABOUT]->(e:Entity) RETURN collect(e.key) AS keys`, { userId });
    const keys = (entityKeys.records[0]?.get("keys") as string[]) ?? [];
    return {
      currentFacts: current.records[0]?.get("c")?.toNumber?.() ?? 0,
      supersededFacts: superseded.records[0]?.get("c")?.toNumber?.() ?? 0,
      entities: new Set(keys).size,
    };
  });
}

export async function closeHydraDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
