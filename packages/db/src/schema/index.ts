import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { DEFAULT_CATEGORY_KIND } from "../constants/category.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    defaultCategoryId: uuid("default_category_id"),
    ...timestamps,
  },
  (table) => {
    const isOwner = sql`${table.id} = (select auth.uid())`;

    return [
      index("idx_profiles_default_category_id").on(table.defaultCategoryId),
      pgPolicy("Users can view their profile", {
        for: "select",
        to: authenticatedRole,
        using: isOwner,
      }),
      pgPolicy("Users can insert their profile", {
        for: "insert",
        to: authenticatedRole,
        withCheck: isOwner,
      }),
      pgPolicy("Users can update their profile", {
        for: "update",
        to: authenticatedRole,
        using: isOwner,
        withCheck: isOwner,
      }),
    ];
  },
);

export type Profile = typeof profiles.$inferSelect;

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references((): AnyPgColumn => profiles.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references((): AnyPgColumn => profiles.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => {
    const isOwner = sql`${table.createdBy} = (select auth.uid())`;

    return [
      index("idx_categories_created_by").on(table.createdBy),
      index("idx_categories_updated_by").on(table.updatedBy),
      pgPolicy("Users can view their categories", {
        for: "select",
        to: authenticatedRole,
        using: isOwner,
      }),
      pgPolicy("Users can insert categories", {
        for: "insert",
        to: authenticatedRole,
        withCheck: isOwner,
      }),
      pgPolicy("Users can update their categories", {
        for: "update",
        to: authenticatedRole,
        using: isOwner,
        withCheck: isOwner,
      }),
      pgPolicy("Users can delete their categories", {
        for: "delete",
        to: authenticatedRole,
        using: isOwner,
      }),
      uniqueIndex("categories_system_name_idx")
        .on(table.createdBy, table.name)
        // drizzle-kit stringifies template parameters as placeholders, so use sql.raw
        // to inject the literal value without producing $1 in the generated migration.
        .where(sql`${table.kind} = ${sql.raw(`'${DEFAULT_CATEGORY_KIND}'`)}`),
    ];
  },
);

export type Category = typeof categories.$inferSelect;

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    isChecked: boolean("is_checked").notNull().default(false),
    categoryId: uuid("category_id")
      .notNull()
      .references((): AnyPgColumn => categories.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references((): AnyPgColumn => profiles.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references((): AnyPgColumn => profiles.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => {
    const hasAccess = sql`
      ${table.createdBy} = (select auth.uid())
      OR EXISTS (
        SELECT 1
        FROM ${categories}
        WHERE ${categories.id} = ${table.categoryId}
        AND ${categories.createdBy} = (select auth.uid())
      )
    `;

    return [
      index("idx_tasks_category_id").on(table.categoryId),
      index("idx_tasks_created_by").on(table.createdBy),
      index("idx_tasks_updated_by").on(table.updatedBy),
      pgPolicy("Users can view their tasks", {
        for: "select",
        to: authenticatedRole,
        using: hasAccess,
      }),
      pgPolicy("Users can insert tasks in their categories", {
        for: "insert",
        to: authenticatedRole,
        withCheck: hasAccess,
      }),
      pgPolicy("Users can update their tasks", {
        for: "update",
        to: authenticatedRole,
        using: hasAccess,
        withCheck: hasAccess,
      }),
      pgPolicy("Users can delete their tasks", {
        for: "delete",
        to: authenticatedRole,
        using: hasAccess,
      }),
    ];
  },
);

export type Task = typeof tasks.$inferSelect;
