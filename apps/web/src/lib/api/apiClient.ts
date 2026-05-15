import { API_BASE_URL } from "./apiConfig";

export interface ApiErrorPayload {
  error?: string;
  issues?: string[];
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown
  ) {
    super(message);
  }
}

export async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
  const payload = (await response.json().catch(() => null)) as
    | ApiErrorPayload
    | TResponse
    | null;

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : `Request failed with status ${response.status}.`;
    const issueSuffix =
      payload && typeof payload === "object" && "issues" in payload && Array.isArray(payload.issues)
        ? ` ${payload.issues.join(" ")}`
        : "";

    throw new ApiRequestError(`${errorMessage}${issueSuffix}`.trim(), response.status, payload);
  }

  return payload as TResponse;
}

export async function sendJson<TResponse>(
  path: string,
  init?: Omit<RequestInit, "credentials">
): Promise<TResponse> {
  const headers = new Headers(init?.headers);

  if (init?.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers
  });

  return parseResponse<TResponse>(response);
}
