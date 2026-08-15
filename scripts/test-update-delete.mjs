import neo4j from "neo4j-driver";
const driver = neo4j.driver("neo4j://127.0.0.1:7687", neo4j.auth.bearer("local-development-token-32-bytes"));
async function tryQuery(label, query, attempts = 6) {
  for (let i = 1; i <= attempts; i++) {
    const session = driver.session();
    try {
      const result = await session.run(query);
      console.log(`[${label}] OK`, result.records.map(r => r.toObject()));
      return;
    } catch (err) {
      if (i < attempts && /No routing servers available/.test(err.message)) { await new Promise(r => setTimeout(r, 500 * i)); continue; }
      console.log(`[${label}] FAIL: ${err.message}`); return;
    } finally { await session.close(); }
  }
}
const base = Math.floor(Math.random() * 100000) + 200000;
await tryQuery("setup", `CREATE (a:UpdTest2 {id: ${base}, accessCount: 0})-[:X]->(b:UpdTest2 {id: ${base + 1}})`);
await tryQuery("increment via arithmetic expression", `MATCH (a:UpdTest2 {id: ${base}}) SET a.accessCount = a.accessCount + 1`);
await tryQuery("verify increment", `MATCH (a:UpdTest2 {id: ${base}}) RETURN a.accessCount AS c`);
await tryQuery("SET multiple properties at once", `MATCH (a:UpdTest2 {id: ${base}}) SET a.pinned = true, a.tag = "important"`);
await tryQuery("verify multi-SET", `MATCH (a:UpdTest2 {id: ${base}}) RETURN a.pinned AS pinned, a.tag AS tag`);
await tryQuery("REMOVE a property (used for dropping TTL-equivalent fields)", `MATCH (a:UpdTest2 {id: ${base}}) REMOVE a.tag`);
await tryQuery("verify REMOVE", `MATCH (a:UpdTest2 {id: ${base}}) RETURN a.tag AS tag`);
await driver.close();
