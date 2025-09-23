import type { Hono } from "hono";
import type { DatabaseHealthChecker } from "../types";
import { toErrorMessage } from "../utils/error";

export interface RegisterHealthRoutesOptions {
  databaseHealth?: DatabaseHealthChecker;
}

export function registerHealthRoutes(
  app: Hono,
  options: RegisterHealthRoutesOptions = {},
): void {
  app.get("/healthz", (context) => {
    return context.json({ status: "ok" });
  });

  app.get("/healthz/database", async (context) => {
    const checker = options.databaseHealth;
    if (!checker) {
      return context.json({ status: "unknown" }, 200);
    }

    try {
      const result = await checker();
      if (result.ok) {
        return context.json({ status: "ok" });
      }

      return context.json(
        {
          status: "error",
          error: result.error ?? "Database check failed",
        },
        503,
      );
    } catch (error) {
      return context.json(
        {
          status: "error",
          error: toErrorMessage(error),
        },
        500,
      );
    }
  });
}
