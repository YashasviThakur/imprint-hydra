import neo4j from "neo4j-driver";

const driver = neo4j.driver("neo4j://127.0.0.1:7687", neo4j.auth.bearer("local-development-token-32-bytes"));

async function tryQuery(label, query, attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    const session = driver.session();
    try {
      const result = await session.run(query);
      console.log(`[${label}] OK`, result.records.map(r => r.toObject()));
      return;
    } catch (err) {
      if (i < attempts && /No routing servers available|internal query execution error/.test(err.message)) {
        await new Promise(r => setTimeout(r, 400 * i));
        continue;
      }
      console.log(`[${label}] FAIL (attempt ${i}): ${err.message}`);
      return;
    } finally {
      await session.close();
    }
  }
}

const base = Math.floor(Math.random() * 100000) + 500000; // small, safely under int32, still unlikely to collide
const anchor = base, newNode = base + 1, newNode2 = base + 2, newNode3 = base + 3;
console.log("using id base:", base);

await tryQuery("bootstrap anchor", `CREATE (u:Probe4 {id: ${anchor}})-[:BOOT]->(x:Probe4 {id: ${anchor + 10000}})`);
await tryQuery("merge attach new node to existing", `MERGE (a:Probe4 {id: ${anchor}})-[:ATTACH]->(b:Probe4 {id: ${newNode}})`);
await tryQuery("merge idempotent rerun", `MERGE (a:Probe4 {id: ${anchor}})-[:ATTACH]->(b:Probe4 {id: ${newNode}})`);
await tryQuery("verify only 1 ATTACH edge exists", `MATCH (a:Probe4 {id: ${anchor}})-[:ATTACH]->(b) RETURN b.id AS k`);
await tryQuery("merge with string key alongside int id", `MERGE (a:Probe4 {id: ${anchor}})-[:ATTACH3]->(d:Probe4 {id: ${newNode3}, key: "hello-world"})`);
await tryQuery("verify string key readable", `MATCH (a:Probe4 {id: ${anchor}})-[:ATTACH3]->(d) RETURN d.key AS k`);

await driver.close();
