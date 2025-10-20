import type { RegisterCategoryRoutesOptions } from "@listee/types";
import type { Hono } from "hono";
import { toErrorMessage } from "../utils/error.js";
import { isNonEmptyString, isRecord } from "../utils/validation.js";
import { tryAuthenticate } from "./auth-utils.js";

interface CategoryResponse {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ListCategoriesResponse {
  readonly data: readonly CategoryResponse[];
  readonly meta: {
    readonly nextCursor: string | null;
    readonly hasMore: boolean;
  };
}

interface CreateCategoryPayload {
  readonly name: string;
  readonly kind: string;
}

function parseCreateCategoryPayload(
  value: unknown,
): CreateCategoryPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const nameValue = value.name;
  const kindValue = value.kind;

  if (!isNonEmptyString(nameValue) || !isNonEmptyString(kindValue)) {
    return null;
  }

  return {
    name: nameValue.trim(),
    kind: kindValue.trim(),
  };
}

function toCategoryResponse(category: {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    createdBy: category.createdBy,
    updatedBy: category.updatedBy,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function registerCategoryRoutes(
  app: Hono,
  options: RegisterCategoryRoutesOptions = {},
): void {
  const queries = options.queries;
  const authentication = options.authentication;

  if (queries === undefined || authentication === undefined) {
    return;
  }

  app.get("/users/:userId/categories", async (context) => {
    const authResult = await tryAuthenticate(authentication, context.req.raw);
    if (authResult === null) {
      return context.json({ error: "Unauthorized" }, 401);
    }
    const userId = context.req.param("userId");

    if (authResult.user.id !== userId) {
      return context.json({ error: "Forbidden" }, 403);
    }

    const limitParam = context.req.query("limit");
    const cursor = context.req.query("cursor") ?? null;
    const limit = parsePositiveInteger(limitParam);

    if (limitParam !== undefined && limit === undefined) {
      return context.json({ error: "Invalid limit parameter" }, 400);
    }

    const result = await queries.listByUserId({
      userId,
      limit,
      cursor,
    });

    const response: ListCategoriesResponse = {
      data: result.items.map((category) => toCategoryResponse(category)),
      meta: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    };

    return context.json(response);
  });

  app.get("/categories/:categoryId", async (context) => {
    const authResult = await tryAuthenticate(authentication, context.req.raw);
    if (authResult === null) {
      return context.json({ error: "Unauthorized" }, 401);
    }
    const categoryId = context.req.param("categoryId");

    const category = await queries.findById({
      categoryId,
      userId: authResult.user.id,
    });
    if (category === null) {
      return context.json({ error: "Not Found" }, 404);
    }

    return context.json({ data: toCategoryResponse(category) });
  });

  app.post("/users/:userId/categories", async (context) => {
    const authResult = await tryAuthenticate(authentication, context.req.raw);
    if (authResult === null) {
      return context.json({ error: "Unauthorized" }, 401);
    }

    const userId = context.req.param("userId");
    if (authResult.user.id !== userId) {
      return context.json({ error: "Forbidden" }, 403);
    }

    let payloadSource: unknown;
    try {
      payloadSource = await context.req.json();
    } catch {
      return context.json({ error: "Invalid JSON body" }, 400);
    }

    const payload = parseCreateCategoryPayload(payloadSource);
    if (payload === null) {
      return context.json({ error: "Invalid request body" }, 400);
    }

    try {
      const category = await queries.create({
        userId,
        name: payload.name,
        kind: payload.kind,
      });

      return context.json({ data: toCategoryResponse(category) }, 201);
    } catch (error) {
      return context.json({ error: toErrorMessage(error) }, 500);
    }
  });
}
