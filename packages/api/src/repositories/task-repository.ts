import type { Database } from "@listee/db";
import { and, categories, eq, or, tasks } from "@listee/db";
import type {
  CreateTaskRepositoryParams,
  DeleteTaskRepositoryParams,
  FindTaskRepositoryParams,
  ListTasksRepositoryParams,
  Task,
  TaskRepository,
  UpdateTaskRepositoryParams,
} from "@listee/types";

export function createTaskRepository(db: Database): TaskRepository {
  async function hasTaskAccess(
    taskId: string,
    userId: string,
  ): Promise<boolean> {
    const rows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .innerJoin(categories, eq(tasks.categoryId, categories.id))
      .where(
        and(
          eq(tasks.id, taskId),
          or(eq(tasks.createdBy, userId), eq(categories.createdBy, userId)),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async function listByCategory(
    params: ListTasksRepositoryParams,
  ): Promise<readonly Task[]> {
    if (params.userId === undefined) {
      const rows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.categoryId, params.categoryId));

      return rows;
    }

    const rows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(categories, eq(tasks.categoryId, categories.id))
      .where(
        and(
          eq(tasks.categoryId, params.categoryId),
          or(
            eq(tasks.createdBy, params.userId),
            eq(categories.createdBy, params.userId),
          ),
        ),
      );

    return rows.map((row) => row.task);
  }

  async function findById(
    params: FindTaskRepositoryParams,
  ): Promise<Task | null> {
    if (params.userId === undefined) {
      const rows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, params.taskId))
        .limit(1);

      const task = rows[0];
      return task ?? null;
    }

    const rows = await db
      .select({ task: tasks })
      .from(tasks)
      .innerJoin(categories, eq(tasks.categoryId, categories.id))
      .where(
        and(
          eq(tasks.id, params.taskId),
          or(
            eq(tasks.createdBy, params.userId),
            eq(categories.createdBy, params.userId),
          ),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row?.task ?? null;
  }

  async function create(params: CreateTaskRepositoryParams): Promise<Task> {
    const rows = await db
      .insert(tasks)
      .values({
        name: params.name,
        description: params.description ?? null,
        isChecked: params.isChecked,
        categoryId: params.categoryId,
        createdBy: params.createdBy,
        updatedBy: params.updatedBy,
      })
      .returning();

    const task = rows[0];
    if (task === undefined) {
      throw new Error("Failed to create task");
    }

    return task;
  }

  async function update(
    params: UpdateTaskRepositoryParams,
  ): Promise<Task | null> {
    const updateData: Partial<typeof tasks.$inferInsert> = {
      updatedBy: params.updatedBy,
      updatedAt: new Date(),
    };

    if (params.name !== undefined) {
      updateData.name = params.name;
    }

    if (params.description !== undefined) {
      updateData.description = params.description;
    }

    if (params.isChecked !== undefined) {
      updateData.isChecked = params.isChecked;
    }

    const canAccess = await hasTaskAccess(params.taskId, params.userId);
    if (!canAccess) {
      return null;
    }

    const rows = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, params.taskId))
      .returning();

    const task = rows[0];
    return task ?? null;
  }

  async function _delete(params: DeleteTaskRepositoryParams): Promise<boolean> {
    const canAccess = await hasTaskAccess(params.taskId, params.userId);
    if (!canAccess) {
      return false;
    }

    const rows = await db
      .delete(tasks)
      .where(eq(tasks.id, params.taskId))
      .returning({ id: tasks.id });

    return rows.length > 0;
  }

  return {
    listByCategory,
    findById,
    create,
    update,
    delete: _delete,
  };
}
