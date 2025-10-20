import type {
  CreateTaskParams,
  FindTaskRepositoryParams,
  ListTasksRepositoryParams,
  Task,
  TaskService,
  TaskServiceDependencies,
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

  return {
    listByCategory,
    findById,
    create,
  };
}
