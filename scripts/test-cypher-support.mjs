import neo4j from "neo4j-driver";

const driver = neo4j.driver("neo4j://127.0.0.1:7687", neo4j.auth.bearer("local-development-token-32-bytes"));
const session = driver.session();

async function tryQuery(label, query) {
  try {
    await session.run(query);
    console.log(`[${label}] OK`);
  } catch (err) {
    console.log(`[${label}] FAIL: ${err.message}`);
  }
}

await tryQuery("create edge, both nodes new", `CREATE (a:Probe {key: "q1"})-[:REL]->(b:Probe {key: "q2"})`);
await tryQuery("plain match (read)", `MATCH (a:Probe {key: "q1"}) RETURN a.key AS k`);
await tryQuery("chained CREATE, no MATCH", `CREATE (c:Probe {key: "q3"})-[:REL2]->(d:Probe {key: "q4"}) CREATE (d)-[:REL3]->(e:Probe {key: "q5"})`);
await tryQuery("match existing then create edge to new node", `MATCH (a:Probe {key: "q1"}) CREATE (a)-[:REL4]->(f:Probe {key: "q6"})`);

await session.close();
await driver.close();
