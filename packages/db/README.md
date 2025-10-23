# @listee/db

Postgres + Drizzle utilities used by Listee services. It provides connection management, row-level security (RLS) helpers, and schema exports for downstream consumers.

## Installation

```bash
npm install @listee/db
```

## Features

- Cached `postgres` connections for local development and tests
- `createRlsClient`/`createDrizzle` to run transactions with Supabase-style claims
- Schema exports under `schema/` plus category constants for consistent lookups
- Graceful error wrapping that surfaces detailed Drizzle/Postgres diagnostics

## Quick start

```ts
import { createRlsClient, createPostgresConnection } from "@listee/db";

const connection = createPostgresConnection();

const rlsClient = createRlsClient({
  connection,
});

await rlsClient.runWithToken({ token: jwt }, async (tx) => {
  const categories = await tx.query.categories.findMany();
  return categories;
});
```

Set `POSTGRES_URL` (or pass `connectionString`) before invoking the helpers. When `reuseConnection` is true (default), connections are cached across calls to reduce overhead.

## Development

- Build: `bun run build`
- Tests: `bun test`
- Lint: `bun run lint`

## License

MIT
