// Verifies the new app-integration logic directly (mirrorToHydra + the
// ask-graph retrieval/answer path), bypassing only the pre-existing Next.js
// HTTP/auth/DynamoDB plumbing this environment has no credentials to run.
import { mirrorToHydra } from "../lib/hydra-sync";
import { getCurrentFactsForUser, closeHydraDriver } from "../lib/hydra";
import { llmComplete } from "../lib/llm";

const userId = `app-integration-test-${Date.now()}`;

async function main() {
  const t0 = new Date("2026-08-10T09:00:00Z").toISOString();
  const t1 = new Date("2026-08-14T09:00:00Z").toISOString();

  // Simulates the direct-save branch of POST /api/memories
  await mirrorToHydra({
    memoryId: "mem-old-1",
    userId,
    content: "User's favorite programming language is Python",
    topic: "preferences",
    createdAt: t0,
    confidence: 0.9,
    keywords: ["python", "language"],
  });

  // A later, contradicting save — mirrors what the real contradiction
  // detector in app/api/memories/route.ts would pass as `contradicts`.
  await mirrorToHydra({
    memoryId: "mem-new-1",
    userId,
    content: "User's favorite programming language is now Rust, switched from Python",
    topic: "preferences",
    createdAt: t1,
    confidence: 0.9,
    keywords: ["rust", "language"],
    contradicts: [{ existingMemoryId: "mem-old-1", reason: "Switched from Python to Rust" }],
  });

  const facts = await getCurrentFactsForUser(userId);
  console.log("Current facts after mirror:", facts.map((f) => f.content));
  if (facts.length !== 1 || facts[0].content !== "User's favorite programming language is now Rust, switched from Python") {
    throw new Error(`Expected only the Rust fact as current, got: ${JSON.stringify(facts)}`);
  }

  // Simulates the ask-graph route's answer step.
  const factLines = facts.map((f) => `- [${f.ts}] ${f.content}`).join("\n");
  const system =
    "Answer the question using ONLY the facts below. If they don't contain the answer, say 'NOT_ENOUGH_INFO'. Be concise.\n\n" +
    `=== FACTS ===\n${factLines}\n=== END FACTS ===`;
  const answer = await llmComplete(
    [{ role: "system", content: system }, { role: "user", content: "What's my favorite programming language?" }],
    { temperature: 0, maxTokens: 60 }
  );
  console.log("Answer:", answer);
  if (!answer || !/rust/i.test(answer)) throw new Error(`Expected an answer mentioning Rust, got: ${answer}`);
  if (/python/i.test(answer)) throw new Error(`Answer incorrectly mentions the superseded fact (Python): ${answer}`);

  // Abstention case: a question the graph has no facts for at all.
  const emptyUserId = `app-integration-empty-${Date.now()}`;
  const emptyFacts = await getCurrentFactsForUser(emptyUserId);
  if (emptyFacts.length !== 0) throw new Error("Expected no facts for a brand-new user");

  console.log("\nALL CHECKS PASSED");
  await closeHydraDriver();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
