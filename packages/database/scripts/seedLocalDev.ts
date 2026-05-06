import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AuthService, ScenarioService, hashPassword, prisma } from "../src/index";

function loadDatabaseEnv(): void {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const packageDir = resolve(scriptDir, "..");
  const repoRoot = resolve(packageDir, "..", "..");

  process.loadEnvFile(resolve(repoRoot, ".env"));
  process.loadEnvFile(resolve(packageDir, ".env"));
}

function getSeedConfig(): {
  campaignName: string;
  displayName: string;
  email: string;
  entityName: string;
  password: string;
} {
  return {
    campaignName: process.env.GLANTRI_LOCAL_SEED_CAMPAIGN_NAME?.trim() || "Local Dev Campaign",
    displayName: process.env.GLANTRI_LOCAL_SEED_DISPLAY_NAME?.trim() || "Local GM",
    email: process.env.GLANTRI_LOCAL_SEED_EMAIL?.trim() || "local-gm@example.com",
    entityName: process.env.GLANTRI_LOCAL_SEED_ENTITY_NAME?.trim() || "Training Bandit",
    password: process.env.GLANTRI_LOCAL_SEED_PASSWORD?.trim() || "devpassword123"
  };
}

async function ensureLocalGameMaster(authService: AuthService, config: ReturnType<typeof getSeedConfig>) {
  const existingUser = await authService.findUserByEmail(config.email);

  if (!existingUser) {
    const createdUser = await authService.registerLocalUser({
      displayName: config.displayName,
      email: config.email,
      password: config.password
    });

    const updatedUser = await authService.replaceUserRoles(createdUser.id, ["player", "game_master"]);

    return updatedUser ?? createdUser;
  }

  await prisma.user.update({
    data: {
      displayName: config.displayName,
      passwordHash: hashPassword(config.password)
    },
    where: {
      id: existingUser.id
    }
  });

  const updatedUser = await authService.replaceUserRoles(existingUser.id, ["player", "game_master"]);

  if (!updatedUser) {
    throw new Error("Failed to assign local game master roles.");
  }

  return updatedUser;
}

async function ensureSampleCampaign(scenarioService: ScenarioService, gmUserId: string, campaignName: string) {
  const existingCampaign = await prisma.campaign.findFirst({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      gmUserId,
      name: campaignName
    }
  });

  if (existingCampaign) {
    return scenarioService.getCampaignById(existingCampaign.id);
  }

  return scenarioService.createCampaign({
    description: "Local bootstrap campaign for development resets.",
    gmUserId,
    name: campaignName,
    settings: {
      allowPlayerSelfJoin: false,
      defaultVisibility: "gm_only"
    },
    status: "draft"
  });
}

async function ensureSampleEntity(
  scenarioService: ScenarioService,
  gmUserId: string,
  entityName: string
) {
  const existingEntity = await prisma.reusableEntity.findFirst({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      gmUserId,
      name: entityName
    }
  });

  if (existingEntity) {
    return scenarioService.getReusableEntityById(existingEntity.id);
  }

  return scenarioService.createReusableEntity({
    description: "Baseline reusable entity for quick local scenario setup.",
    gmUserId,
    kind: "npc",
    name: entityName,
    notes: "Seeded by the local development bootstrap command.",
    snapshot: {
      health: {
        currentHp: 12,
        maxHp: 12
      }
    }
  });
}

async function main(): Promise<void> {
  loadDatabaseEnv();

  const config = getSeedConfig();
  const authService = new AuthService();
  const scenarioService = new ScenarioService();

  const user = await ensureLocalGameMaster(authService, config);
  const campaign = await ensureSampleCampaign(scenarioService, user.id, config.campaignName);
  const entity = await ensureSampleEntity(scenarioService, user.id, config.entityName);

  console.log("Local development seed complete.");
  console.log(`Login email: ${config.email}`);
  console.log(`Login password: ${config.password}`);
  console.log(`Roles: ${user.roles.join(", ")}`);

  if (campaign) {
    console.log(`Campaign: ${campaign.name} (${campaign.id})`);
  }

  if (entity) {
    console.log(`Reusable entity: ${entity.name} (${entity.id})`);
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`db:seed failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
