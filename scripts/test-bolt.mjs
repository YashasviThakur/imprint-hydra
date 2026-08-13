import neo4j from "neo4j-driver";

const TOKEN = "local-development-token-32-bytes";
const url = "neo4j://127.0.0.1:7687";

async function tryAuth(label, auth) {
  const driver = neo4j.driver(url, auth);
  const session = driver.session();
  try {
    const result = await session.run("MATCH (a {id: 1})-[:FOLLOWS]->(b) RETURN b.id AS id");
    console.log(`[${label}] OK:`, result.records.map((r) => r.get("id")));
  } catch (err) {
    console.log(`[${label}] FAIL:`, err.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

await tryAuth("bearer", neo4j.auth.bearer(TOKEN));
await tryAuth("basic-neo4j-token", neo4j.auth.basic("neo4j", TOKEN));
await tryAuth("none", neo4j.auth.none());
