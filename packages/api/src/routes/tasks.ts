import type { RegisterTaskRoutesOptions } from "@listee/types";
import type { Hono } from "hono";
import { tryAuthenticate } from "./auth-utils.js";

interface TaskResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isChecked: boolean;
  readonly categoryId: string;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toTaskResponse(task: {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isChecked: boolean;
  readonly categoryId: string;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): TaskResponse {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    isChecked: task.isChecked,
    categoryId: task.categoryId,
    createdBy: task.createdBy,
    updatedBy: task.updatedBy,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function registerTaskRoutes(
  app: Hono,
  options: RegisterTaskRoutesOptions = {},
): void {
  const queries = options.queries;
  const authentication = options.authentication;

  if (queries === undefined || authentication === undefined) {
    return;
  }

  app.get("/categories/:categoryId/tasks", async (context) => {
    const authResult = await tryAuthenticate(authentication, context.req.raw);
    if (authResult === null) {
      return context.json({ error: "Unauthorized" }, 401);
    }

    const categoryId = context.req.param("categoryId");

    const tasks = await queries.listByCategory({
      categoryId,
      userId: authResult.user.id,
    });
    return context.json({ data: tasks.map((task) => toTaskResponse(task)) });
  });

  app.get("/tasks/:taskId", async (context) => {
    const authResult = await tryAuthenticate(authentication, context.req.raw);
    if (authResult === null) {
      return context.json({ error: "Unauthorized" }, 401);
    }

    const taskId = context.req.param("taskId");

    const task = await queries.findById({
      taskId,
      userId: authResult.user.id,
    });
    if (task === null) {
      return context.json({ error: "Not Found" }, 404);
    }

    return context.json({ data: toTaskResponse(task) });
  });
}
