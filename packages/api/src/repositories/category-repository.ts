import { Buffer } from "node:buffer";
import type { Database } from "@listee/db";
import { and, categories, desc, eq, lt, or } from "@listee/db";
import type {
  Category,
  CategoryRepository,
  FindCategoryRepositoryParams,
  ListCategoriesRepositoryParams,
  PaginatedResult,
} from "@listee/types";

interface CategoryCursorPayload {
  readonly createdAt: string;
  readonly id: string;
}

interface CategoryCursor {
  readonly createdAt: Date;
  readonly id: string;
}

function decodeBase64Url(value: string): Buffer | null {
  const base64Characters = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = base64Characters.length % 4;
  const normalized =
    remainder === 0
      ? base64Characters
      : `${base64Characters}${"====".slice(remainder)}`;

  try {
    return Buffer.from(normalized, "base64");
  } catch {
    return null;
  }
}

function parseCursor(value: string | null | undefined): CategoryCursor | null {
  if (value === undefined || value === null || value.length === 0) {
    return null;
  }

  try {
    const decodedBuffer = decodeBase64Url(value);
    if (decodedBuffer === null) {
      return null;
    }
    const decoded = decodedBuffer.toString("utf8");
    const payload = JSON.parse(decoded) as CategoryCursorPayload;
    if (
      typeof payload.createdAt !== "string" ||
      typeof payload.id !== "string"
    ) {
      return null;
    }

    const createdAt = new Date(payload.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return { createdAt, id: payload.id };
  } catch {
    return null;
  }
}

export function createCategoryRepository(db: Database): CategoryRepository {
  async function listByUserId(
    params: ListCategoriesRepositoryParams,
  ): Promise<PaginatedResult<Category>> {
    const baseCondition = eq(categories.createdBy, params.userId);
    const cursor = parseCursor(params.cursor);
    const condition =
      cursor === null
        ? baseCondition
        : and(
            baseCondition,
            or(
              lt(categories.createdAt, cursor.createdAt),
              and(
                eq(categories.createdAt, cursor.createdAt),
                lt(categories.id, cursor.id),
              ),
            ),
          );

    const rawLimit = Math.trunc(params.limit);
    if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    const limit = rawLimit;
    const rows = await db
      .select()
      .from(categories)
      .where(condition)
      .orderBy(desc(categories.createdAt), desc(categories.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor: string | null = null;

    if (hasMore) {
      const lastItem = items[items.length - 1];
      if (lastItem !== undefined) {
        const payload: CategoryCursorPayload = {
          createdAt: lastItem.createdAt.toISOString(),
          id: lastItem.id,
        };

        nextCursor = Buffer.from(JSON.stringify(payload), "utf8").toString(
          "base64url",
        );
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async function findById(
    params: FindCategoryRepositoryParams,
  ): Promise<Category | null> {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.id, params.categoryId))
      .limit(1);

    const category = rows[0];
    if (category === undefined) {
      return null;
    }

    if (params.userId !== undefined && category.createdBy !== params.userId) {
      return null;
    }

    return category;
  }

  return {
    listByUserId,
    findById,
  };
}
