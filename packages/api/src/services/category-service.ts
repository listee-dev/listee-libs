import type {
  Category,
  CategoryService,
  CategoryServiceDependencies,
  CreateCategoryParams,
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

  async function create(params: CreateCategoryParams): Promise<Category> {
    return dependencies.repository.create({
      name: params.name,
      kind: params.kind,
      createdBy: params.userId,
      updatedBy: params.userId,
    });
  }

  return {
    listByUserId,
    findById,
    create,
  };
}
