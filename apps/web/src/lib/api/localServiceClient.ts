import type { AuthUser, CredentialLoginInput, CredentialRegisterInput } from "@glantri/auth";
import type { CanonicalContent } from "@glantri/content";
import type { CharacterBuild } from "@glantri/domain";
import type {
  AdminContentConflictResponse,
  AdminContentGetResponse,
  AdminContentPutRequest,
  AdminContentPutResponse
} from "@glantri/shared";

export interface ServerCharacterRecord {
  build: CharacterBuild;
  createdAt: string;
  id: string;
  level: number;
  name: string;
  ownerId?: string | null;
  updatedAt: string;
}

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
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

async function sendJson<TResponse>(
  path: string,
  init?: Omit<RequestInit, "credentials">
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  return parseResponse<TResponse>(response);
}

export async function getCurrentSessionUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: "include"
  });
  const payload = await parseResponse<{ user: AuthUser | null }>(response);
  return payload.user;
}

export async function registerLocalUser(input: CredentialRegisterInput): Promise<AuthUser> {
  const payload = await sendJson<{ user: AuthUser }>("/auth/register", {
    body: JSON.stringify(input),
    method: "POST"
  });

  return payload.user;
}

export async function loginLocalUser(input: CredentialLoginInput): Promise<AuthUser> {
  const payload = await sendJson<{ user: AuthUser }>("/auth/login", {
    body: JSON.stringify(input),
    method: "POST"
  });

  return payload.user;
}

export async function logoutLocalUser(): Promise<void> {
  await sendJson<{ ok: true }>("/auth/logout", {
    body: JSON.stringify({}),
    method: "POST"
  });
}

export async function saveCharacterToServer(build: CharacterBuild): Promise<ServerCharacterRecord> {
  const payload = await sendJson<{ character: ServerCharacterRecord }>("/characters", {
    body: JSON.stringify({ build }),
    method: "POST"
  });

  return payload.character;
}

export async function loadMyServerCharacters(): Promise<ServerCharacterRecord[]> {
  const payload = await sendJson<{ characters: ServerCharacterRecord[] }>("/characters", {
    method: "GET"
  });

  return payload.characters;
}

export async function loadAdminCanonicalContentFromServer(): Promise<
  AdminContentGetResponse<CanonicalContent>
> {
  return sendJson<AdminContentGetResponse<CanonicalContent>>("/api/admin/content", {
    method: "GET"
  });
}

export async function saveAdminCanonicalContentToServer(
  input: AdminContentPutRequest<CanonicalContent>
): Promise<AdminContentPutResponse<CanonicalContent>> {
  return sendJson<AdminContentPutResponse<CanonicalContent>>("/api/admin/content", {
    body: JSON.stringify(input),
    method: "PUT"
  });
}

export function isAdminContentConflictPayload(
  payload: unknown
): payload is AdminContentConflictResponse<CanonicalContent> {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return "current" in payload && "error" in payload;
}
