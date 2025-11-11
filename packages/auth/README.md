# @listee/auth

Authentication and provisioning helpers for Listee services. This package ships reusable providers that validate requests (e.g., Supabase JWTs) and optional hooks for post-auth account provisioning.

## Installation

```bash
npm install @listee/auth
```

## Features

- Supabase Auth REST client via `createSupabaseAuthClient`
- Supabase JWT verification via `createSupabaseAuthentication`
- Account provisioning wrapper `createProvisioningSupabaseAuthentication`
- Strongly typed `AuthenticatedUser` and `AuthenticationContext` exports

## Quick start

### Verify Supabase JWTs

```ts
import { createSupabaseAuthentication } from "@listee/auth";

const authentication = createSupabaseAuthentication({
  projectUrl: "https://<project>.supabase.co",
  audience: "authenticated",
  requiredRole: "authenticated",
});

const result = await authentication.authenticate({ request });
const user = result.user;
// Continue handling the request with user.id and user.token
```

### Call Supabase Auth REST endpoints

```ts
import { createSupabaseAuthClient } from "@listee/auth";

const auth = createSupabaseAuthClient({
  projectUrl: "https://<project>.supabase.co",
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY!,
});

await auth.signup({ email: "user@example.com", password: "secret" });
const tokens = await auth.login({ email: "user@example.com", password: "secret" });
const refreshed = await auth.refresh({ refreshToken: tokens.refreshToken });
```

See `src/authentication/` and `src/supabase/` for additional adapters and tests demonstrating error handling scenarios.

## Development

- Build: `bun run build`
- Tests: `bun test`
- Lint: `bun run lint`

## License

MIT
