import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

// Import only the type information so the actual module code is evaluated lazily inside beforeAll.
// This ensures mocked dependencies are in place before ./index runs and binds to postgres/drizzle.
type ModuleExports = typeof import("./index");
type CreatePostgresConnection = ModuleExports["createPostgresConnection"];
type CreateRlsClient = ModuleExports["createRlsClient"];
type ParseSupabaseAccessToken = ModuleExports["parseSupabaseAccessToken"];

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

type ExecuteInterceptor = (query: SqlStatement) => Promise<void>;

class PostgresPermissionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

function renderSql(statement: SqlStatement): string {
  return statement.strings.join("");
}

const postgresCalls: Array<PostgresCall> = [];
let connectionCounter = 0;

const transactionRecords: Array<TransactionRecord> = [];
const rawValues: Array<unknown> = [];
let connectionNamespace = 0;
let executeInterceptor: ExecuteInterceptor | null = null;

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
  eq: (...values: Array<unknown>) => ({
    kind: "predicate",
    operator: "eq",
    values,
  }),
  and: (...values: Array<unknown>) => ({
    kind: "predicate",
    operator: "and",
    values,
  }),
  or: (...values: Array<unknown>) => ({
    kind: "predicate",
    operator: "or",
    values,
  }),
  lt: (...values: Array<unknown>) => ({
    kind: "predicate",
    operator: "lt",
    values,
  }),
  desc: (value: unknown) => ({
    kind: "order",
    direction: "desc",
    value,
  }),
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
            if (executeInterceptor !== null) {
              await executeInterceptor(query);
            }
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

function setExecuteInterceptor(handler: ExecuteInterceptor | null): void {
  executeInterceptor = handler;
}

let createPostgresConnection: CreatePostgresConnection;
let createRlsClient: CreateRlsClient;
let parseSupabaseAccessToken: ParseSupabaseAccessToken;

beforeAll(async () => {
  process.env.POSTGRES_URL = "postgres://initial";
  const module = await import("./index");
  createPostgresConnection = module.createPostgresConnection;
  createRlsClient = module.createRlsClient;
  parseSupabaseAccessToken = module.parseSupabaseAccessToken;
});

beforeEach(() => {
  postgresCalls.splice(0, postgresCalls.length);
  transactionRecords.splice(0, transactionRecords.length);
  rawValues.splice(0, rawValues.length);
  connectionNamespace += 1;
  process.env.POSTGRES_URL = `postgres://test-${connectionNamespace}`;
  setExecuteInterceptor(null);
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

  test("creates distinct cached connections per configuration", () => {
    const first = createPostgresConnection({
      connectionString: `postgres://one-${connectionNamespace}`,
    });
    const second = createPostgresConnection({
      connectionString: `postgres://two-${connectionNamespace}`,
    });

    expect(postgresCalls.length).toBe(2);
    expect(second).not.toBe(first);
  });

  test("throws when no connection string can be resolved", () => {
    process.env.POSTGRES_URL = "";

    expect(() => {
      createPostgresConnection({ reuseConnection: false });
    }).toThrow("POSTGRES_URL is not set.");
  });

  test("honors an explicit connection string", () => {
    const explicit = `postgres://override-${connectionNamespace}`;
    createPostgresConnection({ connectionString: explicit });

    expect(postgresCalls[0]?.url).toBe(explicit);
  });
});

describe("createRlsClient", () => {
  const BASE_CLAIMS = {
    iss: "https://example.supabase.co/auth/v1",
    aud: "authenticated" as const,
    exp: 1_700_000_000,
    iat: 1_700_000_000,
    role: "authenticated" as const,
  } satisfies Record<string, unknown>;

  function encodeSegment(value: Record<string, unknown>): string {
    const json = JSON.stringify(value);
    return Buffer.from(json)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/u, "");
  }

  function createAccessToken(payload: Record<string, unknown>): string {
    const header = encodeSegment({ alg: "none", typ: "JWT" });
    const body = encodeSegment({ ...BASE_CLAIMS, ...payload });
    return `${header}.${body}.`;
  }

  test("wraps RLS setup and teardown around the transaction", async () => {
    const token = {
      ...BASE_CLAIMS,
      sub: "user-123",
      role: "role-with-hyphen",
      extra: "value",
    };

    const client = createRlsClient(token);
    const result = await client.rls(async () => "done");

    expect(result).toBe("done");
    expect(transactionRecords.length).toBe(1);

    const [record] = transactionRecords;
    expect(record.queries.length).toBe(8);

    const [
      setClaims,
      setSubject,
      setRoleClaim,
      setRole,
      resetRole,
      clearRoleClaim,
      clearSubject,
      clearClaims,
    ] = record.queries;

    expect(setClaims.values[0]).toBe(JSON.stringify(token));
    expect(renderSql(setClaims)).toContain("set_config('request.jwt.claims'");

    expect(setSubject.values[0]).toBe(token.sub);
    expect(renderSql(setSubject)).toContain(
      "set_config('request.jwt.claim.sub'",
    );

    expect(setRoleClaim.values[0]).toBe("anon");
    expect(renderSql(setRoleClaim)).toContain(
      "set_config('request.jwt.claim.role'",
    );

    expect(renderSql(setRole)).toContain("set local role");
    expect(rawValues.at(-1)).toBe("anon");

    expect(renderSql(resetRole)).toContain("reset role");
    expect(renderSql(clearRoleClaim)).toContain(
      "set_config('request.jwt.claim.role', NULL",
    );
    expect(renderSql(clearSubject)).toContain(
      "set_config('request.jwt.claim.sub', NULL",
    );
    expect(renderSql(clearClaims)).toContain(
      "set_config('request.jwt.claims', NULL",
    );
  });

  test("preserves a valid role value", async () => {
    const token = {
      ...BASE_CLAIMS,
      sub: "user-999",
      role: "editor",
    };

    const client = createRlsClient(token);
    await client.rls(async () => undefined);

    expect(rawValues.at(-1)).toBe("editor");
  });

  test("throws a descriptive error when local role cannot be set", async () => {
    setExecuteInterceptor(async (statement) => {
      const sqlText = renderSql(statement);
      if (sqlText.includes("set local role")) {
        throw new PostgresPermissionError(
          'permission denied to set role "authenticated"',
          "42501",
        );
      }
    });

    const token = {
      ...BASE_CLAIMS,
      sub: "user-222",
      role: "authenticated",
    };

    const client = createRlsClient(token);
    await expect(client.rls(async () => "ok")).rejects.toThrow(
      'Failed to set local role "authenticated"',
    );
  });

  test("accepts a Supabase access token string", async () => {
    const payload = {
      sub: "user-456",
      role: "authenticated",
    };
    const accessToken = createAccessToken(payload);

    const client = createRlsClient(accessToken);
    await client.rls(async () => undefined);

    expect(rawValues.at(-1)).toBe("authenticated");
  });

  test("parses access token payloads", () => {
    const payload = {
      sub: "user-789",
      role: "authenticated",
      aud: ["audience"],
    };
    const accessToken = createAccessToken(payload);
    const parsed = parseSupabaseAccessToken(accessToken);

    expect(parsed.sub).toBe(payload.sub);
    expect(parsed.role).toBe(payload.role);
    expect(parsed.aud).toEqual(payload.aud);
  });
});
