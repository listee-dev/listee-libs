# listee-libs

## Overview
`listee-libs` is the public monorepo that hosts the Listee SDK packages. Each module is published under the `@listee/*` scope so downstream applications (API, web, CLI, MCP) can consume them independently. The initial release focuses on `@listee/types` and `@listee/db`, with additional packages (`auth`, `chat`, `ui`, `sdk`) following incrementally.

## Repository Layout
- `packages/<name>` — Individual packages with their implementation in `src/` and compiled output in `dist/`.
- `tsconfig.json` — Shared TypeScript project references and strict compiler requirements.
- `biome.json` — Biome formatter and linter configuration.
- `vitest.config.ts` — Test runner configuration for the entire workspace.
- `.github/workflows/` — CI pipelines based on `listee-dev/listee-ci@v1` workflows.

## Getting Started
1. Install Bun `1.2.19` (or later). We recommend pinning via `"packageManager": "bun@1.2.19"` in the root package.json for reproducibility.
2. Run `bun install` to sync dependencies.
3. Use `bun run lint`, `bun run build`, and `bun run test` to verify changes locally.
4. Initialize Changesets with `bun run changeset init` if you are bootstrapping a fresh clone.

## Contribution Notes
- Follow the guidance in `AGENTS.md` for agent automation workflows and repository conventions.
- Keep documentation and code comments in English.
- Coordinate feature work through focused branches (`feature/...`, `chore/...`, etc.) and submit PRs with clear descriptions, linked issues, and test evidence.

## Release Process
Changesets drive versioning and publishing. Merging to `main` triggers the shared CI pipelines, including the release workflow that prepares npm publications. Confirm published versions for `@listee/types` and `@listee/db` before announcing availability to downstream projects.
