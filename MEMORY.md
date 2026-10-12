# Project Memory

_Last verified: 2026-10-12_

## Current state

- Repository: `awakenedarpit/FalkorDB`
- Main baseline: `10311d5 Resolve short names to known graph entities`
- Active work branch: `milestone-0-audit-ui-ux`
- Stack: Next.js 16.4, TypeScript, React 19, Tailwind CSS 4, Gemini API, FalkorDB, `react-force-graph-2d`.

## Verified functionality

- Chat posts to `/api/chat`, calls Gemini, and displays responses.
- Chat persists raw messages in FalkorDB and extracts entities/typed relationships when configured.
- Entity writes use normalized keys and relationship types are allow-listed.
- Unique known first-name resolution exists for extracted `Person` entities.
- `/api/graph` returns raw memory nodes plus entity nodes and relationships.
- `/graph` renders a force-directed graph with loading, empty, error, zoom-to-fit, and node detail states.

## Baseline findings

- `npm ci` passed.
- `npm run lint` passed with one warning: unused `persistMemoryToGraph` in `app/api/chat/route.ts`.
- `npm run build` failed: `GraphNode` in `app/graph/page.tsx` does not declare force-graph runtime `x` and `y` coordinates.
- No automated tests exist.
- Required Gemini/FalkorDB environment variables were unset, so live API checks were not run.
- No tracked secret-like files were found.

## Known risks

1. Chat reads/writes the hardcoded `userId: 'default'`; graph user isolation is not implemented.
2. `/api/graph?userId=` trusts a caller-provided user ID.
3. Chat hardcodes the graph name while other code reads `FALKORDB_GRAPH_NAME`.
4. The unused persistence helper uses a different `User`/`HAS_MEMORY` schema than the active path.
5. Retrieval uses recent raw memories rather than bounded graph traversal.
6. Name-only entity keys can collide for same-name people.
7. The diagnostic memory-test route writes a fixed test node and is not production-safe.
8. Dependency installation reports five high-severity audit findings; no forced upgrade has been applied.

## Decisions

- Preserve working chat and graph APIs while correcting build regressions and improving UI.
- Implement identity, persistence, retrieval, correction, and user isolation as separate milestones.
- Keep graph migrations additive and non-destructive.
