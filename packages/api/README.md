# @listee/api

HTTP-facing application utilities for Listee. The package wires queries, services, and repositories so Hono route handlers can expose category/task endpoints and health checks with minimal boilerplate.

## Installation

```bash
npm install @listee/api
```

## Features

- `createApp` helper that returns a fully wired Hono instance
- Register functions for categories, tasks, and health routes
- Query facades that coordinate services and repositories per use case
- Validation utilities shared across handlers to enforce input constraints

## Quick start

```ts
import { Hono } from "hono";
import {
  createCategoryQueries,
  createTaskQueries,
  registerCategoryRoutes,
  registerTaskRoutes,
} from "@listee/api";

const app = new Hono();

const categoryQueries = createCategoryQueries(/* dependencies */);
const taskQueries = createTaskQueries(/* dependencies */);

registerCategoryRoutes(app, { queries: categoryQueries });
registerTaskRoutes(app, { queries: taskQueries });

export default app;
```

All queries accept factories so tests can inject fakes/mocks. See `src/queries/` and `src/routes/` for concrete wiring examples.

## Development

- Build: `bun run build`
- Tests: `bun test`
- Lint: `bun run lint`

## License

MIT
