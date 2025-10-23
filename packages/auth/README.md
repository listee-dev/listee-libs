# @listee/auth

Authentication and provisioning helpers for Listee services. This package ships reusable providers that validate requests (e.g., Supabase JWTs) and optional hooks for post-auth account provisioning.

## Installation

```bash
npm install @listee/auth
```

## Features

- Header-based development authentication with `createHeaderAuthentication`
- Production-ready Supabase verifier via `createSupabaseAuthentication`
- Account provisioning wrapper `createProvisioningSupabaseAuthentication`
- Strongly typed `AuthenticatedUser` and `AuthenticationContext` exports

## Quick start

```ts
import { createSupabaseAuthentication } from "@listee/auth";

const authenticate = createSupabaseAuthentication({
  jwksUrl: new URL("https://<project>.supabase.co/auth/v1/.well-known/jwks.json"),
  expectedAudience: "authenticated",
});

const result = await authenticate({ request, requiredRole: "authenticated" });
if (result.type === "success") {
  const user = result.user;
  // continue with request handling
}
```

See `src/authentication/` for additional adapters and tests demonstrating error handling scenarios.

## Development

- Build: `bun run build`
- Tests: `bun test`
- Lint: `bun run lint`

## License

MIT
