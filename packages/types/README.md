# @listee/types

Shared TypeScript interfaces used across Listee services and client SDKs. The package aggregates API payloads, authentication contracts, and database types so downstream packages stay in sync.

## Installation

```bash
npm install @listee/types
```

## Contents

- `api` — request/response types for Listee REST handlers
- `authentication` — user/session contracts consumed by `@listee/auth`
- `db` — database-facing types used by `@listee/db` and repository layers

## Usage

```ts
import type { AppDependencies, ListCategoriesResult } from "@listee/types";

function listCategories(deps: AppDependencies): Promise<ListCategoriesResult> {
  return deps.categoryQueries.listCategories({ userId: deps.actor.id });
}
```

The package ships only `.d.ts` files, making it safe to use from Node.js and browser contexts.

## Development

Changes flow from the monorepo root:

- Update the relevant source under `src/`
- Run `bun run build` to emit declaration files into `dist/`
- Execute `bun test` or higher level tests in dependent packages to ensure compatibility

## License

MIT
