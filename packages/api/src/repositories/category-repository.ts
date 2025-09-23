import type { Database } from "@listee/db";
import { categories } from "@listee/db";
import type { Category, PaginatedResult } from "@listee/types";
import { and, desc, eq, lt } from "drizzle-orm";

export interface ListCategoriesRepositoryParams {
  readonly userId: string;
  readonly limit: number;
  readonly cursor?: string | null;
}

export interface FindCategoryRepositoryParams {
  readonly categoryId: string;
  readonly userId?: string;
}

export interface CategoryRepository {
  listByUserId(
    params: ListCategoriesRepositoryParams,
  ): Promise<PaginatedResult<Category>>;
  findById(params: FindCategoryRepositoryParams): Promise<Category | null>;
}

function parseCursor(value: string | null | undefined): Date | null {
  if (value === undefined || value === null || value.length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function createCategoryRepository(db: Database): CategoryRepository {
  async function listByUserId(
    params: ListCategoriesRepositoryParams,
  ): Promise<PaginatedResult<Category>> {
    const baseCondition = eq(categories.createdBy, params.userId);
    const cursorDate = parseCursor(params.cursor);
    const condition =
      cursorDate === null
        ? baseCondition
        : and(baseCondition, lt(categories.createdAt, cursorDate));

    const limit = params.limit;
    const rows = await db
      .select()
      .from(categories)
      .where(condition)
      .orderBy(desc(categories.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor: string | null = null;

    if (hasMore) {
      const lastItem = items[items.length - 1];
      if (lastItem !== undefined) {
        nextCursor = lastItem.createdAt.toISOString();
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
