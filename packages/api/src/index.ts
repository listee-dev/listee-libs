export type { AppDependencies } from "./app";
export { createApp, createFetchHandler } from "./app";
export { createDatabaseHealthChecker } from "./infrastructure/database-health";
export { createCategoryQueries } from "./queries/category-queries";
export { createTaskQueries } from "./queries/task-queries";
export { createCategoryRepository } from "./repositories/category-repository";
export { createTaskRepository } from "./repositories/task-repository";
export { registerCategoryRoutes } from "./routes/categories";
export { registerHealthRoutes } from "./routes/health";
export { registerTaskRoutes } from "./routes/tasks";
export { createCategoryService } from "./services/category-service";
export { createTaskService } from "./services/task-service";
export type {
  CategoryQueries,
  DatabaseHealthChecker,
  DatabaseHealthStatus,
  FindCategoryParams,
  FindTaskParams,
  ListCategoriesParams,
  ListCategoriesResult,
  ListTasksParams,
  TaskQueries,
} from "./types";
