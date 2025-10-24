import type {
  CreateTaskParams,
  DeleteTaskParams,
  FindTaskRepositoryParams,
  ListTasksRepositoryParams,
  Task,
  TaskService,
  TaskServiceDependencies,
  UpdateTaskParams,
} from "@listee/types";

export function createTaskService(
  dependencies: TaskServiceDependencies,
): TaskService {
  async function listByCategory(
    params: ListTasksRepositoryParams,
  ): Promise<readonly Task[]> {
    return dependencies.repository.listByCategory(params);
  }

  async function findById(
    params: FindTaskRepositoryParams,
  ): Promise<Task | null> {
    return dependencies.repository.findById(params);
  }

  async function create(params: CreateTaskParams): Promise<Task> {
    if (dependencies.categoryRepository !== undefined) {
      const category = await dependencies.categoryRepository.findById({
        categoryId: params.categoryId,
        userId: params.userId,
      });

      if (category === null) {
        throw new Error("Category not found");
      }
    }

    return dependencies.repository.create({
      categoryId: params.categoryId,
      name: params.name,
      description: params.description ?? null,
      isChecked: params.isChecked ?? false,
      createdBy: params.userId,
      updatedBy: params.userId,
    });
  }

  async function update(params: UpdateTaskParams): Promise<Task | null> {
    return dependencies.repository.update({
      taskId: params.taskId,
      userId: params.userId,
      name: params.name,
      description: params.description,
      isChecked: params.isChecked,
      updatedBy: params.userId,
    });
  }

  async function deleteTask(params: DeleteTaskParams): Promise<boolean> {
    return dependencies.repository.delete({
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
