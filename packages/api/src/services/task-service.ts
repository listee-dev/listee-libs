import type { Task } from "@listee/types";
import type {
  FindTaskRepositoryParams,
  ListTasksRepositoryParams,
  TaskRepository,
} from "../repositories/task-repository";

export interface TaskService {
  listByCategory(params: ListTasksRepositoryParams): Promise<readonly Task[]>;
  findById(params: FindTaskRepositoryParams): Promise<Task | null>;
}

export interface TaskServiceDependencies {
  readonly repository: TaskRepository;
}

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
