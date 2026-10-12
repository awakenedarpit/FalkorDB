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

Request: `{ "message": string }`

Success includes `{ reply, memoriesUsed, memorySaved, entitiesCreated, relationshipsCreated }`. Missing integration configuration returns an error response. The current implementation uses the hardcoded `default` user scope and the `memory_agent` graph in its active path; this is a known risk to resolve in a later milestone.

### `GET /api/graph`

Optional query: `userId`. Returns `{ nodes: [{ id, label, type }], links: [{ source, target, label }] }`. The caller-provided user ID is not an authentication boundary and must not remain so in a production security design.

### `GET /api/memory-test`

Diagnostic-only write/read check. It currently writes a fixed `MemoryTest` node and should be guarded or removed from production use.

## Graph schema (current)

- `(:Memory { userId, content, createdAt })`
- `(:Entity { key, name, type, aliases, updatedAt })`
- New entity keys are type-scoped slugs such as `person_arpit_raj`; existing legacy keys remain valid and are reused when exact identity matches.
- Domain labels: `Person`, `Project`, `Team`, `Skill`, `Organization`, `Preference`, `Place`, `Other`.
- Typed edges currently allow: `BUILDS`, `MEMBER_OF`, `TEAMMATE_OF`, `KNOWS`, `WORKS_ON`, `LIKES`, `USES`, `RELATED_TO`, `HANDLES`, `LEADS`, `CREATED`, `PART_OF`, `STUDIES`, `LOCATED_IN`, `HAS_SKILL`, `COLLABORATES_WITH`.

Future schema work should add provenance and aliases additively, preserve existing labels/edges, and avoid destructive migrations.

## Identity resolution rules

Identity matching normalizes Unicode text, punctuation, and case. An exact canonical name or declared alias resolves to the existing entity. A short `Person` name resolves only when exactly one known person matches; if multiple people match, the entity and any relationship using that ambiguous name are skipped rather than guessed. New entities receive type-scoped keys, extracted duplicates are collapsed before writes, and relationship writes use `MERGE` plus an in-batch duplicate set.

## Security requirements

- Keep credentials server-side and never log them.
- Parameterize graph values.
- Allow-list all interpolated labels and relationship types.
- Replace caller-supplied user IDs with an explicit authenticated identity before claiming isolation.
- Do not expose another user's memory through graph or retrieval APIs.

## Testing strategy

- Static: lint, TypeScript, production build.
- Unit/regression: normalization, exact and alias matching, unique/ambiguous short-name matching, type-scoped keys, duplicate entity/edge prevention, allow-list validation, and safe missing-config errors. Run with `npm test`.
- Integration: chat persistence, graph retrieval, correction, forgetting, and user isolation against a controlled FalkorDB instance.
- UI smoke: responsive chat send/error/loading and graph loading/empty/error/node-detail flows.
