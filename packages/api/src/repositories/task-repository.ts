import type { Database } from "@listee/db";
import { and, categories, desc, eq, or, sql, tasks } from "@listee/db";
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
  async function listByCategory(
    params: ListTasksRepositoryParams,
  ): Promise<readonly Task[]> {
    if (params.userId === undefined) {
      const rows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.categoryId, params.categoryId))
        .orderBy(desc(tasks.createdAt), desc(tasks.id));

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
      )
      .orderBy(desc(tasks.createdAt), desc(tasks.id));

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

    const rows = await db
      .update(tasks)
      .set(updateData)
      .where(
        and(
          eq(tasks.id, params.taskId),
          or(
            eq(tasks.createdBy, params.userId),
            sql<boolean>`
              exists(
                select 1
                from ${categories}
                where ${categories.id} = ${tasks.categoryId}
                and ${categories.createdBy} = ${params.userId}
              )
            `,
          ),
        ),
      )
      .returning();

    const task = rows[0];
    return task ?? null;
  }

  async function _delete(params: DeleteTaskRepositoryParams): Promise<boolean> {
    const rows = await db
      .delete(tasks)
      .where(
        and(
          eq(tasks.id, params.taskId),
          or(
            eq(tasks.createdBy, params.userId),
            sql<boolean>`
              exists(
                select 1
                from ${categories}
                where ${categories.id} = ${tasks.categoryId}
                and ${categories.createdBy} = ${params.userId}
              )
            `,
          ),
        ),
      )
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
