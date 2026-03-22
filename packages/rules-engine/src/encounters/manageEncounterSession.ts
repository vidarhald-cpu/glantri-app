import type {
  EncounterAttackResolution,
  CharacterBuild,
  EncounterActionType,
  EncounterDefenseFocus,
  EncounterDefensePosture,
  EncounterFacing,
  EncounterOrientation,
  EncounterParticipant,
  EncounterParticipantDeclaration,
  EncounterPosition,
  EncounterSession,
  ProfessionDefinition,
  ProfessionSkillMap,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyLevelAccess
} from "@glantri/domain";

import { encounterSessionSchema } from "@glantri/domain";

import { buildCharacterSheetSummary, type CharacterSheetSummary } from "../sheets/buildCharacterSheetSummary";

interface CanonicalContentShape {
  professions: ProfessionDefinition[];
  professionSkills: ProfessionSkillMap[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyLevels: SocietyLevelAccess[];
  specializations: SkillSpecialization[];
}

export interface EncounterParticipantSummary {
  armorSummary: string;
  combatGroups: Array<{
    groupLevel: number;
    name: string;
  }>;
  combatSkills: Array<{
    name: string;
    totalSkill: number;
  }>;
  displayName: string;
  dodge: number;
  equippedShieldNames: string[];
  equippedWeaponNames: string[];
  gmsTotal: number;
  hasLinkedCharacter: boolean;
  keyStats: Array<{
    stat: string;
    value: number;
  }>;
  parry: number;
  professionName?: string;
  sheetSummary?: CharacterSheetSummary;
}

export interface EncounterViewParticipant {
  declarationSummary: EncounterParticipantDeclarationSummary;
  isCurrentTurn: boolean;
  participant: EncounterParticipant;
  summary: EncounterParticipantSummary;
}

export interface EncounterParticipantDeclarationValidation {
  errors: string[];
  isComplete: boolean;
  warnings: string[];
}

export interface EncounterParticipantDeclarationSummary
  extends EncounterParticipantDeclarationValidation {
  actionLabel: string;
  actionType: EncounterActionType;
  defenseFocusLabel?: string;
  defensePostureLabel?: string;
  selectedShieldName?: string;
  selectedTargetName?: string;
  selectedWeaponName?: string;
}

export interface EncounterRoundSummaryEntry {
  actionLabel: string;
  defenseFocusLabel?: string;
  defensePostureLabel?: string;
  displayName: string;
  isComplete: boolean;
  participantId: string;
  selectedShieldName?: string;
  selectedTargetName?: string;
  selectedWeaponName?: string;
}

export interface EncounterActionLogEntry {
  armorLabel?: string;
  armorValue?: number;
  attackRoll: number;
  attackTotal: number;
  attackerName: string;
  criticalEffectSummary?: string;
  criticalModifierTotal?: number;
  criticalResultKey?: string;
  criticalResultRow?: string;
  criticalRoll?: number;
  criticalStatus?: string;
  criticalTriggerThreshold?: number;
  criticalType?: string;
  dbValue: number;
  defenderName: string;
  finalDamage?: number;
  hitLocation?: string;
  id: string;
  outcome: EncounterAttackResolution["outcome"];
  parryRoll?: number;
  parryTotal?: number;
  rawDamage?: number;
  resolvedAt: string;
  roundNumber: number;
  selectedShieldName?: string;
  selectedWeaponName?: string;
  weaponArmorModifier?: number;
}

export interface EncounterSessionView {
  actionLog: EncounterActionLogEntry[];
  currentRound: number;
  currentTurnIndex: number;
  currentTurnParticipantId?: string;
  declarationsComplete: boolean;
  declarationsLocked: boolean;
  participants: EncounterViewParticipant[];
  roundSummary: EncounterRoundSummaryEntry[];
  session: EncounterSession;
}

function createId(prefix: string): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}`;
}

function createDefaultDeclaration(): EncounterParticipantDeclaration {
  return {
    actionType: "none",
    defenseFocus: "none",
    defensePosture: "none",
    targetLocation: "any"
  };
}

function getActionLabel(actionType: EncounterActionType): string {
  switch (actionType) {
    case "attack":
      return "Attack";
    case "move":
      return "Move";
    case "defend":
      return "Defend";
    case "ready":
      return "Ready";
    case "other":
      return "Other";
    case "none":
    default:
      return "No declaration";
  }
}

function getDefensePostureLabel(defensePosture: EncounterDefensePosture): string | undefined {
  switch (defensePosture) {
    case "guard":
      return "Guard";
    case "parry":
      return "Parry";
    case "shield":
      return "Shield defense";
    case "full-defense":
      return "Full defense";
    case "none":
    default:
      return undefined;
  }
}

function getDefenseFocusLabel(defenseFocus: EncounterDefenseFocus): string | undefined {
  switch (defenseFocus) {
    case "self":
      return "Self";
    case "weapon-side":
      return "Weapon side";
    case "shield-side":
      return "Shield side";
    case "none":
    default:
      return undefined;
  }
}

function getParticipantDisplayName(participant: EncounterParticipant, build?: CharacterBuild): string {
  if (build) {
    return build.name;
  }

  return participant.adHocName ?? participant.label;
}

function normalizeSession(session: EncounterSession): EncounterSession {
  const parsed = encounterSessionSchema.parse(session);
  const participants = [...parsed.participants]
    .sort((left, right) => left.order - right.order)
    .map((participant, index) => ({
      ...participant,
      declaration: {
        ...createDefaultDeclaration(),
        ...participant.declaration
      },
      order: index
    }));
  const maxIndex = Math.max(0, participants.length - 1);

  return {
    ...parsed,
    currentTurnIndex: Math.min(parsed.currentTurnIndex, maxIndex),
    participants
  };
}

function touchSession(session: EncounterSession): EncounterSession {
  return {
    ...session,
    updatedAt: new Date().toISOString()
  };
}

function updateParticipant(
  session: EncounterSession,
  participantId: string,
  updater: (participant: EncounterParticipant) => EncounterParticipant
): EncounterSession {
  const normalized = normalizeSession(session);

  return touchSession({
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.id === participantId ? updater(participant) : participant
    )
  });
}

export function createEncounterSession(title: string): EncounterSession {
  const now = new Date().toISOString();

  return normalizeSession({
    actionLog: [],
    createdAt: now,
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: createId("encounter"),
    participants: [],
    status: "setup",
    title: title.trim() || "Untitled encounter",
    turnOrderMode: "manual",
    updatedAt: now
  });
}

export function addCharacterParticipant(input: {
  characterId: string;
  label: string;
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);
  const participant: EncounterParticipant = {
    characterId: input.characterId,
    declaration: createDefaultDeclaration(),
    facing: "north",
    id: createId("participant"),
    initiative: 0,
    label: input.label.trim(),
    order: normalized.participants.length,
    orientation: "neutral",
    participantType: "character",
    position: {
      x: 0,
      y: 0,
      zone: "center"
    }
  };

  return touchSession({
    ...normalized,
    participants: [...normalized.participants, participant]
  });
}

export function addAdHocParticipant(input: {
  label: string;
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);
  const label = input.label.trim();
  const participant: EncounterParticipant = {
    adHocName: label,
    declaration: createDefaultDeclaration(),
    facing: "north",
    id: createId("participant"),
    initiative: 0,
    label,
    order: normalized.participants.length,
    orientation: "neutral",
    participantType: "ad-hoc",
    position: {
      x: 0,
      y: 0,
      zone: "center"
    }
  };

  return touchSession({
    ...normalized,
    participants: [...normalized.participants, participant]
  });
}

export function removeEncounterParticipant(input: {
  participantId: string;
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);

  return normalizeSession(
    touchSession({
      ...normalized,
      participants: normalized.participants.filter(
        (participant) => participant.id !== input.participantId
      )
    })
  );
}

export function moveEncounterParticipant(input: {
  direction: "up" | "down";
  participantId: string;
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);
  const participants = [...normalized.participants];
  const index = participants.findIndex((participant) => participant.id === input.participantId);

  if (index < 0) {
    return normalized;
  }

  const targetIndex = input.direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= participants.length) {
    return normalized;
  }

  const [moved] = participants.splice(index, 1);
  participants.splice(targetIndex, 0, moved);

  return normalizeSession(
    touchSession({
      ...normalized,
      participants
    })
  );
}

export function updateEncounterParticipantTurnData(input: {
  facing?: EncounterFacing;
  initiative?: number;
  orientation?: EncounterOrientation;
  participantId: string;
  position?: EncounterPosition;
  session: EncounterSession;
}): EncounterSession {
  return updateParticipant(input.session, input.participantId, (participant) => ({
    ...participant,
    facing: input.facing ?? participant.facing,
    initiative: input.initiative ?? participant.initiative,
    orientation: input.orientation ?? participant.orientation,
    position: input.position ?? participant.position
  }));
}

export function setEncounterCurrentTurnIndex(input: {
  currentTurnIndex: number;
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);
  const maxIndex = Math.max(0, normalized.participants.length - 1);

  return touchSession({
    ...normalized,
    currentTurnIndex: Math.max(0, Math.min(input.currentTurnIndex, maxIndex))
  });
}

export function validateEncounterTargetSelection(input: {
  participantId: string;
  session: EncounterSession;
  targetParticipantId?: string;
}): EncounterParticipantDeclarationValidation {
  const session = normalizeSession(input.session);
  const errors: string[] = [];

  if (!input.targetParticipantId) {
    return {
      errors,
      isComplete: true,
      warnings: []
    };
  }

  if (input.targetParticipantId === input.participantId) {
    errors.push("A participant cannot target itself.");
  }

  const targetExists = session.participants.some(
    (participant) => participant.id === input.targetParticipantId
  );

  if (!targetExists) {
    errors.push("Selected target is not part of this encounter.");
  }

  return {
    errors,
    isComplete: errors.length === 0,
    warnings: []
  };
}

export function validateEncounterParticipantDeclaration(input: {
  build?: CharacterBuild;
  participant: EncounterParticipant;
  session: EncounterSession;
}): EncounterParticipantDeclarationValidation {
  const declaration = {
    ...createDefaultDeclaration(),
    ...input.participant.declaration
  };
  const errors: string[] = [];
  const warnings: string[] = [];
  const targetValidation = validateEncounterTargetSelection({
    participantId: input.participant.id,
    session: input.session,
    targetParticipantId: declaration.targetParticipantId
  });
  const equippedWeapons =
    input.build?.equipment.items.filter((item) => item.equipped && item.itemType === "weapon") ?? [];
  const equippedShields =
    input.build?.equipment.items.filter((item) => item.equipped && item.itemType === "shield") ?? [];

  errors.push(...targetValidation.errors);

  if (declaration.actionType === "none") {
    return {
      errors,
      isComplete: false,
      warnings
    };
  }

  if (declaration.actionType === "attack" && !declaration.targetParticipantId) {
    errors.push("Attack declarations require a selected target.");
  }

  if (declaration.actionType === "attack" && equippedWeapons.length > 0 && !declaration.weaponItemId) {
    errors.push("Attack declarations require a selected equipped weapon.");
  }

  if (
    declaration.weaponItemId &&
    !equippedWeapons.some((item) => item.id === declaration.weaponItemId)
  ) {
    errors.push("Selected weapon is not currently equipped.");
  }

  if (
    declaration.shieldItemId &&
    !equippedShields.some((item) => item.id === declaration.shieldItemId)
  ) {
    errors.push("Selected shield is not currently equipped.");
  }

  if (
    declaration.defensePosture === "parry" &&
    !declaration.weaponItemId &&
    !declaration.shieldItemId
  ) {
    errors.push("Parry posture requires a selected weapon or shield.");
  }

  if (declaration.defensePosture === "shield" && equippedShields.length > 0 && !declaration.shieldItemId) {
    errors.push("Shield defense requires a selected equipped shield.");
  }

  if (declaration.actionType === "defend" && declaration.defensePosture === "none") {
    warnings.push("Defend declarations are clearer with a defense posture.");
  }

  return {
    errors,
    isComplete: errors.length === 0,
    warnings
  };
}

export function updateEncounterParticipantDeclaration(input: {
  declaration: Partial<EncounterParticipantDeclaration>;
  participantId: string;
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);

  if (normalized.declarationsLocked) {
    return normalized;
  }

  return updateParticipant(normalized, input.participantId, (participant) => ({
    ...participant,
    declaration: {
      ...createDefaultDeclaration(),
      ...participant.declaration,
      ...input.declaration
    }
  }));
}

export function clearEncounterParticipantDeclaration(input: {
  participantId: string;
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);

  if (normalized.declarationsLocked) {
    return normalized;
  }

  return updateParticipant(normalized, input.participantId, (participant) => ({
    ...participant,
    declaration: createDefaultDeclaration()
  }));
}

export function clearEncounterDeclarations(input: {
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);

  if (normalized.declarationsLocked) {
    return normalized;
  }

  return touchSession({
    ...normalized,
    participants: normalized.participants.map((participant) => ({
      ...participant,
      declaration: createDefaultDeclaration()
    }))
  });
}

export function setEncounterDeclarationsLocked(input: {
  locked: boolean;
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);

  return touchSession({
    ...normalized,
    declarationsLocked: input.locked
  });
}

export function advanceEncounterRound(input: {
  session: EncounterSession;
}): EncounterSession {
  const normalized = normalizeSession(input.session);

  return normalizeSession(
    touchSession({
      ...normalized,
      currentRound: normalized.currentRound + 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      participants: normalized.participants.map((participant) => ({
        ...participant,
        declaration: createDefaultDeclaration()
      }))
    })
  );
}

function buildEncounterParticipantDeclarationSummary(input: {
  build?: CharacterBuild;
  participant: EncounterParticipant;
  session: EncounterSession;
  targetNameById: Record<string, string>;
}): EncounterParticipantDeclarationSummary {
  const declaration = {
    ...createDefaultDeclaration(),
    ...input.participant.declaration
  };
  const validation = validateEncounterParticipantDeclaration({
    build: input.build,
    participant: input.participant,
    session: input.session
  });
  const selectedWeaponName = declaration.weaponItemId
    ? input.build?.equipment.items.find((item) => item.id === declaration.weaponItemId)?.name
    : undefined;
  const selectedShieldName = declaration.shieldItemId
    ? input.build?.equipment.items.find((item) => item.id === declaration.shieldItemId)?.name
    : undefined;

  return {
    actionLabel: getActionLabel(declaration.actionType),
    actionType: declaration.actionType,
    defenseFocusLabel: getDefenseFocusLabel(declaration.defenseFocus),
    defensePostureLabel: getDefensePostureLabel(declaration.defensePosture),
    errors: validation.errors,
    isComplete: validation.isComplete,
    selectedShieldName,
    selectedTargetName: declaration.targetParticipantId
      ? input.targetNameById[declaration.targetParticipantId]
      : undefined,
    selectedWeaponName,
    warnings: validation.warnings
  };
}

function buildEncounterActionLogEntry(input: {
  characterBuildsById: Record<string, CharacterBuild | undefined>;
  resolution: EncounterAttackResolution;
  session: EncounterSession;
}): EncounterActionLogEntry {
  const attacker = input.session.participants.find(
    (participant) => participant.id === input.resolution.attackerParticipantId
  );
  const defender = input.session.participants.find(
    (participant) => participant.id === input.resolution.defenderParticipantId
  );
  const attackerBuild = attacker?.characterId
    ? input.characterBuildsById[attacker.characterId]
    : undefined;
  const defenderBuild = defender?.characterId
    ? input.characterBuildsById[defender.characterId]
    : undefined;
  const attackerItemName = input.resolution.selectedWeaponItemId
    ? attackerBuild?.equipment.items.find((item) => item.id === input.resolution.selectedWeaponItemId)?.name
    : undefined;
  const defenderShieldName = input.resolution.selectedShieldItemId
    ? defenderBuild?.equipment.items.find((item) => item.id === input.resolution.selectedShieldItemId)?.name
    : undefined;

  return {
    armorLabel: input.resolution.damage?.armorLabel,
    armorValue: input.resolution.damage?.armorValue,
    attackRoll: input.resolution.attackRoll.roll,
    attackTotal: input.resolution.attackRoll.total,
    attackerName: attacker
      ? getParticipantDisplayName(attacker, attackerBuild)
      : input.resolution.attackerParticipantId,
    criticalEffectSummary: input.resolution.critical?.effect?.summary,
    criticalModifierTotal: input.resolution.critical?.roll.totalModifier,
    criticalResultKey: input.resolution.critical?.roll.resultKey,
    criticalResultRow: input.resolution.critical?.roll.resultRow,
    criticalRoll: input.resolution.critical?.roll.roll,
    criticalStatus: input.resolution.critical?.status,
    criticalTriggerThreshold: input.resolution.critical?.triggerThreshold,
    criticalType: input.resolution.critical?.type,
    dbValue: input.resolution.defense.dbValue,
    defenderName: defender
      ? getParticipantDisplayName(defender, defenderBuild)
      : input.resolution.defenderParticipantId,
    finalDamage: input.resolution.damage?.finalDamage,
    hitLocation: input.resolution.hitLocation?.resolvedLocation,
    id: input.resolution.id,
    outcome: input.resolution.outcome,
    parryRoll: input.resolution.defense.parryRoll,
    parryTotal: input.resolution.defense.parryTotal,
    rawDamage: input.resolution.damage?.rawDamage,
    resolvedAt: input.resolution.resolvedAt,
    roundNumber: input.resolution.roundNumber,
    selectedShieldName: defenderShieldName,
    selectedWeaponName: attackerItemName,
    weaponArmorModifier: input.resolution.damage?.weaponArmorModifier
  };
}

export function buildEncounterParticipantSummary(input: {
  build?: CharacterBuild;
  content: CanonicalContentShape;
  participant: EncounterParticipant;
}): EncounterParticipantSummary {
  if (!input.build) {
    return {
      armorSummary: "No linked character",
      combatGroups: [],
      combatSkills: [],
      displayName: input.participant.adHocName ?? input.participant.label,
      dodge: 0,
      equippedShieldNames: [],
      equippedWeaponNames: [],
      gmsTotal: 0,
      hasLinkedCharacter: false,
      keyStats: [],
      parry: 0,
      professionName: undefined
    };
  }

  const sheetSummary = buildCharacterSheetSummary({
    build: input.build,
    content: input.content
  });

  return {
    armorSummary: sheetSummary.equipment.armorSummary,
    combatGroups: sheetSummary.combat.combatGroups.map((group) => ({
      groupLevel: group.groupLevel,
      name: group.name
    })),
    combatSkills: sheetSummary.combat.weaponSkills.map((skill) => ({
      name: skill.name,
      totalSkill: skill.totalSkill
    })),
    displayName: input.build.name,
    dodge: sheetSummary.combat.dodge,
    equippedShieldNames: sheetSummary.equipment.equippedShields.map((item) => item.name),
    equippedWeaponNames: sheetSummary.equipment.equippedWeapons.map((item) => item.name),
    gmsTotal: sheetSummary.gms.total,
    hasLinkedCharacter: true,
    keyStats: ["str", "dex", "health"]
      .map((stat) => ({
        stat,
        value: sheetSummary.adjustedStats[stat]
      }))
      .filter((entry) => entry.value !== undefined),
    parry: sheetSummary.combat.parry,
    professionName: sheetSummary.professionName,
    sheetSummary
  };
}

export function buildEncounterSessionView(input: {
  characterBuildsById: Record<string, CharacterBuild | undefined>;
  content: CanonicalContentShape;
  session: EncounterSession;
}): EncounterSessionView {
  const session = normalizeSession(input.session);
  const targetNameById = Object.fromEntries(
    session.participants.map((participant) => [
      participant.id,
      participant.adHocName ?? participant.label
    ])
  );
  const participants = session.participants.map((participant, index) => {
    const build = participant.characterId
      ? input.characterBuildsById[participant.characterId]
      : undefined;

    return {
      declarationSummary: buildEncounterParticipantDeclarationSummary({
        build,
        participant,
        session,
        targetNameById
      }),
      isCurrentTurn: index === session.currentTurnIndex,
      participant,
      summary: buildEncounterParticipantSummary({
        build,
        content: input.content,
        participant
      })
    };
  });

  return {
    actionLog: [...session.actionLog]
      .sort((left, right) => right.order - left.order)
      .map((resolution) =>
        buildEncounterActionLogEntry({
          characterBuildsById: input.characterBuildsById,
          resolution,
          session
        })
      ),
    currentRound: session.currentRound,
    currentTurnIndex: session.currentTurnIndex,
    currentTurnParticipantId: participants[session.currentTurnIndex]?.participant.id,
    declarationsComplete:
      participants.length > 0 && participants.every((participant) => participant.declarationSummary.isComplete),
    declarationsLocked: session.declarationsLocked,
    participants,
    roundSummary: participants.map((participant) => ({
      actionLabel: participant.declarationSummary.actionLabel,
      defenseFocusLabel: participant.declarationSummary.defenseFocusLabel,
      defensePostureLabel: participant.declarationSummary.defensePostureLabel,
      displayName: participant.summary.displayName,
      isComplete: participant.declarationSummary.isComplete,
      participantId: participant.participant.id,
      selectedShieldName: participant.declarationSummary.selectedShieldName,
      selectedTargetName: participant.declarationSummary.selectedTargetName,
      selectedWeaponName: participant.declarationSummary.selectedWeaponName
    })),
    session
  };
}
