import { z } from "zod";

import { authRoles } from "./roles";

export const authRoleSchema = z.enum(authRoles);

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().optional(),
  roles: z.array(authRoleSchema).default(["player"])
});

export const authSessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  tokenHash: z.string().min(1),
  expiresAt: z.string().min(1)
});

export const credentialLoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const credentialRegisterInputSchema = credentialLoginInputSchema.extend({
  displayName: z.string().min(1).optional()
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type CredentialLoginInput = z.infer<typeof credentialLoginInputSchema>;
export type CredentialRegisterInput = z.infer<typeof credentialRegisterInputSchema>;
