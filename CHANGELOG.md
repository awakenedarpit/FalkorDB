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

### Planned next

- Milestone 2: robust identity resolution, aliases, and duplicate prevention.
