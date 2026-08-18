import { API_BASE_URL } from "./apiConfig";
import {
  combatPerformanceNow,
  recordCombatPerformanceRequestEnd,
  recordCombatPerformanceRequestStart,
} from "../performance/combatPerformance";

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
  const method = init?.method ?? "GET";
  const requestStartedAt = recordCombatPerformanceRequestStart({ method, path });

  if (init?.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response | undefined;
  const parseStartedAt = { value: 0 };
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers
  });
    parseStartedAt.value = combatPerformanceNow();
    return await parseResponse<TResponse>(response);
  } finally {
    const parseDurationMs =
      parseStartedAt.value === 0 ? 0 : combatPerformanceNow() - parseStartedAt.value;
    const contentLength = response?.headers.get("content-length");
    recordCombatPerformanceRequestEnd({
      parseDurationMs,
      path,
      requestStartedAt,
      responseBytes:
        contentLength && Number.isFinite(Number(contentLength))
          ? Number(contentLength)
          : undefined,
      status: response?.status,
    });
  }
}
