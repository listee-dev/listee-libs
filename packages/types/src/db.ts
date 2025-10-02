import type {
  Category,
  categories,
  Profile,
  profiles,
  SupabaseToken,
  Task,
  tasks,
} from "@listee/db";

export type { Category, Profile, SupabaseToken, Task };

export type NewProfile = typeof profiles.$inferInsert;
export type NewCategory = typeof categories.$inferInsert;
export type NewTask = typeof tasks.$inferInsert;

export interface CategoryWithTasks {
  readonly category: Category;
  readonly tasks: readonly Task[];
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}
