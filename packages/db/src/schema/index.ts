import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

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
        withCheck: sql`true`,
      }),
      pgPolicy("Users can delete their categories", {
        for: "delete",
        to: authenticatedRole,
        using: isOwner,
      }),
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
        withCheck: sql`true`,
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
