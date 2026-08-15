import { ensureSession, saveMemory, linkEntity, linkSupersedes } from "./hydra-client";

// Best-effort mirror of a saved memory into the HydraDB graph, alongside the
// existing DynamoDB write. Dual-write, not a replacement: DynamoDB stays the
// source of truth for the dashboard (pin/edit/delete, budget-aware context,
// semantic search) while every save also builds the graph HydraDB needs for
// temporal/cross-session reasoning — see app/api/ask-graph for the payoff.
//
// Never throws — a HydraDB hiccup must not break the memory save the user is
// waiting on. Reuses the DynamoDB memoryId as the HydraDB `key` so the same
// fact carries one id across both stores; a session groups a user's saves by
// day (MCP has no session concept to pass through yet).
export async function mirrorToHydra(params: {
  memoryId: string;
  userId: string;
  content: string;
  topic: string;
  createdAt: string;
  confidence: number;
  keywords: string[];
  contradicts?: { existingMemoryId: string; reason: string }[];
}): Promise<void> {
  try {
    const sessionId = `${params.userId}-${params.createdAt.slice(0, 10)}`; // per user per day
    await ensureSession(params.userId, sessionId, params.createdAt);
    await saveMemory({
      key: params.memoryId,
      userId: params.userId,
      sessionId,
      content: params.content,
      topic: params.topic,
      ts: params.createdAt,
      confidence: params.confidence,
    });
    for (const kw of params.keywords.slice(0, 3)) {
      await linkEntity(params.memoryId, params.userId, kw);
    }
    for (const c of params.contradicts ?? []) {
      await linkSupersedes(params.memoryId, c.existingMemoryId, c.reason, 0.8);
    }
  } catch (err) {
    console.warn("[hydra-sync] mirror failed (non-fatal):", err);
  }
}
