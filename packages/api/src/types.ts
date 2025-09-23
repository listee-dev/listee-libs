import type { Category, PaginatedResult, Task } from "@listee/types";

export interface ListCategoriesParams {
  readonly userId: string;
  readonly limit?: number;
  readonly cursor?: string | null;
}

export type ListCategoriesResult = PaginatedResult<Category>;

export interface FindCategoryParams {
  readonly categoryId: string;
  readonly userId?: string;
}

export interface CategoryQueries {
  listByUserId(params: ListCategoriesParams): Promise<ListCategoriesResult>;
  findById(params: FindCategoryParams): Promise<Category | null>;
}

export interface ListTasksParams {
  readonly categoryId: string;
  readonly userId?: string;
}

export interface FindTaskParams {
  readonly taskId: string;
  readonly userId?: string;
}

export interface TaskQueries {
  listByCategory(params: ListTasksParams): Promise<readonly Task[]>;
  findById(params: FindTaskParams): Promise<Task | null>;
}

export interface DatabaseHealthStatus {
  readonly ok: boolean;
  readonly error?: string;
}

export type DatabaseHealthChecker = () => Promise<DatabaseHealthStatus>;
