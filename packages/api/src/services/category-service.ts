import type {
  Category,
  CategoryService,
  CategoryServiceDependencies,
  FindCategoryRepositoryParams,
  ListCategoriesRepositoryParams,
  PaginatedResult,
} from "@listee/types";

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
