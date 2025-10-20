import { describe, expect, test } from "bun:test";
import { createHeaderAuthentication } from "@listee/auth";
import type {
  Category,
  CategoryQueries,
  ListCategoriesResult,
  Task,
  TaskQueries,
} from "@listee/types";
import { createApp } from "./app";

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
  test("lists categories for a user", async () => {
    const { categoryQueries, categories } = createCategoryQueries();
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
    const { categoryQueries } = createCategoryQueries();
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
    const { categoryQueries, categories } = createCategoryQueries();
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
    const { categoryQueries } = createCategoryQueries();
    const authentication = createHeaderAuthentication();
    const app = createApp({ categoryQueries, authentication });

    const response = await app.fetch(
      createRequest("/categories/unknown", {
        headers: { Authorization: "Bearer user-1" },
      }),
    );
    expect(response.status).toBe(404);
  });

  test("creates category for a user", async () => {
    const { categoryQueries } = createCategoryQueries();
    const authentication = createHeaderAuthentication();
    const app = createApp({ categoryQueries, authentication });

    const response = await app.fetch(
      createRequest("/users/user-1/categories", {
        method: "POST",
        headers: {
          Authorization: "Bearer user-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Inbox", kind: "user" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.name).toBe("Inbox");
    expect(body.data.kind).toBe("user");
  });
});

describe("task routes", () => {
  test("lists tasks for a category", async () => {
    const { taskQueries, tasks } = createTaskQueries();
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
    const { taskQueries, tasks } = createTaskQueries();
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
    const { taskQueries } = createTaskQueries();
    const authentication = createHeaderAuthentication();
    const app = createApp({ taskQueries, authentication });

    const response = await app.fetch(
      createRequest("/tasks/unknown", {
        headers: { Authorization: "Bearer user-1" },
      }),
    );
    expect(response.status).toBe(404);
  });

  test("creates task for a category", async () => {
    const { categoryQueries } = createCategoryQueries();
    const { taskQueries } = createTaskQueries();
    const authentication = createHeaderAuthentication();
    const category = await categoryQueries.findById({
      categoryId: "category-1",
      userId: "user-1",
    });

    if (category === null) {
      throw new Error("Expected category to exist in test fixture");
    }

    const app = createApp({
      taskQueries,
      categoryQueries,
      authentication,
    });

    const response = await app.fetch(
      createRequest(`/categories/${category.id}/tasks`, {
        method: "POST",
        headers: {
          Authorization: "Bearer user-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "New Task", description: "Details" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.name).toBe("New Task");
    expect(body.data.categoryId).toBe(category.id);
  });
});

function createCategoryQueries(): {
  readonly categoryQueries: CategoryQueries;
  readonly categories: Category[];
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

  let nextCategoryId = categories.length + 1;

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
    create: async ({ userId, name, kind }) => {
      const newCategory = createCategory({
        id: `category-${nextCategoryId}`,
        createdAt: new Date("2024-01-04T00:00:00Z"),
        name,
        kind,
        createdBy: userId,
        updatedBy: userId,
      });
      nextCategoryId += 1;
      categories.unshift(newCategory);
      return newCategory;
    },
  };

  return { categoryQueries, categories };
}

function createTaskQueries(): {
  readonly taskQueries: TaskQueries;
  readonly tasks: Task[];
} {
  const tasks: Task[] = [
    createTask({ id: "task-1", categoryId: "category-1" }),
    createTask({ id: "task-2", categoryId: "category-2" }),
  ];

  let nextTaskId = tasks.length + 1;

  const taskQueries: TaskQueries = {
    listByCategory: async ({ categoryId }) =>
      tasks.filter((task) => task.categoryId === categoryId),
    findById: async ({ taskId }) => {
      const task = tasks.find((item) => item.id === taskId);
      return task ?? null;
    },
    create: async ({
      categoryId,
      userId,
      name,
      description,
      isChecked,
    }) => {
      const newTask = createTask({
        id: `task-${nextTaskId}`,
        categoryId,
        name,
        description: description ?? null,
        isChecked: isChecked ?? false,
        createdBy: userId,
        updatedBy: userId,
      });
      nextTaskId += 1;
      tasks.push(newTask);
      return newTask;
    },
  };

  return { taskQueries, tasks };
}

interface CategoryOptions {
  readonly id: string;
  readonly createdAt: Date;
  readonly name?: string;
  readonly kind?: string;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

function createCategory(options: CategoryOptions): Category {
  const createdBy = options.createdBy ?? "user-1";
  const updatedBy = options.updatedBy ?? createdBy;

  return {
    id: options.id,
    name: options.name ?? `Category ${options.id}`,
    kind: options.kind ?? "user",
    createdBy,
    updatedBy,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  };
}

interface TaskOptions {
  readonly id: string;
  readonly categoryId: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly isChecked?: boolean;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

function createTask(options: TaskOptions): Task {
  const timestamp = new Date("2024-01-01T00:00:00Z");
  const createdBy = options.createdBy ?? "user-1";
  const updatedBy = options.updatedBy ?? createdBy;

  return {
    id: options.id,
    name: options.name ?? `Task ${options.id}`,
    description: options.description ?? null,
    isChecked: options.isChecked ?? false,
    categoryId: options.categoryId,
    createdBy,
    updatedBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
