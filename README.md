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
npm test
```

The live chat and graph routes require configured Gemini/FalkorDB variables. See `AGENTS.md`, `MEMORY.md`, `PRD.md`, and `TRD.md` for architecture, safety rules, requirements, and verified status.

## Current status

The current implementation includes a responsive premium chat workspace with dark/light themes, graph-backed memory persistence and retrieval, entity identity resolution, provenance-aware typed relationships, bounded Gemini graph tools, recent conversational context, exact-memory correction with revision history, and reversible forgetting. The graph explorer includes refresh, loading, empty, error, and node-detail states.

**Important:** user scope is currently based on a normalized request-level `userId`, not an authenticated session. Configure an authentication provider before using this as a multi-user production service. The live Gemini and FalkorDB routes also require the environment variables in `.env.example`.
