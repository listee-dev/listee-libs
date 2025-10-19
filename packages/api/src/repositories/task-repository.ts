import type { Database } from "@listee/db";
import { eq, tasks } from "@listee/db";
import type {
  FindTaskRepositoryParams,
  ListTasksRepositoryParams,
  Task,
  TaskRepository,
} from "@listee/types";

export function createTaskRepository(db: Database): TaskRepository {
  async function listByCategory(
    params: ListTasksRepositoryParams,
  ): Promise<readonly Task[]> {
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.categoryId, params.categoryId));

    if (params.userId === undefined) {
      return rows;
    }

    return rows.filter((task) => task.createdBy === params.userId);
  }

  async function findById(
    params: FindTaskRepositoryParams,
  ): Promise<Task | null> {
    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, params.taskId))
      .limit(1);

    const task = rows[0];
    if (task === undefined) {
      return null;
    }

    if (params.userId !== undefined && task.createdBy !== params.userId) {
      return null;
    }

    return task;
  }

  return {
    listByCategory,
    findById,
  };
}
