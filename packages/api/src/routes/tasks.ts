import type { RegisterTaskRoutesOptions } from "@listee/types";
import type { Hono } from "hono";
import { toErrorMessage } from "../utils/error.js";
import { isBoolean, isNonEmptyString, isRecord } from "../utils/validation.js";
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

interface CreateTaskPayload {
  readonly name: string;
  readonly description: string | null;
  readonly isChecked?: boolean;
}

interface UpdateTaskPayload {
  readonly name?: string;
  readonly description?: string | null;
  readonly isChecked?: boolean;
}

function parseCreateTaskPayload(value: unknown): CreateTaskPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const nameValue = value.name;
  const descriptionValue = value.description;
  const isCheckedValue = value.isChecked;

  if (!isNonEmptyString(nameValue)) {
    return null;
  }

  if (
    descriptionValue !== undefined &&
    descriptionValue !== null &&
    typeof descriptionValue !== "string"
  ) {
    return null;
  }

  if (isCheckedValue !== undefined && !isBoolean(isCheckedValue)) {
    return null;
  }

  const description =
    typeof descriptionValue === "string" ? descriptionValue.trim() : null;

  return {
    name: nameValue.trim(),
    description,
    isChecked: isCheckedValue,
  };
}

function parseUpdateTaskPayload(value: unknown): UpdateTaskPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const hasName = "name" in value;
  const hasDescription = "description" in value;
  const hasIsChecked = "isChecked" in value;

  if (!hasName && !hasDescription && !hasIsChecked) {
    return null;
  }

  const payload: UpdateTaskPayload = {};

  if (hasName) {
    const nameValue = value.name;
    if (!isNonEmptyString(nameValue)) {
      return null;
    }

    payload.name = nameValue.trim();
  }

  if (hasDescription) {
    const descriptionValue = value.description;
    if (
      descriptionValue !== undefined &&
      descriptionValue !== null &&
      typeof descriptionValue !== "string"
    ) {
      return null;
    }

    payload.description =
      typeof descriptionValue === "string"
        ? descriptionValue.trim()
        : descriptionValue ?? null;
  }

  if (hasIsChecked) {
    const isCheckedValue = value.isChecked;
    if (!isBoolean(isCheckedValue)) {
      return null;
    }

    payload.isChecked = isCheckedValue;
  }

  return payload;
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
  const categoryQueries = options.categoryQueries;

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

  app.post("/categories/:categoryId/tasks", async (context) => {
    const authResult = await tryAuthenticate(authentication, context.req.raw);
    if (authResult === null) {
      return context.json({ error: "Unauthorized" }, 401);
    }

    const categoryId = context.req.param("categoryId");
    const userId = authResult.user.id;

    if (categoryQueries !== undefined) {
      const category = await categoryQueries.findById({
        categoryId,
        userId,
      });

      if (category === null) {
        return context.json({ error: "Not Found" }, 404);
      }
    }

    let payloadSource: unknown;
    try {
      payloadSource = await context.req.json();
    } catch {
      return context.json({ error: "Invalid JSON body" }, 400);
    }

    const payload = parseCreateTaskPayload(payloadSource);
    if (payload === null) {
      return context.json({ error: "Invalid request body" }, 400);
    }

    try {
      const task = await queries.create({
        categoryId,
        userId,
        name: payload.name,
        description: payload.description,
        isChecked: payload.isChecked,
      });

      return context.json({ data: toTaskResponse(task) }, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "Category not found") {
        return context.json({ error: "Not Found" }, 404);
      }

      return context.json({ error: toErrorMessage(error) }, 500);
    }
  });

  app.patch("/tasks/:taskId", async (context) => {
    const authResult = await tryAuthenticate(authentication, context.req.raw);
    if (authResult === null) {
      return context.json({ error: "Unauthorized" }, 401);
    }

    let payloadSource: unknown;
    try {
      payloadSource = await context.req.json();
    } catch {
      return context.json({ error: "Invalid JSON body" }, 400);
    }

    const payload = parseUpdateTaskPayload(payloadSource);
    if (payload === null) {
      return context.json({ error: "Invalid request body" }, 400);
    }

    try {
      const task = await queries.update({
        taskId: context.req.param("taskId"),
        userId: authResult.user.id,
        name: payload.name,
        description: payload.description,
        isChecked: payload.isChecked,
      });

      if (task === null) {
        return context.json({ error: "Not Found" }, 404);
      }

      return context.json({ data: toTaskResponse(task) });
    } catch (error) {
      return context.json({ error: toErrorMessage(error) }, 500);
    }
  });

  app.delete("/tasks/:taskId", async (context) => {
    const authResult = await tryAuthenticate(authentication, context.req.raw);
    if (authResult === null) {
      return context.json({ error: "Unauthorized" }, 401);
    }

    try {
      const deleted = await queries.delete({
        taskId: context.req.param("taskId"),
        userId: authResult.user.id,
      });

      if (!deleted) {
        return context.json({ error: "Not Found" }, 404);
      }

      return context.newResponse(null, 204);
    } catch (error) {
      return context.json({ error: toErrorMessage(error) }, 500);
    }
  });
}
