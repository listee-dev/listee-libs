import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

// Import only the type information so the actual module code is evaluated lazily inside beforeAll.
// This ensures mocked dependencies are in place before ./index runs and binds to postgres/drizzle.
type ModuleExports = typeof import("./index");
type CreatePostgresConnection = ModuleExports["createPostgresConnection"];
type CreateRlsClient = ModuleExports["createRlsClient"];

interface PostgresCall {
  url: unknown;
  options: unknown;
  connection: unknown;
}

interface SqlStatement {
  kind: "sql";
  strings: Array<string>;
  values: Array<unknown>;
}

interface RawFragment {
  kind: "raw";
  value: unknown;
}

interface TransactionRecord {
  queries: Array<SqlStatement>;
}

function renderSql(statement: SqlStatement): string {
  return statement.strings.join("");
}

const postgresCalls: Array<PostgresCall> = [];
let connectionCounter = 0;

const transactionRecords: Array<TransactionRecord> = [];
const rawValues: Array<unknown> = [];

function sqlTag(
  strings: TemplateStringsArray,
  ...values: Array<unknown>
): SqlStatement {
  return {
    kind: "sql",
    strings: Array.from(strings),
    values,
  } satisfies SqlStatement;
}

sqlTag.raw = (value: unknown): RawFragment => {
  rawValues.push(value);
  return {
    kind: "raw",
    value,
  } satisfies RawFragment;
};

mock.module("postgres", () => ({
  default: (url: unknown, options?: unknown) => {
    connectionCounter += 1;
    const connection = {
      id: connectionCounter,
      url,
      options,
    };
    postgresCalls.push({ url, options, connection });
    return connection;
  },
}));

mock.module("drizzle-orm", () => ({
  sql: sqlTag,
}));

mock.module("drizzle-orm/postgres-js", () => ({
  drizzle: () => {
    return {
      transaction: async <T>(
        callback: (tx: {
          execute: (query: SqlStatement) => Promise<void>;
        }) => Promise<T>,
      ): Promise<T> => {
        const record: TransactionRecord = {
          queries: [],
        };

        const tx: { execute: (query: SqlStatement) => Promise<void> } = {
          execute: async (query: SqlStatement) => {
            record.queries.push(query);
          },
        };

        transactionRecords.push(record);
        return await callback(tx);
      },
    } satisfies {
      transaction: <T>(
        callback: (tx: {
          execute: (query: SqlStatement) => Promise<void>;
        }) => Promise<T>,
      ) => Promise<T>;
    };
  },
}));

let createPostgresConnection: CreatePostgresConnection;
let createRlsClient: CreateRlsClient;

beforeAll(async () => {
  process.env.POSTGRES_URL = "postgres://initial";
  const module = await import("./index");
  createPostgresConnection = module.createPostgresConnection;
  createRlsClient = module.createRlsClient;
});

beforeEach(() => {
  postgresCalls.splice(0, postgresCalls.length);
  transactionRecords.splice(0, transactionRecords.length);
  rawValues.splice(0, rawValues.length);
  process.env.POSTGRES_URL = "postgres://test";
  globalThis.__pgConn = undefined;
});

describe("createPostgresConnection", () => {
  test("reuses the cached connection", () => {
    const first = createPostgresConnection();
    const second = createPostgresConnection();

    expect(postgresCalls.length).toBe(1);
    expect(second).toBe(first);
  });

  test("creates a new connection when reuseConnection is false", () => {
    const initial = createPostgresConnection();
    const next = createPostgresConnection({ reuseConnection: false });

    expect(postgresCalls.length).toBe(2);
    expect(next).not.toBe(initial);
  });

  test("throws when no connection string can be resolved", () => {
    process.env.POSTGRES_URL = "";

    expect(() => {
      createPostgresConnection({ reuseConnection: false });
    }).toThrow("POSTGRES_URL is not set.");
  });

  test("honors an explicit connection string", () => {
    const explicit = "postgres://override";
    createPostgresConnection({ connectionString: explicit });

    expect(postgresCalls[0]?.url).toBe(explicit);
  });
});

describe("createRlsClient", () => {
  test("wraps RLS setup and teardown around the transaction", async () => {
    const token = {
      sub: "user-123",
      role: "role-with-hyphen",
      extra: "value",
    };

    const client = createRlsClient(token);
    const result = await client.rls(async () => "done");

    expect(result).toBe("done");
    expect(transactionRecords.length).toBe(1);

    const [record] = transactionRecords;
    expect(record.queries.length).toBe(2);

    const [setupQuery, teardownQuery] = record.queries;
    expect(setupQuery.values[0]).toBe(JSON.stringify(token));
    expect(setupQuery.values[1]).toBe(token.sub);
    expect(renderSql(setupQuery)).toContain("set_config('request.jwt.claims'");
    expect(renderSql(setupQuery)).toContain(
      "set_config('request.jwt.claim.sub'",
    );

    expect(renderSql(teardownQuery)).toContain(
      "set_config('request.jwt.claims', NULL",
    );
    expect(renderSql(teardownQuery)).toContain("reset role");
    expect(rawValues.at(-1)).toBe("anon");
  });

  test("preserves a valid role value", async () => {
    const token = {
      sub: "user-999",
      role: "editor",
    };

    const client = createRlsClient(token);
    await client.rls(async () => undefined);

    expect(rawValues.at(-1)).toBe("editor");
  });
});
