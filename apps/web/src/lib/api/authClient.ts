import type { AuthRole, AuthUser, CredentialLoginInput, CredentialRegisterInput } from "@glantri/auth";

import { API_BASE_URL } from "./apiConfig";
import { parseResponse, sendJson } from "./apiClient";

export async function getCurrentSessionUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: "include"
  });
  const payload = await parseResponse<{ canBootstrapGameMaster?: boolean; user: AuthUser | null }>(
    response
  );
  return payload.user;
}

export async function getBootstrapGameMasterAvailability(): Promise<boolean> {
  const payload = await sendJson<{ canBootstrapGameMaster: boolean }>("/auth/bootstrap-status", {
    method: "GET"
  });

  return payload.canBootstrapGameMaster;
}

export async function bootstrapGameMasterRole(): Promise<{
  canBootstrapGameMaster: boolean;
  user: AuthUser;
}> {
  return sendJson<{ canBootstrapGameMaster: boolean; user: AuthUser }>("/auth/bootstrap-gm", {
    body: JSON.stringify({}),
    method: "POST"
  });
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

export async function loadAuthUsers(): Promise<AuthUser[]> {
  const payload = await sendJson<{ users: AuthUser[] }>("/auth/users", {
    method: "GET"
  });

  return payload.users;
}

export async function updateAuthUserRole(input: {
  role: AuthRole;
  userId: string;
}): Promise<AuthUser> {
  const payload = await sendJson<{ user: AuthUser }>(`/auth/users/${input.userId}/role`, {
    body: JSON.stringify({
      role: input.role
    }),
    method: "POST"
  });

  return payload.user;
}
