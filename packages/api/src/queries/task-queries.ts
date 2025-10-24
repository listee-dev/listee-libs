import type {
  CreateTaskParams,
  DeleteTaskParams,
  FindTaskParams,
  ListTasksParams,
  TaskQueries,
  TaskQueriesDependencies,
  UpdateTaskParams,
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

  async function update(params: UpdateTaskParams) {
    return dependencies.service.update({
      taskId: params.taskId,
      userId: params.userId,
      name: params.name,
      description: params.description,
      isChecked: params.isChecked,
    });
  }

  async function deleteTask(params: DeleteTaskParams) {
    return dependencies.service.delete({
      taskId: params.taskId,
      userId: params.userId,
    });
  }

  return {
    listByCategory,
    findById,
    create,
    update,
    delete: deleteTask,
  };
}
