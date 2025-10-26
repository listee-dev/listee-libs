import type {
  Database,
  RlsClient,
  RlsTransaction,
  SupabaseToken,
} from "@listee/db";
import {
  and,
  categories,
  createRlsClient,
  DEFAULT_CATEGORY_KIND,
  DEFAULT_CATEGORY_NAME,
  eq,
  profiles,
} from "@listee/db";

export interface ProvisionAccountParams {
  readonly userId: string;
  readonly token: SupabaseToken | string;
  readonly email?: string | null;
}

export interface AccountProvisioner {
  provision(params: ProvisionAccountParams): Promise<void>;
}

export interface AccountProvisionerDependencies {
  readonly database?: Database;
  readonly createRlsClient?: (token: SupabaseToken | string) => RlsClient;
  readonly defaultCategoryName?: string;
  readonly defaultCategoryKind?: string;
}

function resolveEmail(
  email: string | null | undefined,
  userId: string,
): string {
  if (typeof email === "string") {
    const trimmed = email.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  // Some Supabase-issued tokens (e.g. service_role, custom tokens, or providers
  // without email claims) omit the email field. We still need a non-null value
  // to satisfy the profiles.email constraint, so we fall back to a placeholder
  // that is stable per user ID.
  return `${userId}@placeholder.invalid`;
}

function resolveCreateRlsClient(
  dependencies: AccountProvisionerDependencies,
): (token: SupabaseToken | string) => RlsClient {
  if (dependencies.createRlsClient !== undefined) {
    return dependencies.createRlsClient;
  }

  return (token: SupabaseToken | string) =>
    createRlsClient(token, { database: dependencies.database });
}

export function createAccountProvisioner(
  dependencies: AccountProvisionerDependencies = {},
): AccountProvisioner {
  const createClient = resolveCreateRlsClient(dependencies);
  const defaultCategoryName =
    dependencies.defaultCategoryName ?? DEFAULT_CATEGORY_NAME;
  const defaultCategoryKind =
    dependencies.defaultCategoryKind ?? DEFAULT_CATEGORY_KIND;

  async function provision(params: ProvisionAccountParams): Promise<void> {
    const client = createClient(params.token);
    const email = resolveEmail(params.email ?? null, params.userId);

    await client.rls(async (tx: RlsTransaction) => {
      await tx
        .insert(profiles)
        .values({
          id: params.userId,
          email,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: {
            email,
          },
        });

      const insertedCategories = await tx
        .insert(categories)
        .values({
          name: defaultCategoryName,
          kind: defaultCategoryKind,
          createdBy: params.userId,
          updatedBy: params.userId,
        })
        .onConflictDoNothing({
          target: [categories.createdBy, categories.name],
          where: eq(categories.kind, defaultCategoryKind),
        })
        .returning({ categoryId: categories.id });

      const categoryRecord =
        insertedCategories[0] ??
        (
          await tx
            .select({ categoryId: categories.id })
            .from(categories)
            .where(
              and(
                eq(categories.createdBy, params.userId),
                eq(categories.name, defaultCategoryName),
                eq(categories.kind, defaultCategoryKind),
              ),
            )
            .limit(1)
        )[0];

      if (categoryRecord === undefined) {
        throw new Error("Failed to resolve default category for profile");
      }

      const defaultCategoryId = categoryRecord.categoryId;

      const shouldUpdateProfile = await tx
        .update(profiles)
        .set({
          defaultCategoryId,
          email,
        })
        .where(eq(profiles.id, params.userId))
        .returning({ id: profiles.id });

      if (shouldUpdateProfile.length === 0) {
        throw new Error("Failed to update profile with default category");
      }
    });
  }

  return { provision };
}
