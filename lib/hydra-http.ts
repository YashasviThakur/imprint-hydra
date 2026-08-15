// HydraDB client over the HTTP query API — same public interface as
// lib/hydra.ts (Bolt), for use when only an HTTP(S) endpoint is reachable
// (e.g. a Vercel deployment reaching a tunneled local instance, where a raw
// TCP tunnel isn't available). Same graph model, same MERGE/id/scalar-RETURN
// constraints — see lib/hydra.ts's top comment for the full story; this file
// only changes the transport.
//
// Response cell format confirmed via direct testing:
//   {"type": "string" | "float" | "boolean" | "vertex_id" | ..., "value": <value>}
// Parameters go in a top-level "parameters" object (not "params" — that name
// is silently ignored, "missing OpenCypher query parameter" is the tell).

function stableId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h & 0x7fffffff;
}
const sessionNodeId = (sessionId: string) => stableId(`session:${sessionId}`);
const memoryNodeId = (memoryKey: string) => stableId(`memory:${memoryKey}`);
const entityNodeId = (userId: string, entityName: string) => stableId(`entity:${userId}:${entityName}`);

export interface HydraMemory {
  key: string;
  userId: string;
  sessionId: string;
  content: string;
  topic: string;
  ts: string;
  confidence: number;
}

function baseUrl(): string {
  const url = process.env.HYDRA_HTTP_URL;
  if (!url) throw new Error("HYDRA_HTTP_URL not set");
  return url.replace(/\/$/, "");
}
function authToken(): string {
  return process.env.HYDRA_AUTH_TOKEN || "local-development-token-32-bytes";
}

async function runQuery(query: string, parameters: Record<string, unknown> = {}): Promise<unknown[][]> {
  const res = await fetch(`${baseUrl()}/v1/graphs/default/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken()}`,
      "X-Graph-Namespace": "default",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cell_id: "cell-0", query, parameters }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `HydraDB HTTP query failed: ${res.status}`);
  }
  const rows: { type: string; value: unknown }[][] = json.rows || [];
  return rows.map((row) => row.map((cell) => cell.value));
}

// ── Writes ──────────────────────────────────────────────────

export async function ensureSession(userId: string, sessionId: string, ts: string): Promise<void> {
  await runQuery(
    `MERGE (u:User {id: $userNodeId})-[:HAS_SESSION]->(sess:Session {id: $sessionNodeId, key: $sessionId, userId: $userId, ts: $ts})`,
    { userNodeId: stableId(`user:${userId}`), sessionNodeId: sessionNodeId(sessionId), sessionId, userId, ts }
  );
}

export async function saveMemory(memory: HydraMemory): Promise<void> {
  await runQuery(
    `MERGE (sess:Session {id: $sessionNodeId})-[:CONTAINS]->(m:Memory {
       id: $memoryNodeId, key: $key, userId: $userId, sessionId: $sessionId, content: $content,
       topic: $topic, ts: $ts, confidence: $confidence
     })`,
    { ...memory, sessionNodeId: sessionNodeId(memory.sessionId), memoryNodeId: memoryNodeId(memory.key) }
  );
}

export async function linkEntity(memoryKey: string, userId: string, entityName: string): Promise<void> {
  await runQuery(
    `MERGE (m:Memory {id: $memoryNodeId})-[:ABOUT]->(e:Entity {id: $entityNodeId, key: $entityName, userId: $userId})`,
    { memoryNodeId: memoryNodeId(memoryKey), entityNodeId: entityNodeId(userId, entityName), entityName, userId }
  );
}

export async function linkSupersedes(
  newMemoryKey: string,
  oldMemoryKey: string,
  reason: string,
  confidence: number
): Promise<void> {
  await runQuery(
    `MERGE (n:Memory {id: $newId})-[:SUPERSEDES {reason: $reason, confidence: $confidence}]->(o:Memory {id: $oldId})`,
    { newId: memoryNodeId(newMemoryKey), oldId: memoryNodeId(oldMemoryKey), reason, confidence }
  );
}

// ── Reads ───────────────────────────────────────────────────

const MEMORY_FIELDS =
  "m.key AS key, m.userId AS userId, m.sessionId AS sessionId, m.content AS content, " +
  "m.topic AS topic, m.ts AS ts, m.confidence AS confidence";

function rowToMemory(row: unknown[]): HydraMemory {
  const [key, userId, sessionId, content, topic, ts, confidence] = row;
  return { key: key as string, userId: userId as string, sessionId: sessionId as string, content: content as string, topic: topic as string, ts: ts as string, confidence: confidence as number };
}

async function getSupersededKeys(userId: string): Promise<Set<string>> {
  const rows = await runQuery(
    `MATCH (n:Memory)-[:SUPERSEDES]->(old:Memory) WHERE old.userId = $userId RETURN old.key AS key`,
    { userId }
  );
  return new Set(rows.map((r) => r[0] as string));
}

export async function getCurrentFactsAboutEntity(userId: string, entityName: string): Promise<HydraMemory[]> {
  const rows = await runQuery(
    `MATCH (m:Memory {userId: $userId})-[:ABOUT]->(e:Entity {id: $entityNodeId})
     RETURN ${MEMORY_FIELDS} ORDER BY m.ts DESC`,
    { userId, entityNodeId: entityNodeId(userId, entityName) }
  );
  const superseded = await getSupersededKeys(userId);
  return rows.map(rowToMemory).filter((m) => !superseded.has(m.key));
}

export async function getSupersedeChain(memoryKey: string): Promise<HydraMemory[]> {
  const rows = await runQuery(
    `MATCH (m:Memory {id: $memoryNodeId})-[:SUPERSEDES*0..10]->(old:Memory)
     RETURN old.key AS key, old.userId AS userId, old.sessionId AS sessionId, old.content AS content,
            old.topic AS topic, old.ts AS ts, old.confidence AS confidence
     ORDER BY old.ts DESC`,
    { memoryNodeId: memoryNodeId(memoryKey) }
  );
  return rows.map(rowToMemory);
}

export async function getCurrentFactsForUser(userId: string, limit = 200): Promise<HydraMemory[]> {
  const rows = await runQuery(
    `MATCH (sess:Session {userId: $userId})-[:CONTAINS]->(m:Memory)
     RETURN ${MEMORY_FIELDS} ORDER BY m.ts ASC`,
    { userId }
  );
  const superseded = await getSupersededKeys(userId);
  return rows.map(rowToMemory).filter((m) => !superseded.has(m.key)).slice(0, limit);
}

export async function closeHydraDriver(): Promise<void> {
  // no-op — HTTP is stateless, nothing to close
}
