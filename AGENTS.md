# Repository Guidelines

## Project Structure & Module Organization
This monorepo uses Bun workspaces. Each package lives in `packages/<name>` with source under `src/`. Build outputs flow to `dist/` and must never be edited manually. Shared tooling lives at the root (`tsconfig.json`, `biome.json`, `vitest.config.ts`, `bun.lock`); review cross-package impact before changing these files.

## Build, Test, and Development Commands
- `bun install` — Sync dependencies and respect the lockfile used in CI.
- `bun run build` — Run the TypeScript project references build, emitting artifacts to every `dist/` folder.
- `bun run lint` — Execute Biome formatter and linter in a single pass.
- `bun run test` — Launch Vitest in the Node environment for the entire workspace.
- `bun run changeset` — Draft release notes and version bumps via Changesets.
- `bun run clean` — Remove build artifacts and reinstall dependencies (does not delete untracked source files).

## Coding Style & Naming Conventions
TypeScript runs with `strict` enabled; avoid implicit `any` and replace `as` casts with dedicated type guards or the `satisfies` operator where appropriate. Prefer `unknown` for external inputs. Use kebab-case for package folders, PascalCase for types and enums, and camelCase for variables and functions. Always commit the formatter output produced by `bun run lint`.

## Testing Guidelines
Vitest is the test runner. Co-locate tests as `*.test.ts` files or inside `__tests__/`. Name suites with behavior-focused sentences so failures highlight intent. For new features, cover both success paths and the most representative error paths. Run `bun run test` (and `bun run build` when touching types) before opening a PR.

## Commit & Pull Request Guidelines
Write imperative commit summaries under 50 characters (e.g., `Add chat session schema`) and include context, impact, and test notes in the body when needed. PR descriptions must capture purpose, key changes, test evidence, linked issues, and screenshots or logs for user-facing updates. Attach the latest `.changeset/` entry whenever a release is required.

## Security & Release Management
Never commit secrets; surface runtime configuration via factories that accept environment values. Version changes must follow SemVer, with breaking updates declared in Changesets. Verify releases by checking the generated changelog and confirming publication for each package on npm.
Enable secret scanning and push protection in CI (e.g., gitleaks), and require npm 2FA + provenance for publishing.
