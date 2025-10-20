import type {
  CategoryQueries,
  CategoryQueriesDependencies,
  CreateCategoryParams,
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

  async function create(params: CreateCategoryParams) {
    return dependencies.service.create({
      userId: params.userId,
      name: params.name,
      kind: params.kind,
    });
  }

  return {
    listByUserId,
    findById,
    create,
  };
}
