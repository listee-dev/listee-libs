import type { Category, PaginatedResult } from "@listee/types";
import type {
  CategoryRepository,
  FindCategoryRepositoryParams,
  ListCategoriesRepositoryParams,
} from "../repositories/category-repository";

export interface CategoryService {
  listByUserId(
    params: ListCategoriesRepositoryParams,
  ): Promise<PaginatedResult<Category>>;
  findById(params: FindCategoryRepositoryParams): Promise<Category | null>;
}

export interface CategoryServiceDependencies {
  readonly repository: CategoryRepository;
}

export function createCategoryService(
  dependencies: CategoryServiceDependencies,
): CategoryService {
  async function listByUserId(
    params: ListCategoriesRepositoryParams,
  ): Promise<PaginatedResult<Category>> {
    return dependencies.repository.listByUserId(params);
  }

  async function findById(
    params: FindCategoryRepositoryParams,
  ): Promise<Category | null> {
    return dependencies.repository.findById(params);
  }

  return {
    listByUserId,
    findById,
  };
}
