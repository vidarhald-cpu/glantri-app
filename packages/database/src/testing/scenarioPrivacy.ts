import { PrismaClient } from "@prisma/client";

import type { ScenarioVisibility } from "@glantri/domain";

import { validateTestDatabaseTarget } from "../databaseTargetSafety";
import { assertWorktreeDatabaseRuntimeSafety } from "../worktreeDatabaseRuntimeSafety";

export async function setScenarioParticipantVisibilityForTest(input: {
  participantId: string;
  visibility: ScenarioVisibility;
}): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const worktreeEnvironment = assertWorktreeDatabaseRuntimeSafety();

  if (!worktreeEnvironment) {
    validateTestDatabaseTarget(databaseUrl);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  try {
    await prisma.scenarioParticipant.update({
      data: { visibilityOverridesJson: { visibility: input.visibility } },
      where: { id: input.participantId },
    });
  } finally {
    await prisma.$disconnect();
  }
}
