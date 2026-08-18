// Query-relevance ranking for HydraDB current-facts results.
//
// At full LongMemEval scale (60-83 current facts per instance), handing every
// fact to an 8B model with no ranking is the confirmed cause of the accuracy
// drop documented in the README — the model has to find the needle itself in
// a haystack of unranked context.
//
// This is deliberately NOT vector/embedding ranking: HydraDB's property
// values are integers, floats, booleans and strings only (cypher-compat.md —
// no list/array type), so a fact's embedding can't be stored as a node
// property and searched in the graph. Keyword overlap, scored and ranked in
// application code, is the option actually available against this database.

const STOPWORDS = new Set([
  "the", "a", "an", "is", "was", "were", "did", "do", "does", "i", "my", "me",
  "you", "your", "what", "when", "where", "which", "how", "in", "on", "at",
  "to", "of", "for", "and", "did", "have", "has", "had",
]);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Ranks facts by keyword overlap with the query, ties broken by recency
// (newer first). Returns at most `limit` facts, in rank order — not
// chronological order, since the LLM prompt re-sorts by ts for the
// chronology story anyway once the candidate set is narrowed down.
export function rankByRelevance<T extends { content: string; ts: string }>(
  facts: T[],
  query: string,
  limit: number
): T[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return facts.slice(0, limit);

  const scored = facts.map((f) => {
    const factTokens = tokenize(f.content);
    const overlap = factTokens.filter((t) => queryTokens.has(t)).length;
    return { f, score: overlap };
  });

  scored.sort((a, b) => b.score - a.score || (a.f.ts < b.f.ts ? 1 : -1));
  return scored.slice(0, limit).map((x) => x.f);
}
