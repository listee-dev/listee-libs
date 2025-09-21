# listee-libs

## Overview
`listee-libs` is the public monorepo that hosts the Listee SDK packages. Each module is published under the `@listee/*` scope so downstream applications (API, web, CLI, MCP) can consume them independently. The initial release focuses on `@listee/db` (database access layer) with `@listee/types` and other packages (`auth`, `chat`, `ui`, `sdk`) landing incrementally.

## Repository Layout
- `packages/<name>` — Individual packages with their implementation in `src/` and compiled output in `dist/`.
- `tsconfig.json` — Shared TypeScript project references and strict compiler requirements.
- `biome.json` — Biome formatter and linter configuration.
- `vitest.config.ts` — Test runner configuration for the entire workspace.
- `.github/workflows/` — CI pipelines based on `listee-dev/listee-ci@v1` workflows.

## Getting Started
1. Install Bun `1.2.19` (or later). We recommend pinning via `"packageManager": "bun@1.2.19"` in the root package.json for reproducibility.
2. Run `bun install` at the repository root (catalog-aware installation for every workspace).
3. Use `bun run lint`, `bun run build`, and `bun run test` to verify changes locally.
4. Initialize Changesets with `bun run changeset init` if you are bootstrapping a fresh clone.

## Packages

### `@listee/db`
- Provides a thin Postgres + Drizzle ORM layer with connection caching for local development.
- Requires `POSTGRES_URL` to be defined before calling `createPostgresConnection`.
- Exposes helpers:
  - `createPostgresConnection` — returns a cached `postgres` client (disabled in production); accepts optional overrides.
  - `db` — shared `drizzle-orm` database instance backed by the cached connection.
  - `createRlsClient`/`createDrizzle` — wrap transactions with Supabase-style RLS claims and role switching.
- Publishes generated types alongside compiled output (`sideEffects: false` for optimal tree-shaking).

## Contribution Notes
- Follow the guidance in `AGENTS.md` for agent automation workflows and repository conventions.
- Keep documentation and code comments in English.
- Coordinate feature work through focused branches (`feature/...`, `chore/...`, etc.) and submit PRs with clear descriptions, linked issues, and test evidence.

## Release Process
Changesets drive versioning and publishing. Merging to `main` triggers the shared CI pipelines, including the release workflow that prepares npm publications. Confirm published versions for `@listee/types` and `@listee/db` before announcing availability to downstream projects.
