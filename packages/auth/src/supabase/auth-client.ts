import { SupabaseAuthError } from "./errors.js";

export type SupabaseAuthClientOptions = {
  readonly projectUrl: string;
  readonly publishableKey: string;
  readonly fetch?: typeof fetch;
};

export type SupabaseTokenPayload = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: string;
  readonly expiresIn: number;
};

export type SupabaseAuthClient = {
  signup(params: {
    readonly email: string;
    readonly password: string;
    readonly redirectUrl?: string;
  }): Promise<void>;
  login(params: {
    readonly email: string;
    readonly password: string;
  }): Promise<SupabaseTokenPayload>;
  refresh(params: {
    readonly refreshToken: string;
  }): Promise<SupabaseTokenPayload>;
};

type SupabaseRestToken = {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: string;
  readonly expires_in: number;
};

type RequestBody = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isSupabaseRestToken = (value: unknown): value is SupabaseRestToken => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.access_token === "string" &&
    typeof value.refresh_token === "string" &&
    typeof value.token_type === "string" &&
    typeof value.expires_in === "number" &&
    Number.isFinite(value.expires_in)
  );
};

const toTokenPayload = (token: SupabaseRestToken): SupabaseTokenPayload => {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: token.token_type,
    expiresIn: token.expires_in,
  };
};

const normalizeProjectUrl = (value: string): URL => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Supabase project URL must not be empty.");
  }

  try {
    return new URL(trimmed);
  } catch {
    throw new Error("Supabase project URL must be a valid absolute URL.");
  }
};

const normalizePublishableKey = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Supabase publishable key must not be empty.");
  }
  return trimmed;
};

const formatSupabaseError = (payload: unknown, fallback: string): string => {
  if (isRecord(payload)) {
    const candidates = [
      payload.error,
      payload.error_description,
      payload.message,
      payload.msg,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return fallback;
};

const readJsonPayload = async (response: Response): Promise<unknown | null> => {
  const text = await response.text();
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const details = error instanceof Error ? error.message : "unknown error";
    throw new SupabaseAuthError(
      response.status || 500,
      `Failed to parse Supabase response: ${details}`,
    );
  }
};

export const createSupabaseAuthClient = (
  options: SupabaseAuthClientOptions,
): SupabaseAuthClient => {
  const projectUrl = normalizeProjectUrl(options.projectUrl);
  const publishableKey = normalizePublishableKey(options.publishableKey);
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (fetchImpl === undefined) {
    throw new Error(
      "Fetch API is not available in this environment. Provide a custom fetch implementation.",
    );
  }

  const requestSupabase = async (
    path: string,
    body: RequestBody,
  ): Promise<unknown | null> => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(normalizedPath, projectUrl);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? `Supabase request failed: ${error.message}`
          : "Supabase request failed due to an unknown error.";
      throw new SupabaseAuthError(500, message);
    }

    const payload = await readJsonPayload(response);
    if (!response.ok) {
      const message = formatSupabaseError(
        payload,
        `Supabase request failed with status ${response.status}`,
      );
      throw new SupabaseAuthError(response.status, message);
    }

    return payload;
  };

  const extractTokenResponse = (payload: unknown | null): SupabaseRestToken => {
    if (isSupabaseRestToken(payload)) {
      return payload;
    }

    if (isRecord(payload) && isSupabaseRestToken(payload.data)) {
      return payload.data;
    }

    throw new SupabaseAuthError(
      502,
      "Supabase response did not include token details.",
    );
  };

  return {
    async signup(params) {
      const redirectSuffix =
        params.redirectUrl === undefined
          ? ""
          : `?redirect_to=${encodeURIComponent(params.redirectUrl)}`;
      await requestSupabase(`/auth/v1/signup${redirectSuffix}`, {
        email: params.email,
        password: params.password,
      });
    },

    async login(params) {
      const payload = await requestSupabase(
        "/auth/v1/token?grant_type=password",
        {
          email: params.email,
          password: params.password,
        },
      );

      return toTokenPayload(extractTokenResponse(payload));
    },

    async refresh(params) {
      const payload = await requestSupabase(
        "/auth/v1/token?grant_type=refresh_token",
        {
          refresh_token: params.refreshToken,
        },
      );

      return toTokenPayload(extractTokenResponse(payload));
    },
  } satisfies SupabaseAuthClient;
};
