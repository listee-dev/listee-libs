import type {
  CategoryQueries,
  CategoryQueriesDependencies,
  CreateCategoryParams,
  DeleteCategoryParams,
  FindCategoryParams,
  ListCategoriesParams,
  UpdateCategoryParams,
} from "@listee/types";

export function createCategoryQueries(
  dependencies: CategoryQueriesDependencies,
): CategoryQueries {
  async function listByUserId(params: ListCategoriesParams) {
    const limit = params.limit ?? 20;

    return dependencies.service.listByUserId({
      userId: params.userId,
      limit,
      cursor: params.cursor,
    });
  }

  async function findById(params: FindCategoryParams) {
    return dependencies.service.findById({
      categoryId: params.categoryId,
      userId: params.userId,
    });
  }

  async function create(params: CreateCategoryParams) {
    return dependencies.service.create({
      userId: params.userId,
      name: params.name,
      kind: params.kind,
    });
  }

  async function update(params: UpdateCategoryParams) {
    return dependencies.service.update({
      categoryId: params.categoryId,
      userId: params.userId,
      name: params.name,
    });
  }

  async function deleteCategory(params: DeleteCategoryParams) {
    return dependencies.service.delete({
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
