import neo4j, { Driver, Session as BoltSession } from "neo4j-driver";

// HydraDB client — Bolt protocol (Neo4j-compatible), OpenCypher subset.
// Graph model:
//   (:Session {key, userId, ts})-[:CONTAINS]->(:Memory {key, content, topic, ts, confidence})
//   (:Memory)-[:SUPERSEDES {reason, confidence}]->(:Memory)   -- new fact supersedes old fact
//   (:Memory)-[:ABOUT]->(:Entity {name})
//
// Property is named `key`, not `id` — HydraDB reserves `id` as an internal
// integer vertex identifier ("node id property must be an integer"), so our
// UUID-based application ids live under a different property name.
//
// "Current" fact for an entity = a Memory with no INCOMING SUPERSEDES edge
// (nothing has superseded it yet). Chronology comes from ORDER BY on ts —
// no separate NEXT chain needed, Session/Memory both carry ts.

let driver: Driver | null = null;

function getDriver(): Driver {
  if (driver) return driver;
  const url = process.env.HYDRA_BOLT_URL || "neo4j://127.0.0.1:7687";
  const token = process.env.HYDRA_AUTH_TOKEN || "local-development-token-32-bytes";
  driver = neo4j.driver(url, neo4j.auth.bearer(token));
  return driver;
}

async function withSession<T>(fn: (s: BoltSession) => Promise<T>): Promise<T> {
  const session = getDriver().session();
  try {
    return await fn(session);
  } finally {
    await session.close();
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

export async function ensureSession(
  userId: string,
  sessionId: string,
  ts: string
): Promise<void> {
  await withSession(async (s) => {
    const exists = await s.run(
      `MATCH (sess:Session {key: $sessionId, userId: $userId}) RETURN sess.key AS key`,
      { userId, sessionId }
    );
    if (exists.records.length) return;
    await s.run(
      `CREATE (:Session {key: $sessionId, userId: $userId, ts: $ts})`,
      { userId, sessionId, ts }
    );
  });
}

export async function saveMemory(memory: HydraMemory): Promise<void> {
  await withSession(async (s) => {
    await s.run(
      `MATCH (sess:Session {key: $sessionId, userId: $userId})
       CREATE (m:Memory {
         key: $key, userId: $userId, content: $content,
         topic: $topic, ts: $ts, confidence: $confidence
       })
       CREATE (sess)-[:CONTAINS]->(m)`,
      memory
    );
  });
}

// Attach a memory to an entity, creating the entity node if it doesn't
// already exist (application-level upsert — MERGE support in HydraDB's
// OpenCypher subset isn't confirmed yet, so this stays a plain query+create).
export async function linkEntity(memoryKey: string, userId: string, entityName: string): Promise<void> {
  await withSession(async (s) => {
    const existing = await s.run(
      `MATCH (e:Entity {name: $entityName, userId: $userId}) RETURN e.name AS name`,
      { entityName, userId }
    );
    if (!existing.records.length) {
      await s.run(`CREATE (:Entity {name: $entityName, userId: $userId})`, { entityName, userId });
    }
    await s.run(
      `MATCH (m:Memory {key: $memoryKey}), (e:Entity {name: $entityName, userId: $userId})
       CREATE (m)-[:ABOUT]->(e)`,
      { memoryKey, entityName, userId }
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
      `MATCH (n:Memory {key: $newMemoryKey}), (o:Memory {key: $oldMemoryKey})
       CREATE (n)-[:SUPERSEDES {reason: $reason, confidence: $confidence}]->(o)`,
      { newMemoryKey, oldMemoryKey, reason, confidence }
    );
  });
}

// ── Reads ───────────────────────────────────────────────────

// Current (non-superseded) facts about an entity, newest first.
export async function getCurrentFactsAboutEntity(
  userId: string,
  entityName: string
): Promise<HydraMemory[]> {
  return withSession(async (s) => {
    const result = await s.run(
      `MATCH (m:Memory {userId: $userId})-[:ABOUT]->(:Entity {name: $entityName, userId: $userId})
       WHERE NOT ( ()-[:SUPERSEDES]->(m) )
       RETURN m ORDER BY m.ts DESC`,
      { userId, entityName }
    );
    return result.records.map((r) => r.get("m").properties as HydraMemory);
  });
}

// Full revision history for a fact, oldest last — the audit trail behind
// "what changed and when" (bounded to 10 hops; HydraDB supports bounded
// variable-length paths).
export async function getSupersedeChain(memoryKey: string): Promise<HydraMemory[]> {
  return withSession(async (s) => {
    const result = await s.run(
      `MATCH path = (m:Memory {key: $memoryKey})-[:SUPERSEDES*0..10]->(old:Memory)
       RETURN old ORDER BY old.ts DESC`,
      { memoryKey }
    );
    return result.records.map((r) => r.get("old").properties as HydraMemory);
  });
}

// Cross-session synthesis: every current fact for a user, in session order —
// the shape a LongMemEval-style multi-hop question needs.
export async function getCurrentFactsForUser(userId: string, limit = 200): Promise<HydraMemory[]> {
  return withSession(async (s) => {
    const result = await s.run(
      `MATCH (sess:Session {userId: $userId})-[:CONTAINS]->(m:Memory)
       WHERE NOT ( ()-[:SUPERSEDES]->(m) )
       RETURN m ORDER BY m.ts ASC
       LIMIT $limit`,
      { userId, limit: neo4j.int(limit) }
    );
    return result.records.map((r) => r.get("m").properties as HydraMemory);
  });
}

export async function closeHydraDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
