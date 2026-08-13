import type { HydraMemory } from "./hydra";

// Temporary in-memory stand-in for lib/hydra.ts, same exported function
// signatures. HydraDB's write engine currently rejects any MATCH-then-CREATE
// query ("write query is not executable by the mutation engine" — confirmed
// on both Bolt and HTTP against ghcr.io/hydra-db/hydradb:latest, reported to
// the Hack Hydra Discord). This lets the LongMemEval harness get built and
// verified now; swap the import back to ./hydra once that's fixed.

interface Session {
  key: string;
  userId: string;
  ts: string;
}

const sessions = new Map<string, Session>(); // key: `${userId}::${sessionId}`
const memories = new Map<string, HydraMemory>(); // key: memory key
const sessionMemories = new Map<string, string[]>(); // sessionKey -> memory keys
const memoryEntities = new Map<string, Set<string>>(); // memory key -> entity names
const entityMemories = new Map<string, string[]>(); // `${userId}::${entityName}` -> memory keys, insertion order
const supersedes = new Map<string, string[]>(); // memory key -> keys it supersedes (outgoing)
const supersededBy = new Map<string, string[]>(); // memory key -> keys that supersede it (incoming)

function sessKey(userId: string, sessionId: string) {
  return `${userId}::${sessionId}`;
}
function entKey(userId: string, entityName: string) {
  return `${userId}::${entityName}`;
}

export async function ensureSession(userId: string, sessionId: string, ts: string): Promise<void> {
  const k = sessKey(userId, sessionId);
  if (!sessions.has(k)) sessions.set(k, { key: sessionId, userId, ts });
}

export async function saveMemory(memory: HydraMemory): Promise<void> {
  memories.set(memory.key, memory);
  const sk = sessKey(memory.userId, memory.sessionId);
  const list = sessionMemories.get(sk) ?? [];
  list.push(memory.key);
  sessionMemories.set(sk, list);
}

export async function linkEntity(memoryKey: string, userId: string, entityName: string): Promise<void> {
  const set = memoryEntities.get(memoryKey) ?? new Set<string>();
  set.add(entityName);
  memoryEntities.set(memoryKey, set);
  const ek = entKey(userId, entityName);
  const list = entityMemories.get(ek) ?? [];
  list.push(memoryKey);
  entityMemories.set(ek, list);
}

export async function linkSupersedes(
  newMemoryKey: string,
  oldMemoryKey: string,
  _reason: string,
  _confidence: number
): Promise<void> {
  const out = supersedes.get(newMemoryKey) ?? [];
  out.push(oldMemoryKey);
  supersedes.set(newMemoryKey, out);
  const inn = supersededBy.get(oldMemoryKey) ?? [];
  inn.push(newMemoryKey);
  supersededBy.set(oldMemoryKey, inn);
}

function isCurrent(memoryKey: string): boolean {
  return !(supersededBy.get(memoryKey)?.length);
}

export async function getCurrentFactsAboutEntity(userId: string, entityName: string): Promise<HydraMemory[]> {
  const ek = entKey(userId, entityName);
  const keys = entityMemories.get(ek) ?? [];
  return keys
    .filter(isCurrent)
    .map((k) => memories.get(k)!)
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

export async function getSupersedeChain(memoryKey: string): Promise<HydraMemory[]> {
  const chain: HydraMemory[] = [];
  const seen = new Set<string>();
  let frontier = [memoryKey];
  for (let hop = 0; hop < 10 && frontier.length; hop++) {
    const next: string[] = [];
    for (const k of frontier) {
      for (const oldKey of supersedes.get(k) ?? []) {
        if (seen.has(oldKey)) continue;
        seen.add(oldKey);
        const m = memories.get(oldKey);
        if (m) chain.push(m);
        next.push(oldKey);
      }
    }
    frontier = next;
  }
  return chain.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

export async function getCurrentFactsForUser(userId: string, limit = 200): Promise<HydraMemory[]> {
  const out: HydraMemory[] = [];
  for (const m of memories.values()) {
    if (m.userId === userId && isCurrent(m.key)) out.push(m);
  }
  return out.sort((a, b) => (a.ts < b.ts ? -1 : 1)).slice(0, limit);
}

export async function closeHydraDriver(): Promise<void> {
  // no-op for the in-memory store
}

export function resetMockStore(): void {
  sessions.clear();
  memories.clear();
  sessionMemories.clear();
  memoryEntities.clear();
  entityMemories.clear();
  supersedes.clear();
  supersededBy.clear();
}
