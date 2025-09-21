import type { PostgresType, Sql } from "postgres";

type DefaultTypeMap = Record<string, PostgresType>;

declare global {
  /**
   * Cache a Postgres connection during development to avoid reconnecting on HMR.
   */
  var __pgConn: Sql<DefaultTypeMap> | undefined;
}
