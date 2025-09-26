import type {
  FindTaskParams,
  ListTasksParams,
  TaskQueries,
  TaskQueriesDependencies,
} from "@listee/types";

export function createTaskQueries(
  dependencies: TaskQueriesDependencies,
): TaskQueries {
  async function listByCategory(params: ListTasksParams) {
    return dependencies.service.listByCategory({
      categoryId: params.categoryId,
      userId: params.userId,
    });
  }

  async function findById(params: FindTaskParams) {
    return dependencies.service.findById({
      taskId: params.taskId,
      userId: params.userId,
    });
  }

  return {
    listByCategory,
    findById,
  };
}
