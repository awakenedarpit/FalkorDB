<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Graph Memory Agent — Agent Guide

## Project

Graph Memory Agent is a Next.js App Router application for the Graph Hacks hackathon. It combines Gemini responses with FalkorDB-backed memories and a `react-force-graph-2d` explorer.

## Commands

```bash
npm ci
npm run lint
npm run build
npm test
npm run dev
```

The repository currently has no automated test script. Add focused regression tests when changing graph identity, persistence, retrieval, correction, or user scoping.

## Architecture

- `app/page.tsx`: client chat workspace and message state.
- `app/graph/page.tsx`: client graph explorer and node details.
- `app/api/chat/route.ts`: Gemini request handling, raw memory persistence, entity extraction, canonical-name resolution, and typed relationship writes.
- `app/api/graph/route.ts`: FalkorDB graph read API for memory and entity nodes/links.
- `app/api/memory-test/route.ts`: diagnostic graph write/read route; keep it out of production workflows.
- `app/globals.css`: global visual tokens and base styles.

## Safety and data rules

- Never delete graph data or run destructive migrations without explicit approval.
- Never commit `.env` files, API keys, passwords, access tokens, or generated secrets.
- Do not merge people solely because their first names match. Reuse a canonical person only when the match is unique; otherwise ask for clarification.
- User identity must be explicit and user-scoped; do not treat `default` as real authentication.
- Retrieve and cite relevant graph evidence before claiming a memory.
- Validate dynamic labels and relationship types with allow-lists; parameterize values.
- Preserve existing API contracts unless a change is documented and tested.

## Git workflow

Each completed milestone gets a dedicated branch, focused commit(s), documentation updates, checks, and a pushed reviewable branch/PR. Do not merge to `main` without approval.

## Current verified baseline (2026-10-12)

- `npm ci`: passed.
- `npm run lint`: passed with one warning for unused `persistMemoryToGraph`.
- `npm run build`: passed after graph node coordinates `x`/`y` were declared as optional runtime properties.
- Gemini/FalkorDB smoke tests were not run because required environment variables were unset.
- Local page smoke tests: `/` and `/graph` returned HTTP 200; missing integration configuration returned safe HTTP 500 JSON errors.
- `npm test`: passed six identity and duplicate-prevention regression tests.
- No tracked secret-like files were found.

See `MEMORY.md`, `TRD.md`, and `CHANGELOG.md` for the maintained project record.
