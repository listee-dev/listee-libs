# Repository Guidelines

## Project Structure & Module Organization
This monorepo uses Bun workspaces. Each package lives in `packages/<name>` with source under `src/`. Build outputs flow to `dist/` and must never be edited manually. Shared tooling lives at the root (`tsconfig.json`, `biome.json`, `vitest.config.ts`, `bun.lock`); review cross-package impact before changing these files.

## Dependency Management
- Use the root `package.json` `catalog` to pin shared dependency versions. Packages reference catalog entries with the `"catalog:"` protocol.
- Add new shared dependencies to the root catalog before consuming them in individual packages. This keeps versions centralized and avoids drift across workspaces.
- Always run `bun install` from the repository root so that catalog resolutions and the shared `bun.lock` stay in sync.
- When publishing npm packages, ensure you build or pack with Bun (`bun pm pack` / `bun publish`) so catalog references collapse to concrete semver ranges.

## Build, Test, and Development Commands
- `bun install` — Sync dependencies and respect the lockfile used in CI.
- `bun run build` — Run the TypeScript project references build, emitting artifacts to every `dist/` folder.
- `bun run lint` — Execute Biome formatter and linter in a single pass.
- `bun test` or `bun run test` — Execute Bun's built-in test runner across the workspace (see `packages/db/src/index.test.ts` for examples).
- `bun run changeset` — Draft release notes and version bumps via Changesets.
- `bun run clean` — Remove build artifacts and reinstall dependencies (does not delete untracked source files).

## Coding Style & Naming Conventions
TypeScript runs with `strict` enabled; avoid implicit `any` and replace `as` casts with dedicated type guards or the `satisfies` operator where appropriate. Prefer `unknown` for external inputs. Use kebab-case for package folders, PascalCase for types and enums, and camelCase for variables and functions. Always commit the formatter output produced by `bun run lint`.

## Testing Guidelines
Use Bun's built-in test runner. Co-locate tests as `*.test.ts` files or inside `__tests__/`. Name suites with behavior-focused sentences so failures highlight intent. For new features, cover both success paths and the most representative error paths. Run `bun test` (and `bun run build` when touching types) before opening a PR.

## Commit & Pull Request Guidelines
Write imperative commit summaries under 50 characters (e.g., `Add chat session schema`) and include context, impact, and test notes in the body when needed. PR descriptions must capture purpose, key changes, test evidence, linked issues, and screenshots or logs for user-facing updates. Attach the latest `.changeset/` entry whenever a release is required.

## Security & Release Management
Never commit secrets; surface runtime configuration via factories that accept environment values. Version changes must follow SemVer, with breaking updates declared in Changesets. Verify releases by checking the generated changelog and confirming publication for each package on npm.
Enable secret scanning and push protection in CI (e.g., gitleaks), and require npm 2FA + provenance for publishing.

## Architecture Playbook
- Maintain a single dependency direction (`routes → queries → services → repositories`) so that upper layers stay ignorant of lower-level details.
- `routes` should delegate exclusively to `queries`, translate their results into HTTP responses, and decide status codes. Avoid placing business logic here.
- `queries` compose the necessary `services` and `repositories` per use case. Inject dependencies through factories so tests can swap in mocks easily.
- `services` may depend on `repositories`, but repositories must never depend on services. Extract complex domain logic into dedicated modules and keep the service layer thin.
- `repositories` encapsulate external SDK, SQL, or KV access and return plain or domain-specific types (`string`, `Date`, structured objects) to callers.
- Separate authentication and authorization concerns inside `packages/auth`. Place runtime-specific adapters under `authentication/` and domain policies under `authorization/` (e.g., `policies/chat.ts` exposing `canAccessChat`). Policies can declare repository interfaces and receive concrete implementations via dependency injection.
- Process authenticated requests in the order `Route Handler → Authentication → Queries → Authorization → Services/Repositories`, passing the authenticated actor into queries before evaluating policies.
