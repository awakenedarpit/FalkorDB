# Project Memory

_Last verified: 2026-10-12_

## Current state

- Repository: `awakenedarpit/FalkorDB`
- Main baseline: `10311d5 Resolve short names to known graph entities`
- Active work branch: `milestone-2-identity`
- Stack: Next.js 16.4, TypeScript, React 19, Tailwind CSS 4, Gemini API, FalkorDB, `react-force-graph-2d`.

## Verified functionality

- Chat posts to `/api/chat`, calls Gemini, and displays responses.
- Chat persists raw messages in FalkorDB and extracts entities/typed relationships when configured.
- Entity writes use normalized keys and relationship types are allow-listed.
- Unique known first-name resolution exists for extracted `Person` entities.
- `/api/graph` returns raw memory nodes plus entity nodes and relationships.
- `/graph` renders a force-directed graph with loading, empty, error, refresh, zoom-to-fit, and node detail states.
- Chat and graph screens now share responsive navigation, accessible focus states, refined loading/empty/error states, and updated product metadata.
- Entity extraction now supports canonical names, declared aliases, type-scoped keys, ambiguity-safe short-name resolution, and duplicate-resistant relationship writes.

## Baseline findings

- `npm ci` passed.
- `npm run lint` passed with one warning: unused `persistMemoryToGraph` in `app/api/chat/route.ts`.
- `npm run build` passed after `GraphNode` was updated with optional force-graph runtime `x` and `y` coordinates.
- Local smoke tests returned HTTP 200 for `/` and `/graph`; missing integration configuration returned safe HTTP 500 JSON errors from `/api/chat` and `/api/graph`.
- No automated tests exist.
- `npm test` passes six identity and duplicate-prevention regression tests.
- Required Gemini/FalkorDB environment variables were unset, so live API checks were not run.
- No tracked secret-like files were found.

## Known risks

1. Chat reads/writes the hardcoded `userId: 'default'`; graph user isolation is not implemented.
2. `/api/graph?userId=` trusts a caller-provided user ID.
3. Chat hardcodes the graph name while other code reads `FALKORDB_GRAPH_NAME`.
4. The unused persistence helper uses a different `User`/`HAS_MEMORY` schema than the active path.
5. Retrieval uses recent raw memories rather than bounded graph traversal.
6. Existing legacy name-only entity keys remain in the graph; new writes use type-scoped keys, but a future migration may be needed to reconcile historical collisions safely.
7. The diagnostic memory-test route writes a fixed test node and is not production-safe.
8. Dependency installation reports five high-severity audit findings; no forced upgrade has been applied.

## Decisions

- Preserve working chat and graph APIs while correcting build regressions and improving UI.
- Implement identity, persistence, retrieval, correction, and user isolation as separate milestones.
- Keep graph migrations additive and non-destructive.
- Keep UI controls functional: graph refresh retries the API, navigation links route to real pages, and prompt chips populate the composer.
- Keep identity changes additive: preserve existing exact-key matches, never merge ambiguous people, and do not delete or migrate graph nodes automatically.
