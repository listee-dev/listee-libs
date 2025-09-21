import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Options, type PostgresType, type Sql } from "postgres";

type DefaultTypeMap = Record<string, PostgresType>;

export type PostgresConnection = Sql<DefaultTypeMap>;

export interface CreateConnectionOptions {
  connectionString?: string;
  postgresOptions?: Options<DefaultTypeMap>;
  reuseConnection?: boolean;
}

function resolveConnectionString(options?: CreateConnectionOptions): string {
  if (options?.connectionString && options.connectionString.length > 0) {
    return options.connectionString;
  }

  const envValue = process.env.POSTGRES_URL;
  if (envValue && envValue.length > 0) {
    return envValue;
  }

  throw new Error("POSTGRES_URL is not set.");
}

function shouldReuseConnection(options?: CreateConnectionOptions): boolean {
  if (options?.reuseConnection !== undefined) {
    return options.reuseConnection;
  }

  return true;
}

function createNewConnection(
  connectionString: string,
  options?: CreateConnectionOptions,
): PostgresConnection {
  const baseOptions: Options<DefaultTypeMap> = {
    prepare: false,
    ...(options?.postgresOptions ?? {}),
  };

  return postgres(connectionString, baseOptions);
}

export function createPostgresConnection(
  options?: CreateConnectionOptions,
): PostgresConnection {
  const connectionString = resolveConnectionString(options);

  if (!shouldReuseConnection(options)) {
    return createNewConnection(connectionString, options);
  }

  if (typeof globalThis !== "undefined") {
    const cached = globalThis.__pgConn;
    if (cached) {
      return cached;
    }

    const connection = createNewConnection(connectionString, options);

    if (process.env.NODE_ENV !== "production") {
      globalThis.__pgConn = connection;
    }

    return connection;
  }

  return createNewConnection(connectionString, options);
}

export type Database = PostgresJsDatabase<Record<string, unknown>>;

const defaultConnection = createPostgresConnection();
export const db: Database = drizzle(defaultConnection);

function sanitizeRole(role: unknown): string {
  if (typeof role === "string" && /^[A-Za-z0-9_]+$/.test(role)) {
    return role;
  }

  return "anon";
}

export type SupabaseToken = {
  iss?: string;
  sub?: string;
  aud?: string | Array<string>;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  role?: string;
} & Record<string, unknown>;

export type RlsTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export interface CreateRlsClientOptions {
  database?: Database;
}

export interface RlsClient {
  rls<T>(transaction: (tx: RlsTransaction) => Promise<T>): Promise<T>;
}

export function createRlsClient(
  token: SupabaseToken,
  options?: CreateRlsClientOptions,
): RlsClient {
  const database = options?.database ?? db;
  const sanitizedRole = sanitizeRole(token.role);
  const serializedToken = JSON.stringify(token);
  const subject = typeof token.sub === "string" ? token.sub : "";

  async function rls<T>(
    transaction: (tx: RlsTransaction) => Promise<T>,
  ): Promise<T> {
    return database.transaction(async (tx) => {
      try {
        await tx.execute(sql`
          select set_config('request.jwt.claims', ${serializedToken}, TRUE);
          select set_config('request.jwt.claim.sub', ${subject}, TRUE);
          set local role ${sql.raw(sanitizedRole)};
        `);

        return await transaction(tx);
      } finally {
        await tx.execute(sql`
          select set_config('request.jwt.claims', NULL, TRUE);
          select set_config('request.jwt.claim.sub', NULL, TRUE);
          reset role;
        `);
      }
    });
  }

  return { rls };
}

export function createDrizzle(
  token: SupabaseToken,
  options?: CreateRlsClientOptions,
): RlsClient {
  return createRlsClient(token, options);
}
