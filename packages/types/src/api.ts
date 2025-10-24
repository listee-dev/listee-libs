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
  create(params: CreateCategoryParams): Promise<Category>;
  update(params: UpdateCategoryParams): Promise<Category | null>;
  delete(params: DeleteCategoryParams): Promise<boolean>;
}

export interface CreateCategoryParams {
  readonly userId: string;
  readonly name: string;
  readonly kind: string;
}

export interface UpdateCategoryParams {
  readonly categoryId: string;
  readonly userId: string;
  readonly name?: string;
  readonly kind?: string;
}

export interface DeleteCategoryParams {
  readonly categoryId: string;
  readonly userId: string;
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
  create(params: CreateTaskParams): Promise<Task>;
  update(params: UpdateTaskParams): Promise<Task | null>;
  delete(params: DeleteTaskParams): Promise<boolean>;
}

export interface CreateTaskParams {
  readonly categoryId: string;
  readonly userId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly isChecked?: boolean;
}

export interface UpdateTaskParams {
  readonly taskId: string;
  readonly userId: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly isChecked?: boolean;
}

export interface DeleteTaskParams {
  readonly taskId: string;
  readonly userId: string;
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

export interface CreateCategoryRepositoryParams {
  readonly name: string;
  readonly kind: string;
  readonly createdBy: string;
  readonly updatedBy: string;
}

export interface UpdateCategoryRepositoryParams {
  readonly categoryId: string;
  readonly userId: string;
  readonly name?: string;
  readonly kind?: string;
  readonly updatedBy: string;
}

export interface DeleteCategoryRepositoryParams {
  readonly categoryId: string;
  readonly userId: string;
}

export interface CategoryRepository {
  listByUserId(
    params: ListCategoriesRepositoryParams,
  ): Promise<PaginatedResult<Category>>;
  findById(params: FindCategoryRepositoryParams): Promise<Category | null>;
  create(params: CreateCategoryRepositoryParams): Promise<Category>;
  update(params: UpdateCategoryRepositoryParams): Promise<Category | null>;
  delete(params: DeleteCategoryRepositoryParams): Promise<boolean>;
}

export interface CategoryService {
  listByUserId(
    params: ListCategoriesRepositoryParams,
  ): Promise<PaginatedResult<Category>>;
  findById(params: FindCategoryRepositoryParams): Promise<Category | null>;
  create(params: CreateCategoryParams): Promise<Category>;
  update(params: UpdateCategoryParams): Promise<Category | null>;
  delete(params: DeleteCategoryParams): Promise<boolean>;
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

export interface CreateTaskRepositoryParams {
  readonly categoryId: string;
  readonly name: string;
  readonly description?: string | null;
  readonly isChecked: boolean;
  readonly createdBy: string;
  readonly updatedBy: string;
}

export interface UpdateTaskRepositoryParams {
  readonly taskId: string;
  readonly userId: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly isChecked?: boolean;
  readonly updatedBy: string;
}

export interface DeleteTaskRepositoryParams {
  readonly taskId: string;
  readonly userId: string;
}

export interface TaskRepository {
  listByCategory(params: ListTasksRepositoryParams): Promise<readonly Task[]>;
  findById(params: FindTaskRepositoryParams): Promise<Task | null>;
  create(params: CreateTaskRepositoryParams): Promise<Task>;
  update(params: UpdateTaskRepositoryParams): Promise<Task | null>;
  delete(params: DeleteTaskRepositoryParams): Promise<boolean>;
}

export interface TaskService {
  listByCategory(params: ListTasksRepositoryParams): Promise<readonly Task[]>;
  findById(params: FindTaskRepositoryParams): Promise<Task | null>;
  create(params: CreateTaskParams): Promise<Task>;
  update(params: UpdateTaskParams): Promise<Task | null>;
  delete(params: DeleteTaskParams): Promise<boolean>;
}

export interface TaskServiceDependencies {
  readonly repository: TaskRepository;
  readonly categoryRepository?: CategoryRepository;
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
  readonly categoryQueries?: CategoryQueries;
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
