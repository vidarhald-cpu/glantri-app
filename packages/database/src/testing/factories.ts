import { randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { hashPassword } from "../services/authService";

function uniqueEmail(): string {
  return `test-${randomBytes(6).toString("hex")}@example.com`;
}

function uniqueSlug(): string {
  return `test-campaign-${randomBytes(6).toString("hex")}`;
}

function uniqueId(): string {
  return randomBytes(8).toString("hex");
}

export async function createTestUser(
  prisma: PrismaClient,
  overrides?: {
    displayName?: string;
    email?: string;
    password?: string;
    roles?: string[];
  }
): Promise<{ id: string; email: string; displayName?: string }> {
  const email = overrides?.email ?? uniqueEmail();
  const displayName = overrides?.displayName;
  const passwordHash = hashPassword(overrides?.password ?? "test-password-123");
  const roles = overrides?.roles ?? ["player"];

  const roleRecords = await Promise.all(
    roles.map((name) =>
      prisma.role.upsert({
        create: { name },
        update: {},
        where: { name }
      })
    )
  );

  const user = await prisma.user.create({
    data: {
      displayName,
      email,
      passwordHash,
      roles: {
        create: roleRecords.map((role) => ({ roleId: role.id }))
      }
    },
    select: {
      displayName: true,
      email: true,
      id: true
    }
  });

  return {
    displayName: user.displayName ?? undefined,
    email: user.email,
    id: user.id
  };
}

export async function createTestCampaign(
  prisma: PrismaClient,
  gmUserId: string,
  overrides?: {
    description?: string;
    name?: string;
    slug?: string;
    status?: "draft" | "active" | "archived";
  }
): Promise<{ id: string; name: string; gmUserId: string }> {
  const name = overrides?.name ?? `Test Campaign ${uniqueId()}`;
  const slug = overrides?.slug ?? uniqueSlug();
  const description = overrides?.description ?? "";
  const status = overrides?.status ?? "draft";

  const campaign = await prisma.campaign.create({
    data: {
      description,
      gmUserId,
      name,
      settingsJson: {
        allowPlayerSelfJoin: false,
        defaultVisibility: "hidden"
      },
      slug,
      status
    },
    select: {
      gmUserId: true,
      id: true,
      name: true
    }
  });

  return {
    gmUserId: campaign.gmUserId,
    id: campaign.id,
    name: campaign.name
  };
}

export async function createTestCharacter(
  prisma: PrismaClient,
  ownerId: string,
  overrides?: {
    id?: string;
    level?: number;
    name?: string;
  }
): Promise<{ id: string; name: string; ownerId: string }> {
  const characterId = overrides?.id ?? uniqueId();
  const name = overrides?.name ?? `Test Character ${uniqueId()}`;
  const level = overrides?.level ?? 1;

  const build = {
    equipment: { items: [] },
    id: characterId,
    name,
    profile: {
      description: "Test profile",
      distractionLevel: 3,
      id: `profile-${characterId}`,
      label: "Profile",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10
      },
      societyLevel: 0
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 0,
      secondaryPoolTotal: 0,
      skillGroups: [],
      skills: [],
      specializations: []
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: []
    }
  };

  const character = await prisma.character.create({
    data: {
      build,
      id: characterId,
      level,
      name,
      ownerId
    },
    select: {
      id: true,
      name: true,
      ownerId: true
    }
  });

  return {
    id: character.id,
    name: character.name,
    ownerId: character.ownerId!
  };
}
