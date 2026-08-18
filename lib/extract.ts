/**
 * Smart memory extraction via lib/llm.ts's provider chain (Groq first).
 * Falls back to regex patterns if every provider is unavailable or key not set.
 */

import { llmComplete } from "./llm";

export type Topic = "work" | "personal" | "preferences" | "projects" | "health" | "relationships" | "general";

export interface ExtractedMemory {
  content: string;
  topic: Topic;
  keywords: string[];
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────
// GROQ extraction — understands implicit/contextual facts
// ─────────────────────────────────────────────────────────────────

const GROQ_SYSTEM = `You are a memory extraction system. From a conversation, extract durable factual statements about the USER's life — not just software/dev work. Conversations can be about anything: travel, food, fitness, errands, relationships, hobbies, admin tasks, as well as coding.

Classify each fact into the SINGLE most accurate topic. Do NOT default to "projects".
- personal: name, location, background, life events, milestones, achievements, records, counts (e.g. "ran a 5K in 25:50", "has visited four Korean restaurants in the city", "booked an Airbnb in San Francisco")
- preferences: things liked, disliked, or favored — food, places, tools, ways of working, hobbies
- work: job, role, company, team, learning, tech stack, career facts
- projects: the STATE of a specific, named software project the user is building (always name it, e.g. "Imprint: shipped the dashboard")
- health: health conditions, fitness, diet, sleep (e.g. "User has diabetes")
- relationships: friends, family, colleagues, teammates — INCLUDING facts the user reports about them (e.g. "User's friend Rachel recently moved to the suburbs", "User's teammate Sam is leading the backend")
- general: anything else durable that doesn't fit the above

Rules:
- Facts aren't only about the user directly — include concrete facts the user tells you about people, places, or things in their life (a friend's move, a pet's vet visit, a trip someone else is planning) under the topic that fits best (usually relationships or general).
- Pick the topic that describes the FACT, not the activity. A coding chat still produces preference/personal/health facts — tag those correctly, not as "projects".
- Extract IMPLICIT facts too (e.g. "my app keeps crashing" → user has an app).
- Capture concrete numbers, dates, and counts precisely when mentioned (times, quantities, prices, versions) — they're often exactly what gets asked about later.
- Ignore questions, general opinions, and the assistant's text. Each fact = a complete standalone sentence.
- Be selective but not sparse. Max 10 facts — a dense conversation can carry more than a quick one.

Return a JSON array ONLY, no other text:
[
  { "content": "User prefers tabs over spaces", "topic": "preferences", "keywords": ["tabs", "spaces"], "confidence": 0.9 }
]

Use exactly one of these topics: work | personal | preferences | projects | health | relationships | general

The response format requires a JSON *object* at the top level, not a bare
array — wrap the array above in a "memories" key:
{ "memories": [ { "content": "...", "topic": "...", "keywords": [...], "confidence": 0.9 } ] }
If there's nothing worth remembering, return { "memories": [] }.`;

export async function extractWithGroq(
  messages: { role: string; content: string }[],
  apiKey: string
): Promise<ExtractedMemory[]> {
  const userText = messages
    .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const raw = await llmComplete(
    [
      { role: "system", content: GROQ_SYSTEM },
      { role: "user", content: `Extract memories from this conversation:\n\n${userText.slice(0, 6000)}` },
    ],
    { temperature: 0.1, maxTokens: 1024, json: true }
  );
  if (!raw) return [];

  // The model returns a JSON object or array — handle both shapes.
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  // The model returns a JSON object or array — handle both shapes, and don't
  // crash if the "first value" heuristic lands on something that isn't an
  // array either (confirmed happening: json_object mode makes some models
  // return a single bare memory object instead of the requested {memories:[]}
  // wrapper — Object.values(parsed)[0] on that is a string, not an array,
  // and .filter() on a string threw "not a function" in production).
  const firstValue = Object.values(parsed)[0];
  let arr: any[];
  if (Array.isArray(parsed)) arr = parsed;
  else if (Array.isArray(parsed.memories)) arr = parsed.memories;
  else if (Array.isArray(parsed.facts)) arr = parsed.facts;
  else if (Array.isArray(firstValue)) arr = firstValue;
  else if (parsed.content && parsed.topic) arr = [parsed]; // single bare memory object
  else arr = [];

  return arr
    .filter((m: any) => m.content && m.topic)
    .map((m: any) => ({
      content: String(m.content).trim(),
      topic: (m.topic || "general") as Topic,
      keywords: Array.isArray(m.keywords) ? m.keywords : String(m.content).toLowerCase().split(/\s+/).slice(0, 5),
      confidence: Number(m.confidence) || 0.8,
    }))
    .filter(m => m.content.length > 10);
}

// ─────────────────────────────────────────────────────────────────
// Regex fallback — catches structured statements when Groq unavailable
// ─────────────────────────────────────────────────────────────────

const PATTERNS: { re: RegExp; topic: Topic; tpl: (m: RegExpExecArray) => string }[] = [
  // Identity
  { re: /(?:my name is|i(?:'m| am) called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,      topic: "personal",     tpl: m => `User's name is ${m[1]}` },
  { re: /(?:i(?:'m| am) (?:from|in|based in)|i live in)\s+([A-Za-z\s,]+?)(?:\.|,|$)/gi, topic: "personal",     tpl: m => `User is from/in ${m[1].trim()}` },
  // Work
  { re: /i(?:'m| am)(?: a| an)?\s+([\w\s]+?)\s+(?:at|for|in)\s+([\w\s]+?)(?:\.|,|$)/gi, topic: "work",        tpl: m => `User is a ${m[1].trim()} at ${m[2].trim()}` },
  { re: /(?:our|my) (?:team|company|startup|org)\s+(?:is called|is named|is)\s+(.+?)(?:\.|,|$)/gi, topic: "work", tpl: m => `User's team/company: ${m[1].trim()}` },
  // Preferences
  { re: /i (?:prefer|love|like|always use)\s+(.+?)(?:\.|,|$)/gi,                         topic: "preferences", tpl: m => `User prefers ${m[1].trim()}` },
  { re: /i (?:don'?t like|hate|avoid|dislike|never use)\s+(.+?)(?:\.|,|$)/gi,            topic: "preferences", tpl: m => `User dislikes ${m[1].trim()}` },
  // Projects
  { re: /i(?:'m| am) (?:building|working on|developing|creating|making)\s+(.+?)(?:\.|,|$)/gi, topic: "projects", tpl: m => `User is building ${m[1].trim()}` },
  { re: /(?:entering|participating in|submitting to)\s+(.+?hackathon.+?)(?:\.|,|$)/gi,   topic: "projects",    tpl: m => `User is participating in ${m[1].trim()}` },
  { re: /(?:my|our) (?:app|project|product|startup|tool)\s+(?:is called|is named|is)\s+(.+?)(?:\.|,|$)/gi, topic: "projects", tpl: m => `User's project: ${m[1].trim()}` },
  { re: /deadline (?:is|on|:)\s+(.+?)(?:\.|,|$)/gi,                                      topic: "projects",    tpl: m => `Deadline: ${m[1].trim()}` },
  // Tech
  { re: /(?:using|our stack is|tech stack(?:\s+is)?|built with|we use)\s+(.+?)(?:\.|,|$)/gi, topic: "work",    tpl: m => `User's stack: ${m[1].trim()}` },
  { re: /i use\s+(React|Vue|Angular|Next\.?js|Node|Python|Java|Go|Rust|TypeScript|JavaScript|Flutter|Swift|Kotlin|Svelte|Django|FastAPI|Postgres|MongoDB|Redis|Docker|Kubernetes)(?:\s|,|\.)/gi, topic: "preferences", tpl: m => `User uses ${m[1]}` },
  // Goals / learning
  { re: /i(?:'m| am) (?:learning|studying|taking)\s+(.+?)(?:\.|,|$)/gi,                  topic: "work",        tpl: m => `User is learning ${m[1].trim()}` },
  { re: /my goal is (?:to\s+)?(.+?)(?:\.|,|$)/gi,                                        topic: "general",     tpl: m => `User's goal: ${m[1].trim()}` },
];

export function extractWithRegex(
  messages: { role: string; content: string }[]
): ExtractedMemory[] {
  const userText = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
  const facts: ExtractedMemory[] = [];
  const seen = new Set<string>();

  for (const { re, topic, tpl } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(userText)) !== null) {
      const content = tpl(m);
      const key = content.toLowerCase().slice(0, 40);
      if (content.length < 12 || seen.has(key)) continue;
      seen.add(key);
      facts.push({
        content,
        topic,
        keywords: content.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 6),
        confidence: 0.75,
      });
    }
  }
  return facts;
}

// ─────────────────────────────────────────────────────────────────
// Unified extractor — Groq first, regex fallback
// ─────────────────────────────────────────────────────────────────

export async function extractMemories(
  messages: { role: string; content: string }[],
  groqApiKey?: string
): Promise<ExtractedMemory[]> {
  if (groqApiKey && groqApiKey !== "gsk_YOUR_GROQ_KEY_HERE") {
    try {
      const results = await extractWithGroq(messages, groqApiKey);
      if (results.length > 0) return results;
    } catch (err) {
      console.warn("[Imprint] Groq extraction failed, falling back to regex:", err);
    }
  }
  return extractWithRegex(messages);
}
