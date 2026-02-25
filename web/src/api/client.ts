export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body ?? null;
  }
}

export interface ApiClient {
  get<TResponse>(path: string): Promise<TResponse>;
  post<TResponse, TBody = unknown>(path: string, body: TBody): Promise<TResponse>;
  patch<TResponse, TBody = unknown>(path: string, body: TBody): Promise<TResponse>;
  delete<TResponse = void>(path: string): Promise<TResponse>;
}

interface CreateApiClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string>;
  onUnauthorized: () => void | Promise<void>;
}

function parseResponsePayload(text: string): unknown {
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null) {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  return fallback;
}

export function getApiErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function withLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function createApiClient({ baseUrl, getAccessToken, onUnauthorized }: CreateApiClientOptions): ApiClient {
  const trimmedBaseUrl = baseUrl.replace(/\/$/, "");

  if (!trimmedBaseUrl) {
    throw new Error("Missing VITE_API_URL. Please set API base URL in environment.");
  }

  async function request<TResponse, TBody = unknown>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: TBody,
  ): Promise<TResponse> {
    let token: string;

    try {
      token = await getAccessToken();
    } catch (error) {
      console.error("[auth] getAccessTokenSilently failed", error);
      throw new ApiError(0, "Failed to obtain access token");
    }

    const url = `${trimmedBaseUrl}${withLeadingSlash(path)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const requestBody = body === undefined ? undefined : JSON.stringify(body);

    if (requestBody !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: requestBody,
    });

    const text = await response.text();
    const payload = parseResponsePayload(text);

    console.info(`[api] ${method} ${url} -> ${response.status}`);

    if (response.status === 401) {
      console.warn("[api] unauthorized response, signaling session expired", {
        url,
        status: response.status,
        body: payload,
      });
      await onUnauthorized();
      throw new ApiError(401, "Unauthorized", payload);
    }

    if (!response.ok) {
      console.error("[api] request failed", {
        url,
        status: response.status,
        body: payload,
      });

      throw new ApiError(response.status, getErrorMessage(payload, `Request failed (${response.status})`), payload);
    }

    return payload as TResponse;
  }

  return {
    get: <TResponse>(path: string) => request<TResponse>("GET", path),
    post: <TResponse, TBody = unknown>(path: string, body: TBody) => request<TResponse, TBody>("POST", path, body),
    patch: <TResponse, TBody = unknown>(path: string, body: TBody) => request<TResponse, TBody>("PATCH", path, body),
    delete: <TResponse = void>(path: string) => request<TResponse>("DELETE", path),
  };
}
