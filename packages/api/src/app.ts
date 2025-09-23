import type { AuthenticationProvider } from "@listee/auth";
import { Hono } from "hono";
import { registerCategoryRoutes } from "./routes/categories";
import { registerHealthRoutes } from "./routes/health";
import { registerTaskRoutes } from "./routes/tasks";
import type {
  CategoryQueries,
  DatabaseHealthChecker,
  TaskQueries,
} from "./types";

export interface AppDependencies {
  databaseHealth?: DatabaseHealthChecker;
  categoryQueries?: CategoryQueries;
  taskQueries?: TaskQueries;
  authentication?: AuthenticationProvider;
}

export function createApp(dependencies: AppDependencies = {}): Hono {
  const app = new Hono();

  registerHealthRoutes(app, { databaseHealth: dependencies.databaseHealth });
  registerCategoryRoutes(app, {
    queries: dependencies.categoryQueries,
    authentication: dependencies.authentication,
  });
  registerTaskRoutes(app, {
    queries: dependencies.taskQueries,
    authentication: dependencies.authentication,
  });

  return app;
}

type AppFetch = ReturnType<typeof createApp>["fetch"];

export function createFetchHandler(
  dependencies: AppDependencies = {},
): (
  request: Request,
  env?: Parameters<AppFetch>[1],
  executionContext?: Parameters<AppFetch>[2],
) => Promise<Response> {
  const app = createApp(dependencies);
  return async (request, env, executionContext) =>
    await app.fetch(request, env, executionContext);
}
