import type { AuthenticationProvider } from "./authentication";
import type { Category, PaginatedResult, Task } from "./db";

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

export interface CategoryService {
  listByUserId(
    params: ListCategoriesRepositoryParams,
  ): Promise<PaginatedResult<Category>>;
  findById(params: FindCategoryRepositoryParams): Promise<Category | null>;
}

export interface CategoryServiceDependencies {
  readonly repository: CategoryRepository;
}

export interface ListTasksRepositoryParams {
  readonly categoryId: string;
  readonly userId?: string;
}

export interface FindTaskRepositoryParams {
  readonly taskId: string;
  readonly userId?: string;
}

export interface TaskRepository {
  listByCategory(params: ListTasksRepositoryParams): Promise<readonly Task[]>;
  findById(params: FindTaskRepositoryParams): Promise<Task | null>;
}

export interface TaskService {
  listByCategory(params: ListTasksRepositoryParams): Promise<readonly Task[]>;
  findById(params: FindTaskRepositoryParams): Promise<Task | null>;
}

export interface TaskServiceDependencies {
  readonly repository: TaskRepository;
}

export interface CategoryQueriesDependencies {
  readonly service: CategoryService;
}

export interface TaskQueriesDependencies {
  readonly service: TaskService;
}

export interface RegisterCategoryRoutesOptions {
  readonly queries?: CategoryQueries;
  readonly authentication?: AuthenticationProvider;
}

export interface RegisterTaskRoutesOptions {
  readonly queries?: TaskQueries;
  readonly authentication?: AuthenticationProvider;
}

export interface RegisterHealthRoutesOptions {
  readonly databaseHealth?: DatabaseHealthChecker;
}

export interface AppDependencies {
  readonly databaseHealth?: DatabaseHealthChecker;
  readonly categoryQueries?: CategoryQueries;
  readonly taskQueries?: TaskQueries;
  readonly authentication?: AuthenticationProvider;
}
