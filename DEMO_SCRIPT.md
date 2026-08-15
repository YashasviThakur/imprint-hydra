# Demo video script (≤3:00)

Structure follows the submission checklist exactly: problem → project → demo → HydraDB usage.
Rough word count assumes ~150 words/min conversational pace — trim to fit if you go long.

---

## 0:00–0:35 — The problem

> "Agent memory demos are easy to fake. Ask a follow-up question that needs
> two sessions ago's context, or a fact that got updated since, and most
> memory layers either miss it or confidently make something up.
>
> LongMemEval — the benchmark Hack Hydra's Track 3 points to — tests exactly
> that: 30 to 40 sessions, facts that get overwritten, and questions that
> are genuinely unanswerable from the history. Long-context models lose
> 30 to 60% accuracy here, almost entirely by failing to say 'I don't know'
> when they should."

**On screen:** title card, or the Track 3 brief text on hydraDB's hackathon page.

## 0:35–1:15 — The project

> "This is Imprint — a persistent memory layer for AI agents I'd already
> built [link the existing product if you want the credibility] — rebuilt
> for this track on HydraDB's graph engine instead of flat vector search.
>
> Every memory becomes a node. When a new fact contradicts an old one — say,
> 'switched from Python to Rust' — that becomes an explicit SUPERSEDES edge
> in the graph, not just a newer row in a list. 'Current truth' for any
> question is: walk the graph, find facts nothing has superseded, order by
> time."

**On screen:** a quick diagram or the graph model comment from `lib/hydra.ts` —
`(:Session)-[:CONTAINS]->(:Memory)-[:SUPERSEDES]->(:Memory)-[:ABOUT]->(:Entity)`.

## 1:15–2:20 — The demo

> "Here's it running. I'll save two facts about the same thing, a few
> sessions apart."

**On screen — do this live:**
1. Save "My favorite language is Python" (via the dashboard or MCP).
2. Save "Switched from Python to Rust" a bit later.
3. Ask: *"What's my favorite programming language?"* → show it answers
   **Rust**, not Python — the superseded fact.
4. Ask something with **no answer in the graph** → show it says it doesn't
   know, instead of guessing. Point out: this isn't a prompt asking the model
   to be careful — if the graph query returns nothing, the LLM is never even
   called.

> "That abstention path matters more than the happy path — it's what the
> track brief calls out as the hard part, and it's the one long-context
> models fail most."

*(Optional, if time allows: show a few lines from the benchmark harness
output — `scripts/benchmark-longmemeval.ts` — running against real
LongMemEval instances, hitting correct abstentions.)*

## 2:20–2:55 — Where HydraDB is used, and why it matters

> "Every memory write goes into HydraDB as a graph node. Contradiction
> detection — which already existed — now produces SUPERSEDES edges instead
> of a flat flag. The 'ask' endpoint resolves current truth by walking those
> edges and filtering by timestamp, in the graph, not in a prompt hoping the
> model figures out what's stale.
>
> A vector store finds the nearest facts. It doesn't know one supersedes the
> other. That's the actual gap HydraDB closes here — not 'we added a
> database,' but 'this specific failure mode — quietly answering with
> outdated information — becomes structurally impossible.'"

**On screen:** back to the diagram, or the README section on why a graph
here.

## 2:55–3:00 — Close

> "Repo's public, README has the full writeup — including some real
> engine limitations I hit and worked around, MATCH+CREATE and MERGE's
> integer-id requirement among them. Thanks."

---

## Recording checklist

- [ ] Local HydraDB running: `docker compose -f docker-compose.hydradb.yml up -d`
- [ ] `npm run dev`, logged in, dashboard reachable
- [ ] Two contradicting facts saved and visible before recording starts (or save live, per script)
- [ ] Both ask questions tested once beforehand so you know the exact wording that triggers the behavior you want on camera
- [ ] Screen recording software ready, mic check
- [ ] Upload unlisted to YouTube (per the rules — judges just need to be able to open it) and grab the link for the submission form
