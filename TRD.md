# Technical Requirements Document

## System architecture

```text
Browser (Next.js client)
  ├── Chat workspace ── POST /api/chat ── Gemini + FalkorDB
  └── Graph explorer ── GET /api/graph ── FalkorDB
```

The application uses the Next.js App Router. Gemini performs response generation and structured extraction. FalkorDB stores raw `Memory` nodes, shared `Entity` lookup nodes, domain labels, and typed relationships.

## Current API contracts

### `POST /api/chat`

Request: `{ "message": string, "userId?: string" }`

Success includes `{ reply, memoriesUsed, memorySaved, memoryId, userId, entitiesCreated, relationshipsCreated }`. User IDs are normalized and scoped consistently across reads and writes; this is request-level scoping, not authentication.

### `GET /api/graph`

Optional query: `userId`. Returns `{ nodes: [{ id, label, type }], links: [{ source, target, label }] }`. The caller-provided user ID is not an authentication boundary and must not remain so in a production security design.

### `GET /api/memory-test`

Diagnostic-only write/read check. It currently writes a fixed `MemoryTest` node and should be guarded or removed from production use.

## Graph schema (current)

- `(:User { id })-[:HAS_MEMORY]->(:Memory { id, userId, content, source, createdAt, updatedAt })`
- `(:Memory)-[:MENTIONS { observedAt, sourceMemoryId, sourceUserId }]->(:Entity { key, name, type, aliases, ownerUserId, updatedAt })`
- Typed entity relationships carry `updatedAt`, `sourceMemoryId`, and `sourceUserId` provenance properties.
- New entity keys are user-scoped, type-scoped slugs such as `user-1::person_arpit_raj`; existing legacy keys remain valid and are reused when an exact compatibility-scope identity matches.
- Domain labels: `Person`, `Project`, `Team`, `Skill`, `Organization`, `Preference`, `Place`, `Other`.
- Typed edges currently allow: `BUILDS`, `MEMBER_OF`, `TEAMMATE_OF`, `KNOWS`, `WORKS_ON`, `LIKES`, `USES`, `RELATED_TO`, `HANDLES`, `LEADS`, `CREATED`, `PART_OF`, `STUDIES`, `LOCATED_IN`, `HAS_SKILL`, `COLLABORATES_WITH`.

Future schema work should add provenance and aliases additively, preserve existing labels/edges, and avoid destructive migrations.

Legacy flat `Memory` nodes and unowned `Entity` nodes are still read for the `default` scope. New writes use IDs, ownership, source metadata, and provenance links. No automatic migration or deletion is performed.

## Identity resolution rules

Identity matching normalizes Unicode text, punctuation, and case. An exact canonical name or declared alias resolves to the existing entity. A short `Person` name resolves only when exactly one known person matches; if multiple people match, the entity and any relationship using that ambiguous name are skipped rather than guessed. New entities receive type-scoped keys, extracted duplicates are collapsed before writes, and relationship writes use `MERGE` plus an in-batch duplicate set.

## Security requirements

- Keep credentials server-side and never log them.
- Parameterize graph values.
- Allow-list all interpolated labels and relationship types.
- Replace caller-supplied user IDs with an explicit authenticated identity before claiming isolation.
- Do not expose another user's memory through graph or retrieval APIs.

## Bounded retrieval

- Chat retrieval reads at most the requested evidence limit for the normalized user scope.
- Each evidence row starts at a user-owned `Memory`, follows `MENTIONS` to an `Entity`, and traverses at most one entity relationship hop.
- Related entities are restricted to the same owner scope, with unowned legacy nodes available only to the `default` compatibility scope.
- Duplicate rows for one memory are grouped before the evidence is sent to Gemini; entity and relationship labels are returned as evidence text, not executable instructions.

## Testing strategy

- Static: lint, TypeScript, production build.
- Unit/regression: normalization, exact and alias matching, unique/ambiguous short-name matching, type-scoped keys, duplicate entity/edge prevention, bounded graph evidence grouping, allow-list validation, and safe missing-config errors. Run with `npm test`.
- Integration: persistence helpers are tested against a controlled in-memory graph-query mock; live chat persistence and graph retrieval still require a configured FalkorDB instance. Correction, forgetting, and authenticated user isolation remain later milestones.
- UI smoke: responsive chat send/error/loading and graph loading/empty/error/node-detail flows.
