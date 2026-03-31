import type {
  CharacterBuild,
  EncounterAttackResolution,
  EncounterParticipant,
  EncounterSession,
  ProfessionFamilyDefinition,
  ProfessionDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyLevelAccess
} from "@glantri/domain";

import { encounterSessionSchema } from "@glantri/domain";

import { buildCharacterSheetSummary } from "../sheets/buildCharacterSheetSummary";
import { validateEncounterParticipantDeclaration } from "./manageEncounterSession";

interface CanonicalContentShape {
  professionFamilies: ProfessionFamilyDefinition[];
  professions: ProfessionDefinition[];
  professionSkills: ProfessionSkillMap[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyLevels: SocietyLevelAccess[];
  specializations: SkillSpecialization[];
}

export interface ResolveEncounterAttackResult {
  errors: string[];
  resolution?: EncounterAttackResolution;
  warnings: string[];
}

function createId(prefix: string): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}`;
}

function clampPercentileRoll(roll: number): number {
  return Math.max(1, Math.min(100, Math.round(roll)));
}

function getParticipantById(session: EncounterSession, participantId: string): EncounterParticipant | undefined {
  return session.participants.find((participant) => participant.id === participantId);
}

export function validateEncounterAttackResolution(input: {
  attackerBuild?: CharacterBuild;
  attackerParticipantId: string;
  characterBuildsById: Record<string, CharacterBuild | undefined>;
  session: EncounterSession;
}): ResolveEncounterAttackResult {
  const session = encounterSessionSchema.parse(input.session);
  const attacker = getParticipantById(session, input.attackerParticipantId);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!attacker) {
    return {
      errors: ["Attacker is not part of this encounter."],
      warnings
    };
  }

  const declarationValidation = validateEncounterParticipantDeclaration({
    build: input.attackerBuild,
    participant: attacker,
    session
  });

  errors.push(...declarationValidation.errors);
  warnings.push(...declarationValidation.warnings);

  if (attacker.declaration.actionType !== "attack") {
    errors.push("Only attack declarations can be resolved with the attack resolver.");
  }

  if (!input.attackerBuild) {
    errors.push("Attack resolution currently requires a linked attacker character.");
  }

  const defender = attacker.declaration.targetParticipantId
    ? getParticipantById(session, attacker.declaration.targetParticipantId)
    : undefined;

  if (!defender) {
    errors.push("Attack resolution requires a valid defender target.");
  }

  return {
    errors,
    warnings
  };
}

export function resolveEncounterAttack(input: {
  attackerBuild?: CharacterBuild;
  attackerParticipantId: string;
  attackRoll: number;
  characterBuildsById: Record<string, CharacterBuild | undefined>;
  content: CanonicalContentShape;
  parryRoll?: number;
  session: EncounterSession;
}): ResolveEncounterAttackResult {
  const session = encounterSessionSchema.parse(input.session);
  const validation = validateEncounterAttackResolution({
    attackerBuild: input.attackerBuild,
    attackerParticipantId: input.attackerParticipantId,
    characterBuildsById: input.characterBuildsById,
    session
  });

  if (validation.errors.length > 0 || !input.attackerBuild) {
    return validation;
  }

  const attacker = getParticipantById(session, input.attackerParticipantId);

  if (!attacker?.declaration.targetParticipantId) {
    return {
      errors: ["Attack resolution requires a target declaration."],
      warnings: validation.warnings
    };
  }

  const defender = getParticipantById(session, attacker.declaration.targetParticipantId);

  if (!attacker || !defender) {
    return {
      errors: ["Attack resolution could not load the attacker or defender."],
      warnings: validation.warnings
    };
  }

  const defenderBuild = defender.characterId
    ? input.characterBuildsById[defender.characterId]
    : undefined;
  const attackerSheet = buildCharacterSheetSummary({
    build: input.attackerBuild,
    content: input.content
  });
  const defenderSheet = defenderBuild
    ? buildCharacterSheetSummary({
        build: defenderBuild,
        content: input.content
      })
    : undefined;
  const selectedWeapon = attacker.declaration.weaponItemId
    ? attackerSheet.equipment.equippedWeapons.find(
        (weapon) => weapon.id === attacker.declaration.weaponItemId
      )
    : undefined;

  if (!selectedWeapon) {
    return {
      errors: ["Attack resolution requires a selected equipped weapon."],
      warnings: validation.warnings
    };
  }

  const defenderDeclaration = defender.declaration;
  const defending =
    defenderDeclaration.actionType === "defend" || defenderDeclaration.defensePosture !== "none";
  const dbValue = defending ? defenderSheet?.combat.dodge ?? 0 : 0;
  const normalizedAttackRoll = clampPercentileRoll(input.attackRoll);
  const attackTotal = selectedWeapon.baseOb + normalizedAttackRoll;
  const attackHit = attackTotal > dbValue;
  const selectedParryWeapon = defenderDeclaration.weaponItemId
    ? defenderSheet?.equipment.equippedWeapons.find(
        (weapon) => weapon.id === defenderDeclaration.weaponItemId
      )
    : undefined;
  const selectedParryShield = defenderDeclaration.shieldItemId
    ? defenderSheet?.equipment.equippedShields.find(
        (shield) => shield.id === defenderDeclaration.shieldItemId
      )
    : undefined;
  const parryAttempted =
    attackHit &&
    defenderDeclaration.defensePosture === "parry" &&
    (selectedParryWeapon !== undefined || selectedParryShield !== undefined);
  const parryBase =
    selectedParryWeapon?.parryValue ??
    ((selectedParryShield?.shieldBonus ?? 0) + (defenderSheet?.adjustedStats.dex ?? 0));
  const normalizedParryRoll =
    parryAttempted && input.parryRoll !== undefined
      ? clampPercentileRoll(input.parryRoll)
      : undefined;
  const parryTotal =
    parryAttempted && normalizedParryRoll !== undefined ? parryBase + normalizedParryRoll : undefined;
  const parrySucceeded = attackHit && parryAttempted && parryTotal !== undefined && parryTotal >= attackTotal;
  const outcome = !attackHit
    ? "miss"
    : parrySucceeded
      ? "parried"
      : defending
        ? "hit-pending-damage"
        : "hit";

  return {
    errors: [],
    resolution: {
      attackerParticipantId: attacker.id,
      attackRoll: {
        baseOb: selectedWeapon.baseOb,
        defenseTarget: dbValue,
        hit: attackHit,
        margin: attackTotal - dbValue,
        roll: normalizedAttackRoll,
        total: attackTotal
      },
      declaration: attacker.declaration,
      defenderParticipantId: defender.id,
      defense: {
        dbApplied: defending,
        dbValue,
        defending,
        parryAttempted,
        parryBase,
        parryRoll: normalizedParryRoll,
        parrySucceeded,
        parryTotal,
        selectedShieldItemId: defenderDeclaration.shieldItemId,
        selectedWeaponItemId: defenderDeclaration.weaponItemId
      },
      encounterId: session.id,
      id: createId("resolution"),
      order: session.actionLog.length,
      outcome,
      resolvedAt: new Date().toISOString(),
      roundNumber: session.currentRound,
      selectedShieldItemId: defenderDeclaration.shieldItemId,
      selectedWeaponItemId: attacker.declaration.weaponItemId
    },
    warnings: validation.warnings
  };
}

export function appendEncounterAttackResolution(input: {
  resolution: EncounterAttackResolution;
  session: EncounterSession;
}): EncounterSession {
  const session = encounterSessionSchema.parse(input.session);

  return encounterSessionSchema.parse({
    ...session,
    actionLog: [...session.actionLog, input.resolution],
    updatedAt: new Date().toISOString()
  });
}
