import {
  DEFAULT_CHARGEN_RULE_SET,
  chargenRuleSetSchema,
  type ChargenRuleSet,
  type ChargenRuleSetParameters
} from "@glantri/domain";
import type { Prisma } from "@prisma/client";

import { prisma } from "../client";

const CHARGEN_RULE_SET_SNAPSHOT_KEY = "chargen-rule-sets-v1";

interface ChargenRuleSetStore {
  activeRuleSetId: string;
  ruleSets: ChargenRuleSet[];
}

export interface ChargenRuleSetRepository {
  activateRuleSet(id: string): Promise<ChargenRuleSetStore>;
  createRuleSet(input: {
    name: string;
    parameters: ChargenRuleSetParameters;
  }): Promise<ChargenRuleSetStore>;
  getStore(): Promise<ChargenRuleSetStore>;
}

function createDefaultStore(): ChargenRuleSetStore {
  return {
    activeRuleSetId: DEFAULT_CHARGEN_RULE_SET.id,
    ruleSets: [DEFAULT_CHARGEN_RULE_SET]
  };
}

function normalizeStore(input: unknown): ChargenRuleSetStore {
  const candidate =
    typeof input === "object" && input !== null
      ? (input as { activeRuleSetId?: unknown; ruleSets?: unknown })
      : undefined;
  const ruleSets = Array.isArray(candidate?.ruleSets)
    ? candidate.ruleSets
        .map((ruleSet) => chargenRuleSetSchema.safeParse(ruleSet))
        .filter((result) => result.success)
        .map((result) => result.data)
    : [];

  if (ruleSets.length === 0) {
    return createDefaultStore();
  }

  const requestedActiveRuleSetId =
    typeof candidate?.activeRuleSetId === "string" ? candidate.activeRuleSetId : undefined;
  const activeRuleSetId = ruleSets.some((ruleSet) => ruleSet.id === requestedActiveRuleSetId)
    ? requestedActiveRuleSetId!
    : ruleSets[0].id;

  return {
    activeRuleSetId,
    ruleSets: ruleSets.map((ruleSet) => ({
      ...ruleSet,
      isActive: ruleSet.id === activeRuleSetId
    }))
  };
}

function createRuleSetId(): string {
  const randomId =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `chargen-rule-${randomId}`;
}

async function persistStore(store: ChargenRuleSetStore): Promise<ChargenRuleSetStore> {
  const current = await prisma.canonicalContentSnapshot.findUnique({
    where: {
      key: CHARGEN_RULE_SET_SNAPSHOT_KEY
    }
  });
  const normalized = normalizeStore(store);
  const normalizedJson = normalized as unknown as Prisma.InputJsonObject;

  await prisma.canonicalContentSnapshot.upsert({
    create: {
      content: normalizedJson,
      key: CHARGEN_RULE_SET_SNAPSHOT_KEY,
      revision: 1
    },
    update: {
      content: normalizedJson,
      revision: (current?.revision ?? 0) + 1
    },
    where: {
      key: CHARGEN_RULE_SET_SNAPSHOT_KEY
    }
  });

  return normalized;
}

export function createPrismaChargenRuleSetRepository(): ChargenRuleSetRepository {
  return {
    async activateRuleSet(id) {
      const store = await this.getStore();

      if (!store.ruleSets.some((ruleSet) => ruleSet.id === id)) {
        throw new Error("Chargen rule set not found.");
      }

      return persistStore({
        activeRuleSetId: id,
        ruleSets: store.ruleSets
      });
    },
    async createRuleSet(input) {
      const store = await this.getStore();
      const now = new Date().toISOString();
      const ruleSet: ChargenRuleSet = {
        ...input.parameters,
        createdAt: now,
        id: createRuleSetId(),
        isActive: false,
        name: input.name.trim(),
        updatedAt: now
      };

      return persistStore({
        activeRuleSetId: store.activeRuleSetId,
        ruleSets: [ruleSet, ...store.ruleSets]
      });
    },
    async getStore() {
      const snapshot = await prisma.canonicalContentSnapshot.findUnique({
        where: {
          key: CHARGEN_RULE_SET_SNAPSHOT_KEY
        }
      });

      return normalizeStore(snapshot?.content);
    }
  };
}
