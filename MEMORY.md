# Project Memory

_Last verified: 2026-10-12_

## Current state

- Repository: `awakenedarpit/FalkorDB`
- Main baseline: `10311d5 Resolve short names to known graph entities`
- Active work branch: `milestone-3-persistence`
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
- New chat memories now receive IDs, source/timestamps, user ownership, `User-HAS_MEMORY` links, `Memory-MENTIONS-Entity` provenance, and provenance properties on typed relationships.
- Chat, graph, and diagnostic routes now share FalkorDB configuration and graph-name handling.
- New entity keys are scoped by normalized user ID to prevent cross-user `MERGE` collisions; legacy exact keys remain compatibility-scoped.
- Chat retrieval now queries bounded one-hop graph evidence for the requested user, groups duplicate memory rows, and includes connected entities and relationships in the Gemini prompt.
- Memory correction and forgetting now use exact IDs, preserve correction revisions, and soft-delete forgotten memories and source relationships without destructive Cypher deletes.

## Baseline findings

- `npm ci` passed.
- `npm run lint` passed cleanly.
- `npm run build` passed after `GraphNode` was updated with optional force-graph runtime `x` and `y` coordinates.
- Local smoke tests returned HTTP 200 for `/` and `/graph`; missing integration configuration returned safe HTTP 500 JSON errors from `/api/chat` and `/api/graph`.
- `npm test` passes 12 identity, persistence, provenance, and duplicate-prevention regression tests.
- Required Gemini/FalkorDB environment variables were unset, so live API checks were not run.
- No tracked secret-like files were found.

## Known risks

1. Chat defaults to `userId: 'default'`; graph user isolation is request-scoped and not authenticated.
2. `/api/graph?userId=` trusts a caller-provided user ID.
3. Request-level user IDs are normalized but are not authenticated identities.
4. Retrieval is bounded to recent user-scoped memory nodes and one-hop entity relationships; semantic ranking and multi-hop traversal remain future improvements.
5. The correction/forgetting endpoint still uses request-level user IDs rather than authenticated identities.
5. Existing legacy name-only entity keys remain in the graph; new writes use type-scoped keys, but a future migration may be needed to reconcile historical collisions safely.
6. Legacy unowned entities are visible only to the `default` compatibility scope; no automatic migration has assigned ownership.
7. The diagnostic memory-test route is repeatable but remains a diagnostic endpoint rather than a production health-check boundary.
8. Dependency installation reports five high-severity audit findings; no forced upgrade has been applied.

## Decisions

- Preserve working chat and graph APIs while correcting build regressions and improving UI.
- Implement identity, persistence, retrieval, correction, and user isolation as separate milestones.
- Keep graph migrations additive and non-destructive.
- Keep UI controls functional: graph refresh retries the API, navigation links route to real pages, and prompt chips populate the composer.
- Keep identity changes additive: preserve existing exact-key matches, never merge ambiguous people, and do not delete or migrate graph nodes automatically.
