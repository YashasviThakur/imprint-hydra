import neo4j, { Driver, Session as BoltSession } from "neo4j-driver";

// HydraDB client — Bolt protocol (Neo4j-compatible), OpenCypher subset.
// Graph model:
//   (:Session {id, key, userId, ts})-[:CONTAINS]->(:Memory {id, key, content, topic, ts, confidence, userId})
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
// "Current" fact for an entity = a Memory with no INCOMING SUPERSEDES edge
// (nothing has superseded it yet). Chronology comes from ORDER BY on ts —
// no separate NEXT chain needed, Session/Memory both carry ts.

// Returns a neo4j-driver Integer, not a plain number — HydraDB rejects `id`
// unless it arrives as a true Bolt integer, and plain JS numbers passed as
// query parameters (as opposed to literals embedded in query text) serialize
// as Bolt floats unless explicitly wrapped.
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
    await s.run(
      `MERGE (u:User {id: $userNodeId})-[:HAS_SESSION]->(sess:Session {id: $sessionNodeId, key: $sessionId, userId: $userId, ts: $ts})`,
      { userNodeId: stableId(`user:${userId}`), sessionNodeId: sessionNodeId(sessionId), sessionId, userId, ts }
    );
  });
}

export async function saveMemory(memory: HydraMemory): Promise<void> {
  await withSession(async (s) => {
    await s.run(
      `MERGE (sess:Session {id: $sessionNodeId})-[:CONTAINS]->(m:Memory {
         id: $memoryNodeId, key: $key, userId: $userId, sessionId: $sessionId, content: $content,
         topic: $topic, ts: $ts, confidence: $confidence
       })`,
      { ...memory, sessionNodeId: sessionNodeId(memory.sessionId), memoryNodeId: memoryNodeId(memory.key) }
    );
  });
}

// Attach a memory to an entity, upserting the entity (MERGE reuses the same
// Entity node across every memory that links to it, matched by id).
export async function linkEntity(memoryKey: string, userId: string, entityName: string): Promise<void> {
  await withSession(async (s) => {
    await s.run(
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
    await s.run(
      `MERGE (n:Memory {id: $newId})-[:SUPERSEDES {reason: $reason, confidence: $confidence}]->(o:Memory {id: $oldId})`,
      { newId: memoryNodeId(newMemoryKey), oldId: memoryNodeId(oldMemoryKey), reason, confidence }
    );
  });
}

// ── Reads ───────────────────────────────────────────────────

// RETURN only supports `<binding>.<property>` or `count(*)` — no whole-node
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

// WHERE only supports "boolean combinations of property comparisons" —
// `WHERE NOT (pattern)` (a negated existential pattern predicate) isn't
// supported, so "is this memory superseded" is resolved in application code:
// fetch which memory keys have an incoming SUPERSEDES edge, then filter.
async function getSupersededKeys(s: BoltSession, userId: string): Promise<Set<string>> {
  const result = await s.run(
    `MATCH (n:Memory)-[:SUPERSEDES]->(old:Memory) WHERE old.userId = $userId RETURN old.key AS key`,
    { userId }
  );
  return new Set(result.records.map((r) => r.get("key") as string));
}

// Current (non-superseded) facts about an entity, newest first.
export async function getCurrentFactsAboutEntity(
  userId: string,
  entityName: string
): Promise<HydraMemory[]> {
  return withSession(async (s) => {
    // Sequential, not Promise.all — a Bolt session doesn't support concurrent queries.
    const result = await s.run(
      `MATCH (m:Memory {userId: $userId})-[:ABOUT]->(e:Entity {id: $entityNodeId})
       RETURN ${MEMORY_FIELDS} ORDER BY m.ts DESC`,
      { userId, entityNodeId: entityNodeId(userId, entityName) }
    );
    const superseded = await getSupersededKeys(s, userId);
    return result.records.map(recordToMemory).filter((m) => !superseded.has(m.key));
  });
}

// Full revision history for a fact, oldest last — the audit trail behind
// "what changed and when" (bounded to 10 hops; HydraDB supports bounded
// variable-length paths).
export async function getSupersedeChain(memoryKey: string): Promise<HydraMemory[]> {
  return withSession(async (s) => {
    const result = await s.run(
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
// the shape a LongMemEval-style multi-hop question needs.
export async function getCurrentFactsForUser(userId: string, limit = 200): Promise<HydraMemory[]> {
  return withSession(async (s) => {
    const result = await s.run(
      `MATCH (sess:Session {userId: $userId})-[:CONTAINS]->(m:Memory)
       RETURN ${MEMORY_FIELDS} ORDER BY m.ts ASC`,
      { userId }
    );
    const superseded = await getSupersededKeys(s, userId);
    return result.records
      .map(recordToMemory)
      .filter((m) => !superseded.has(m.key))
      .slice(0, limit);
  });
}

export async function closeHydraDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
