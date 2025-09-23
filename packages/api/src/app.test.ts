import { describe, expect, test } from "bun:test";
import { createHeaderAuthentication } from "@listee/auth";
import type { Category, Task } from "@listee/types";
import { createApp } from "./app";
import type {
  CategoryQueries,
  ListCategoriesResult,
  TaskQueries,
} from "./types";

function createRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, init);
}

describe("health routes", () => {
  test("returns ok status", async () => {
    const app = createApp();
    const response = await app.fetch(createRequest("/healthz"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  test("returns unknown when database checker is missing", async () => {
    const app = createApp();
    const response = await app.fetch(createRequest("/healthz/database"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("unknown");
  });

  test("returns ok when database checker succeeds", async () => {
    const app = createApp({
      databaseHealth: async () => ({ ok: true }),
    });

    const response = await app.fetch(createRequest("/healthz/database"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  test("returns error when database checker fails", async () => {
    const app = createApp({
      databaseHealth: async () => ({ ok: false, error: "connection failed" }),
    });

    const response = await app.fetch(createRequest("/healthz/database"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("error");
    expect(body.error).toBe("connection failed");
  });
});

describe("category routes", () => {
  const { categoryQueries, categories } = createCategoryQueries();

  test("lists categories for a user", async () => {
    const authentication = createHeaderAuthentication();
    const app = createApp({ categoryQueries, authentication });

    const response = await app.fetch(
      createRequest("/users/user-1/categories?limit=1", {
        headers: { Authorization: "Bearer user-1" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.meta.hasMore).toBe(true);
    expect(body.meta.nextCursor).toBe(categories[0].createdAt.toISOString());
  });

  test("rejects invalid limit", async () => {
    const authentication = createHeaderAuthentication();
    const app = createApp({ categoryQueries, authentication });

    const response = await app.fetch(
      createRequest("/users/user-1/categories?limit=-1", {
        headers: { Authorization: "Bearer user-1" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid limit parameter");
  });

  test("finds category by id", async () => {
    const authentication = createHeaderAuthentication();
    const app = createApp({ categoryQueries, authentication });
    const target = categories[0];

    const response = await app.fetch(
      createRequest(`/categories/${target.id}`, {
        headers: { Authorization: `Bearer ${target.createdBy}` },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(target.id);
  });

  test("returns 404 when category is missing", async () => {
    const authentication = createHeaderAuthentication();
    const app = createApp({ categoryQueries, authentication });

    const response = await app.fetch(
      createRequest("/categories/unknown", {
        headers: { Authorization: "Bearer user-1" },
      }),
    );
    expect(response.status).toBe(404);
  });
});

describe("task routes", () => {
  const { taskQueries, tasks } = createTaskQueries();

  test("lists tasks for a category", async () => {
    const authentication = createHeaderAuthentication();
    const app = createApp({ taskQueries, authentication });
    const categoryId = tasks[0].categoryId;

    const response = await app.fetch(
      createRequest(`/categories/${categoryId}/tasks`, {
        headers: { Authorization: `Bearer ${tasks[0].createdBy}` },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  test("finds task by id", async () => {
    const authentication = createHeaderAuthentication();
    const app = createApp({ taskQueries, authentication });
    const target = tasks[0];

    const response = await app.fetch(
      createRequest(`/tasks/${target.id}`, {
        headers: { Authorization: `Bearer ${target.createdBy}` },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(target.id);
  });

  test("returns 404 when task is missing", async () => {
    const authentication = createHeaderAuthentication();
    const app = createApp({ taskQueries, authentication });

    const response = await app.fetch(
      createRequest("/tasks/unknown", {
        headers: { Authorization: "Bearer user-1" },
      }),
    );
    expect(response.status).toBe(404);
  });
});

function createCategoryQueries(): {
  readonly categoryQueries: CategoryQueries;
  readonly categories: readonly Category[];
} {
  const categories: Category[] = [
    createCategory({
      id: "category-1",
      createdAt: new Date("2024-01-03T00:00:00Z"),
    }),
    createCategory({
      id: "category-2",
      createdAt: new Date("2024-01-02T00:00:00Z"),
    }),
    createCategory({
      id: "category-3",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    }),
  ];

  const categoryQueries: CategoryQueries = {
    listByUserId: async ({ userId, limit = 20 }) => {
      const items = categories
        .filter((category) => category.createdBy === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const selected = items.slice(0, limit);
      const hasMore = items.length > selected.length;
      const nextCursor = hasMore
        ? (selected[selected.length - 1]?.createdAt.toISOString() ?? null)
        : null;

      return {
        items: selected,
        nextCursor,
        hasMore,
      } satisfies ListCategoriesResult;
    },
    findById: async ({ categoryId }) => {
      const category = categories.find((item) => item.id === categoryId);
      return category ?? null;
    },
  };

  return { categoryQueries, categories };
}

function createTaskQueries(): {
  readonly taskQueries: TaskQueries;
  readonly tasks: readonly Task[];
} {
  const tasks: Task[] = [
    createTask({ id: "task-1", categoryId: "category-1" }),
    createTask({ id: "task-2", categoryId: "category-2" }),
  ];

  const taskQueries: TaskQueries = {
    listByCategory: async ({ categoryId }) =>
      tasks.filter((task) => task.categoryId === categoryId),
    findById: async ({ taskId }) => {
      const task = tasks.find((item) => item.id === taskId);
      return task ?? null;
    },
  };

  return { taskQueries, tasks };
}

interface CategoryOptions {
  readonly id: string;
  readonly createdAt: Date;
}

function createCategory(options: CategoryOptions): Category {
  return {
    id: options.id,
    name: `Category ${options.id}`,
    kind: "user",
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  };
}

interface TaskOptions {
  readonly id: string;
  readonly categoryId: string;
}

function createTask(options: TaskOptions): Task {
  const timestamp = new Date("2024-01-01T00:00:00Z");
  return {
    id: options.id,
    name: `Task ${options.id}`,
    description: null,
    isChecked: false,
    categoryId: options.categoryId,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
