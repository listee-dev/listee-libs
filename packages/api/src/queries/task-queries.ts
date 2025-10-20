import type {
  CreateTaskParams,
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

  async function create(params: CreateTaskParams) {
    return dependencies.service.create({
      categoryId: params.categoryId,
      userId: params.userId,
      name: params.name,
      description: params.description,
      isChecked: params.isChecked,
    });
  }

  return {
    listByCategory,
    findById,
    create,
  };
}
