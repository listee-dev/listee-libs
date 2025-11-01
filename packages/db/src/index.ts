import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Options, type PostgresType, type Sql } from "postgres";

type DefaultTypeMap = Record<string, PostgresType>;

const GLOBAL_CACHE_PROPERTY = "__listeePgConnections" as const;

type GlobalWithPgCache = typeof globalThis & {
  [GLOBAL_CACHE_PROPERTY]?: Map<string, PostgresConnection>;
};

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

const localConnectionCache = new Map<string, PostgresConnection>();

function createCacheKey(
  connectionString: string,
  options?: CreateConnectionOptions,
): string {
  if (options?.postgresOptions === undefined) {
    return connectionString;
  }

  try {
    return `${connectionString}|${JSON.stringify(options.postgresOptions)}`;
  } catch {
    return `${connectionString}|${String(options.postgresOptions)}`;
  }
}

function getCachedConnection(key: string): PostgresConnection | undefined {
  const cachedLocally = localConnectionCache.get(key);
  if (cachedLocally !== undefined) {
    return cachedLocally;
  }

  if (typeof globalThis !== "undefined") {
    const cache = (globalThis as GlobalWithPgCache)[GLOBAL_CACHE_PROPERTY];
    return cache?.get(key);
  }

  return undefined;
}

function storeConnectionInCache(
  key: string,
  connection: PostgresConnection,
): void {
  localConnectionCache.set(key, connection);

  if (process.env.NODE_ENV === "production") {
    return;
  }

  if (typeof globalThis === "undefined") {
    return;
  }

  const globalObject = globalThis as GlobalWithPgCache;

  if (globalObject[GLOBAL_CACHE_PROPERTY] === undefined) {
    globalObject[GLOBAL_CACHE_PROPERTY] = new Map<string, PostgresConnection>();
  }

  globalObject[GLOBAL_CACHE_PROPERTY]?.set(key, connection);
}

export function createPostgresConnection(
  options?: CreateConnectionOptions,
): PostgresConnection {
  const connectionString = resolveConnectionString(options);
  const cacheKey = createCacheKey(connectionString, options);

  if (!shouldReuseConnection(options)) {
    return createNewConnection(connectionString, options);
  }

  const cached = getCachedConnection(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const connection = createNewConnection(connectionString, options);
  storeConnectionInCache(cacheKey, connection);

  return connection;
}

export type Database = PostgresJsDatabase<Record<string, unknown>>;

let cachedDatabase: Database | null = null;

export function getDb(): Database {
  if (cachedDatabase !== null) {
    return cachedDatabase;
  }

  const connection = createPostgresConnection();
  const database = drizzle(connection);
  cachedDatabase = database;
  return database;
}

function sanitizeRole(role: unknown): string {
  if (typeof role === "string" && /^[A-Za-z0-9_]+$/.test(role)) {
    return role;
  }

  return "anon";
}

// Supabase Auth JWT fields reference: https://supabase.com/docs/guides/auth/jwt-fields#typescriptjavascript
export type AuthenticatorAssuranceLevel = "aal1" | "aal2";

export type SupabaseToken = {
  iss: string;
  sub: string;
  aud: string | readonly string[];
  exp: number;
  iat: number;
  role: string;
  aal?: AuthenticatorAssuranceLevel;
  session_id?: string;
  email?: string;
  phone?: string;
  is_anonymous?: boolean;
  jti?: string;
  nbf?: number;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  amr?: readonly {
    readonly method: string;
    readonly timestamp: number;
  }[];
  ref?: string;
} & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) => typeof item === "string");
}

function isSupabaseToken(value: unknown): value is SupabaseToken {
  if (!isRecord(value)) {
    return false;
  }

  if (
    "iss" in value &&
    value.iss !== undefined &&
    typeof value.iss !== "string"
  ) {
    return false;
  }

  if (
    "sub" in value &&
    value.sub !== undefined &&
    typeof value.sub !== "string"
  ) {
    return false;
  }

  if ("aud" in value && value.aud !== undefined) {
    const audience = value.aud;
    if (typeof audience !== "string" && !isStringArray(audience)) {
      return false;
    }
  }

  if (
    "exp" in value &&
    value.exp !== undefined &&
    typeof value.exp !== "number"
  ) {
    return false;
  }

  if (
    "nbf" in value &&
    value.nbf !== undefined &&
    typeof value.nbf !== "number"
  ) {
    return false;
  }

  if (
    "iat" in value &&
    value.iat !== undefined &&
    typeof value.iat !== "number"
  ) {
    return false;
  }

  if (
    "jti" in value &&
    value.jti !== undefined &&
    typeof value.jti !== "string"
  ) {
    return false;
  }

  if (
    "role" in value &&
    value.role !== undefined &&
    typeof value.role !== "string"
  ) {
    return false;
  }

  return true;
}

function readStringProperty(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const candidate = value[key];
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }

  return null;
}

function formatDatabaseErrorDetails(error: unknown): string | null {
  if (!isRecord(error)) {
    return null;
  }

  const detailParts: Array<string> = [];

  const code = readStringProperty(error, "code");
  if (code !== null) {
    detailParts.push(`code: ${code}`);
  }

  const detail = readStringProperty(error, "detail");
  if (detail !== null) {
    detailParts.push(`detail: ${detail}`);
  }

  const hint = readStringProperty(error, "hint");
  if (hint !== null) {
    detailParts.push(`hint: ${hint}`);
  }

  const schema = readStringProperty(error, "schema");
  if (schema !== null) {
    detailParts.push(`schema: ${schema}`);
  }

  const table = readStringProperty(error, "table");
  if (table !== null) {
    detailParts.push(`table: ${table}`);
  }

  const column = readStringProperty(error, "column");
  if (column !== null) {
    detailParts.push(`column: ${column}`);
  }

  const constraint = readStringProperty(error, "constraint");
  if (constraint !== null) {
    detailParts.push(`constraint: ${constraint}`);
  }

  if (detailParts.length === 0) {
    return null;
  }

  return detailParts.join(", ");
}

function extractErrorMessage(value: unknown): string | null {
  if (value instanceof Error) {
    return value.message;
  }

  if (isRecord(value)) {
    const direct = readStringProperty(value, "message");
    if (direct !== null) {
      return direct;
    }
  }

  return null;
}

function extractCombinedErrorDetails(error: unknown): {
  readonly message: string;
  readonly details: string | null;
} {
  const visited = new Set<unknown>();
  const messages: Array<string> = [];
  const detailCandidates: Array<string> = [];

  const stack: Array<unknown> = [error];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || current === null) {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const message = extractErrorMessage(current);
    if (message !== null && !messages.includes(message)) {
      messages.push(message);
    }

    const details = formatDatabaseErrorDetails(current);
    if (details !== null) {
      detailCandidates.push(details);
    }

    if (current instanceof Error && current.cause !== undefined) {
      stack.push(current.cause);
    } else if (isRecord(current) && "cause" in current) {
      stack.push(current.cause);
    }
  }

  const baseMessage =
    messages.length > 0 ? messages.join(" | ") : String(error);
  const combinedDetails =
    detailCandidates.length > 0
      ? Array.from(new Set(detailCandidates)).join(" | ")
      : null;

  return {
    message: baseMessage,
    details: combinedDetails,
  };
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;

  const padded =
    padding === 0 ? normalized : `${normalized}${"=".repeat(4 - padding)}`;

  const buffer = Buffer.from(padded, "base64");
  return buffer.toString("utf8");
}

function extractJwtPayload(accessToken: string): unknown {
  const trimmed = accessToken.trim();
  if (trimmed.length === 0) {
    throw new Error("Supabase access token must not be empty");
  }

  const segments = trimmed.split(".");
  if (segments.length < 2) {
    throw new Error("Supabase access token must be a JWT");
  }

  const payloadSegment = segments[1];

  try {
    const decoded = decodeBase64Url(payloadSegment);
    return JSON.parse(decoded);
  } catch {
    throw new Error("Supabase access token payload is invalid");
  }
}

export function parseSupabaseAccessToken(accessToken: string): SupabaseToken {
  const payload = extractJwtPayload(accessToken);
  if (!isSupabaseToken(payload)) {
    throw new Error("Supabase access token claims are invalid");
  }

  return payload;
}

function resolveSupabaseToken(token: SupabaseToken | string): SupabaseToken {
  if (isSupabaseToken(token)) {
    return token;
  }

  return parseSupabaseAccessToken(token);
}

function isRolePermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const lowerMessage = error.message.toLowerCase();

  if (
    lowerMessage.includes("permission denied to set role") ||
    lowerMessage.includes("must be member of role") ||
    lowerMessage.includes("must be superuser")
  ) {
    return true;
  }

  if (isRecord(error)) {
    const codeValue = readStringProperty(error, "code");
    if (
      codeValue === "42501" ||
      codeValue === "0A000" ||
      codeValue === "28000"
    ) {
      return true;
    }
  }

  return false;
}

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
  token: SupabaseToken | string,
  options?: CreateRlsClientOptions,
): RlsClient {
  const database = options?.database ?? getDb();
  const claims = resolveSupabaseToken(token);
  const sanitizedRole = sanitizeRole(claims.role);
  const serializedToken = JSON.stringify(claims);
  const subject = typeof claims.sub === "string" ? claims.sub : "";

  async function rls<T>(
    transaction: (tx: RlsTransaction) => Promise<T>,
  ): Promise<T> {
    return database.transaction(async (tx) => {
      const cleanupTasks: Array<() => Promise<void>> = [];

      await tx.execute(sql`
        select set_config('request.jwt.claims', ${serializedToken}, TRUE);
      `);
      cleanupTasks.push(async () => {
        await tx.execute(sql`
          select set_config('request.jwt.claims', NULL, TRUE);
        `);
      });

      await tx.execute(sql`
        select set_config('request.jwt.claim.sub', ${subject}, TRUE);
      `);
      cleanupTasks.push(async () => {
        await tx.execute(sql`
          select set_config('request.jwt.claim.sub', NULL, TRUE);
        `);
      });

      const roleSetting = sanitizedRole;

      await tx.execute(sql`
        select set_config('request.jwt.claim.role', ${roleSetting}, TRUE);
      `);
      cleanupTasks.push(async () => {
        await tx.execute(sql`
          select set_config('request.jwt.claim.role', NULL, TRUE);
        `);
      });

      const applyRole = async (): Promise<void> => {
        await tx.execute(sql`
          set local role ${sql.raw(sanitizedRole)};
        `);
        cleanupTasks.push(async () => {
          await tx.execute(sql`
            reset role;
          `);
        });
      };

      try {
        await applyRole();
      } catch (error) {
        if (isRolePermissionError(error)) {
          const message = `Failed to set local role "${sanitizedRole}". Grant the database user membership in that role so Supabase RLS policies can run.`;
          if (error instanceof Error) {
            throw new Error(message, { cause: error });
          }
          throw new Error(message);
        }
        throw error;
      }

      const runCleanup = async (propagateErrors: boolean): Promise<void> => {
        const cleanupErrors: Array<unknown> = [];
        for (const cleanupTask of [...cleanupTasks].reverse()) {
          try {
            await cleanupTask();
          } catch (cleanupError) {
            if (propagateErrors) {
              cleanupErrors.push(cleanupError);
            }
          }
        }

        if (propagateErrors && cleanupErrors.length > 0) {
          const [firstError] = cleanupErrors;
          if (firstError instanceof Error) {
            throw firstError;
          }
          throw new Error("Failed to clean up RLS context");
        }
      };

      try {
        const result = await transaction(tx);
        await runCleanup(true);
        return result;
      } catch (error) {
        await runCleanup(false);
        const { message: baseMessage, details } =
          extractCombinedErrorDetails(error);
        const combinedMessage =
          details === null ? baseMessage : `${baseMessage} (${details})`;
        throw new Error(`RLS transaction failed: ${combinedMessage}`, {
          cause: error instanceof Error ? error : undefined,
        });
      }
    });
  }

  return { rls };
}

export function createDrizzle(
  token: SupabaseToken | string,
  options?: CreateRlsClientOptions,
): RlsClient {
  return createRlsClient(token, options);
}

export { and, desc, eq, lt, or, sql } from "drizzle-orm";
export * from "./constants/category.js";
export * from "./schema/index.js";

function resolveSchemaPath(): string {
  try {
    const schemaUrl = new URL("./schema/index.js", import.meta.url);
    if (schemaUrl.protocol === "file:") {
      return fileURLToPath(schemaUrl);
    }
    return schemaUrl.pathname;
  } catch {
    return "./schema/index.js";
  }
}

export const schemaPath = resolveSchemaPath();
