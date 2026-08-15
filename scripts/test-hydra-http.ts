import {
  ensureSession,
  saveMemory,
  linkEntity,
  linkSupersedes,
  getCurrentFactsAboutEntity,
  getSupersedeChain,
  getCurrentFactsForUser,
} from "../lib/hydra-http";

const USER = "test-user-http";

async function main() {
  const t0 = new Date("2026-08-10T10:00:00Z").toISOString();
  const t1 = new Date("2026-08-11T10:00:00Z").toISOString();

  await ensureSession(USER, "session-1", t0);
  await ensureSession(USER, "session-2", t1);

  const memA = { key: "mem-a-http", userId: USER, sessionId: "session-1", content: "User uses React", topic: "preferences", ts: t0, confidence: 0.9 };
  const memB = { key: "mem-b-http", userId: USER, sessionId: "session-2", content: "User switched to Vue, no longer uses React", topic: "preferences", ts: t1, confidence: 0.9 };

  await saveMemory(memA);
  await saveMemory(memB);
  await linkEntity(memA.key, USER, "frontend-framework");
  await linkEntity(memB.key, USER, "frontend-framework");
  await linkSupersedes(memB.key, memA.key, "Switched from React to Vue", 0.95);

  const current = await getCurrentFactsAboutEntity(USER, "frontend-framework");
  console.log("Current facts about frontend-framework:", current.map((m) => m.content));
  if (current.length !== 1 || current[0].key !== "mem-b-http") {
    throw new Error(`Expected only mem-b-http as current, got: ${JSON.stringify(current)}`);
  }

  const chain = await getSupersedeChain(memB.key);
  console.log("Supersede chain for mem-b-http:", chain.map((m) => m.content));
  if (chain.length !== 1 || chain[0].key !== "mem-a-http") {
    throw new Error(`Expected chain [mem-a-http], got: ${JSON.stringify(chain)}`);
  }

  const all = await getCurrentFactsForUser(USER);
  console.log("All current facts for user (session order):", all.map((m) => m.content));
  if (all.length !== 1) {
    throw new Error(`Expected 1 current fact for user, got ${all.length}`);
  }

  console.log("\nALL CHECKS PASSED (via HTTP tunnel)");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
