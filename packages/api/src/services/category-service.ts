import type {
  Category,
  CategoryService,
  CategoryServiceDependencies,
  CreateCategoryParams,
  DeleteCategoryParams,
  FindCategoryRepositoryParams,
  ListCategoriesRepositoryParams,
  PaginatedResult,
  UpdateCategoryParams,
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

  async function update(
    params: UpdateCategoryParams,
  ): Promise<Category | null> {
    return dependencies.repository.update({
      categoryId: params.categoryId,
      userId: params.userId,
      name: params.name,
      kind: params.kind,
      updatedBy: params.userId,
    });
  }

  async function deleteCategory(
    params: DeleteCategoryParams,
  ): Promise<boolean> {
    return dependencies.repository.delete({
      categoryId: params.categoryId,
      userId: params.userId,
    });
  }

  return {
    listByUserId,
    findById,
    create,
    update,
    delete: deleteCategory,
  };
}
