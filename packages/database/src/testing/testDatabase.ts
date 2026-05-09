import { PrismaClient } from "@prisma/client";

let testClient: PrismaClient | undefined;

export function getTestPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL_TEST) {
    return null;
  }

  if (!testClient) {
    testClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_TEST
        }
      },
      log: ["warn", "error"]
    });
  }

  return testClient;
}

export async function resetTestDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in dependency order: leaf tables first, then parent tables.
  // Each group uses deleteMany({}) which bypasses FK checks within a group
  // as long as the group ordering respects referencing → referenced direction.
  await prisma.scenarioEventLog.deleteMany({});
  await prisma.scenarioParticipant.deleteMany({});
  await prisma.scenarioRelationship.deleteMany({});
  await prisma.campaignRosterEntry.deleteMany({});
  await prisma.characterLoadout.deleteMany({});
  await prisma.characterEquipmentItem.deleteMany({});
  await prisma.characterStorageLocation.deleteMany({});
  await prisma.scenario.deleteMany({});
  await prisma.campaignAsset.deleteMany({});
  await prisma.reusableEntity.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.character.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.weapon.deleteMany({});
  await prisma.encounter.deleteMany({});
  await prisma.canonicalContentSnapshot.deleteMany({});
}
