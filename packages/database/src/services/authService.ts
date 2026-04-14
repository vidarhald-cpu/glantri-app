import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type {
  AuthRole,
  AuthSession,
  AuthUser,
  CredentialLoginInput,
  CredentialRegisterInput
} from "@glantri/auth";

import {
  createPrismaAuthRepository,
  type CreateSessionInput
} from "../repositories/authRepository";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export class AuthService {
  constructor(private readonly repository = createPrismaAuthRepository()) {}

  async registerLocalUser(input: CredentialRegisterInput): Promise<AuthUser> {
    return this.repository.createUser({
      displayName: input.displayName,
      email: input.email,
      passwordHash: hashPassword(input.password)
    });
  }

  async startSession(input: Omit<CreateSessionInput, "tokenHash"> & { token: string }): Promise<AuthSession> {
    return this.repository.createSession({
      expiresAt: input.expiresAt,
      tokenHash: hashToken(input.token),
      userId: input.userId
    });
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return this.repository.findUserByEmail(email);
  }

  async listUsers(): Promise<AuthUser[]> {
    return this.repository.listUsers();
  }

  async replaceUserRoles(userId: string, roles: AuthRole[]): Promise<AuthUser | null> {
    return this.repository.replaceUserRoles(userId, roles);
  }

  async createSessionForUser(userId: string): Promise<{ session: AuthSession; token: string }> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    const session = await this.startSession({
      expiresAt,
      token,
      userId
    });

    return {
      session,
      token
    };
  }

  async getCurrentUserForToken(token: string): Promise<AuthUser | null> {
    const session = await this.repository.findSessionByTokenHash(hashToken(token));

    if (!session) {
      return null;
    }

    return this.repository.findUserById(session.userId);
  }

  async loginWithCredentials(input: CredentialLoginInput): Promise<AuthUser | null> {
    const credentialUser = await this.repository.findUserCredentialByEmail(input.email);

    if (!credentialUser) {
      return null;
    }

    if (!verifyPassword(input.password, credentialUser.passwordHash)) {
      return null;
    }

    return credentialUser.user;
  }

  async logout(token: string): Promise<void> {
    await this.repository.deleteSessionByTokenHash(hashToken(token));
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, storedDigest] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedDigest) {
    return false;
  }

  const computedDigest = scryptSync(password, salt, 64);
  const storedDigestBuffer = Buffer.from(storedDigest, "hex");

  if (computedDigest.length !== storedDigestBuffer.length) {
    return false;
  }

  return timingSafeEqual(computedDigest, storedDigestBuffer);
}
