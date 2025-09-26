import type { Database } from "@listee/db";
import { sql } from "@listee/db";
import type { DatabaseHealthChecker } from "@listee/types";
import { toErrorMessage } from "../utils/error";

export function createDatabaseHealthChecker(
  db: Database,
): DatabaseHealthChecker {
  return async () => {
    try {
      await db.execute(sql`select 1`);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: toErrorMessage(error),
      };
    }
  };
}
