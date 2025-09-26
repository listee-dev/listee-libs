import type {
  CategoryQueries,
  CategoryQueriesDependencies,
  FindCategoryParams,
  ListCategoriesParams,
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

  return {
    listByUserId,
    findById,
  };
}
