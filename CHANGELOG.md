# Changelog

All notable project changes are recorded here.

## [Unreleased]

### Milestone 0 — Audit and baseline

- Audited the repository, Git history, source layout, APIs, and documentation.
- Confirmed the current baseline commit is `10311d5`.
- Added durable project documentation: `AGENTS.md`, `MEMORY.md`, `PRD.md`, and `TRD.md`.
- Recorded baseline checks: dependency installation passed; lint passed with one warning; production build currently fails on undeclared graph node coordinates.
- Added environment setup guidance without committing secrets.

### Milestone 1 — UI/UX refinement

- Fixed the production TypeScript error by declaring optional force-graph node coordinates.
- Refined chat and graph layouts for responsive desktop and mobile use.
- Added working navigation between Memory Chat and Graph Explorer.
- Added prompt chips, multiline composer behavior, keyboard guidance, accessible labels, focus styles, and clearer loading/error/empty states.
- Added a functional graph refresh/retry action and improved node details and legend styling.
- Updated product metadata and shared visual tokens.
- Validation passed: lint completed with the existing unused-helper warning; production build passed; local `/` and `/graph` smoke tests returned HTTP 200; missing-config API responses remained safe HTTP 500 errors.

### Milestone 2 — Entity identity and duplicate prevention

- Added pure identity helpers for Unicode normalization, type-scoped canonical keys, exact names, aliases, and ambiguity-safe short-name matching.
- Updated Gemini extraction to accept explicit aliases and existing graph aliases.
- Preserved existing exact entity keys while using type-scoped keys for new entities.
- Skipped ambiguous person entities and their uncertain relationships instead of guessing.
- Deduplicated entities and typed relationships before writes; retained Cypher `MERGE` for graph-level edge idempotency.
- Parameterized raw memory writes and respected `FALKORDB_GRAPH_NAME` in the active chat path.
- Added six repeatable Node regression tests covering identity matching and duplicate prevention.
- Validation passed: `npm test`, `npm run lint`, and `npm run build`.

### Milestone 3 — Graph persistence quality and provenance

- Added shared FalkorDB configuration, graph-name, and user-scope normalization helpers.
- Added traceable memory IDs, source/timestamp metadata, `User-HAS_MEMORY` ownership links, and `Memory-MENTIONS-Entity` provenance links.
- Added entity ownership and provenance properties to typed relationships.
- Scoped new entity keys by user ID to prevent cross-user `MERGE` collisions while preserving legacy compatibility keys.
- Updated chat, graph, and diagnostic routes to use the shared configuration contract and preserve legacy default-scope data without destructive migration.
- Added controlled graph-query integration tests for configuration, scoping, memory writes, entity ownership, provenance links, typed relationships, and retrieval parameters.
- Validation passed: 12 tests, lint, and production build.

### Milestone 4 — Graph-powered retrieval

- Added bounded, user-scoped graph evidence retrieval from recent memories through `MENTIONS` and one entity-relationship hop.
- Grouped duplicate graph rows per memory and included connected entity and relationship facts in the chat prompt.
- Preserved the existing chat response fields and added `graphEvidenceUsed` for observability.
- Added regression coverage for query scoping, bounded limits, duplicate grouping, ordering, and relationship evidence.

### Milestone 5 — Memory correction and forgetting

- Added `POST /api/memory` with exact `memoryId` targeting for correction and forgetting.
- Corrections update the active memory while preserving the prior content in a `MemoryRevision` node.
- Forgetting uses reversible soft deletion and hides source relationships from retrieval and graph exploration without deleting graph data.
- Forgetting requires `confirmed: true` and rejects missing, stale, or cross-user memory IDs.

### Planned next

- Milestone 5: safe correction and forgetting with ambiguity checks and non-destructive fact updates.
