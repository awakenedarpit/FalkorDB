# Graph Memory Agent

Graph Memory Agent is a Next.js application for the Graph Hacks hackathon. It combines Gemini with FalkorDB to save raw memories, extract entities and typed relationships, answer from recent memory, and visualize the graph.

## Requirements

- Node.js 22+
- npm
- Gemini API credentials
- FalkorDB credentials and a reachable graph instance

## Local setup

```bash
npm ci
cp .env.example .env.local
# Fill .env.local locally; never commit it.
npm run dev
```

Open <http://localhost:3000> for chat and <http://localhost:3000/graph> for the graph explorer.

## Verification

```bash
npm run lint
npm run build
```

The live chat and graph routes require configured Gemini/FalkorDB variables. See `AGENTS.md`, `MEMORY.md`, `PRD.md`, and `TRD.md` for architecture, safety rules, requirements, and verified status.

## Current status

The baseline includes raw memory persistence, Gemini entity/relationship extraction, typed graph edges, unique short-name resolution, and a graph explorer. The next implementation milestone is UI/UX refinement plus repair of the current graph coordinate TypeScript error. User isolation, aliases, graph-powered retrieval, correction, forgetting, and automated tests remain planned milestones.
