import type {
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

  return {
    listByCategory,
    findById,
  };
}
