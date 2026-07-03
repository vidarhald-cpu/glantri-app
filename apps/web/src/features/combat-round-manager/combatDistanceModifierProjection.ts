import {
  applyCombatActionGeneratedModifiers,
  getCombatDeclarationAttackPhases,
  getCombatDistanceParticipantAliases,
  getDistanceEdgeBetweenParticipantAliases,
  getWeaponPreferredDistances,
  type CombatActionGeneratedDistanceModifierInput,
  type CombatRoundPhaseContexts,
  type CombatRoundState,
  type EncounterSession,
  type ScenarioParticipant,
  type ScenarioParticipantCombatContext,
  type WeaponTemplate,
} from "@glantri/domain";

import type { EquipmentFeatureState } from "@/features/equipment/types";

type PhaseKey = "phase1" | "phase2";

function isWeaponTemplate(value: unknown): value is WeaponTemplate {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { category?: unknown }).category === "weapon" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

function isProjectionEquipmentState(value: unknown): value is EquipmentFeatureState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.itemsById === "object" &&
    record.itemsById !== null &&
    typeof record.activeLoadoutByCharacterId === "object" &&
    record.activeLoadoutByCharacterId !== null &&
    typeof record.templates === "object" &&
    record.templates !== null
  );
}

function normalizeWeaponName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : undefined;
}

function getEquipmentStateWeaponTemplates(
  state: EquipmentFeatureState | undefined,
): WeaponTemplate[] {
  return Object.values(state?.templates.templatesById ?? {}).filter(isWeaponTemplate);
}

function getActiveWeaponTemplates(input: {
  participant?: ScenarioParticipant;
  resolvedEquipmentState?: EquipmentFeatureState;
}): WeaponTemplate[] {
  const snapshotEquipmentState = input.participant?.snapshot.equipmentState;
  const equipmentState =
    input.resolvedEquipmentState ??
    (isProjectionEquipmentState(snapshotEquipmentState) ? snapshotEquipmentState : undefined);

  if (!equipmentState) {
    return [];
  }

  const characterId =
    input.participant?.characterId ?? Object.keys(equipmentState.activeLoadoutByCharacterId)[0];
  const loadout = characterId ? equipmentState.activeLoadoutByCharacterId[characterId] : undefined;
  const activeWeaponItemIds = [
    loadout?.activePrimaryWeaponItemId,
    loadout?.activeSecondaryWeaponItemId,
    loadout?.activeMissileWeaponItemId,
  ].filter((itemId): itemId is string => Boolean(itemId));

  return activeWeaponItemIds
    .map((itemId) => {
      const item = equipmentState.itemsById[itemId];
      const template = item ? equipmentState.templates.templatesById[item.templateId] : undefined;

      return isWeaponTemplate(template) ? template : undefined;
    })
    .filter((template): template is WeaponTemplate => Boolean(template));
}

function findAttackWeaponTemplate(input: {
  participant?: ScenarioParticipant;
  phaseWeaponName?: string;
  resolvedEquipmentState?: EquipmentFeatureState;
}): WeaponTemplate | undefined {
  const weaponName = normalizeWeaponName(input.phaseWeaponName);
  const candidates = [
    ...getActiveWeaponTemplates(input),
    ...getEquipmentStateWeaponTemplates(
      input.resolvedEquipmentState ??
        (isProjectionEquipmentState(input.participant?.snapshot.equipmentState)
          ? input.participant.snapshot.equipmentState
          : undefined),
    ),
  ];

  if (!weaponName) {
    return candidates[0];
  }

  return (
    candidates.find((template) => normalizeWeaponName(template.name) === weaponName) ??
    candidates.find((template) => {
      const templateName = normalizeWeaponName(template.name);

      return (
        Boolean(templateName) &&
        (weaponName.startsWith(`${templateName} `) || weaponName.startsWith(`${templateName}+`))
      );
    }) ??
    candidates[0]
  );
}

function participantAliasesInclude(input: {
  id?: string;
  participant: Parameters<typeof getCombatDistanceParticipantAliases>[0];
}): boolean {
  return Boolean(
    input.id && getCombatDistanceParticipantAliases(input.participant).includes(input.id),
  );
}

function findRoundParticipantByAlias(input: {
  id?: string;
  roundState?: CombatRoundState;
}): CombatRoundState["participants"][number] | undefined {
  return input.roundState?.participants.find((participant) =>
    participantAliasesInclude({ id: input.id, participant }),
  );
}

function buildDistanceModifierInput(input: {
  actionId?: string;
  encounterParticipant?: EncounterSession["participants"][number];
  phase: PhaseKey;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseWeaponName?: string;
  resolvedEquipmentState?: EquipmentFeatureState;
  roundState?: CombatRoundState;
  scenarioParticipant?: ScenarioParticipant;
}): CombatActionGeneratedDistanceModifierInput | undefined {
  const targetParticipantId = input.phaseContexts?.[input.phase]?.targetParticipantId;

  if (!input.roundState || !input.encounterParticipant || !targetParticipantId) {
    return undefined;
  }

  const targetParticipant =
    findRoundParticipantByAlias({
      id: targetParticipantId,
      roundState: input.roundState,
    }) ?? { participantId: targetParticipantId };
  const distanceEdge = getDistanceEdgeBetweenParticipantAliases({
    participantA: input.encounterParticipant,
    participantB: targetParticipant,
    state: input.roundState.distanceState,
  });
  const weaponTemplate = findAttackWeaponTemplate({
    participant: input.scenarioParticipant,
    phaseWeaponName: input.phaseWeaponName,
    resolvedEquipmentState: input.resolvedEquipmentState,
  });
  const preferredDistances = getWeaponPreferredDistances(weaponTemplate ?? {});

  if (!distanceEdge || preferredDistances.length === 0) {
    return undefined;
  }

  return {
    actualDistance: distanceEdge.distance,
    phase: input.phase,
    preferredDistances,
    sourceActionId: input.actionId,
    weaponName: weaponTemplate?.name ?? input.phaseWeaponName,
  };
}

export function projectCombatActionGeneratedModifiers(input: {
  actionId?: string;
  combatContext: ScenarioParticipantCombatContext;
  encounterParticipant?: EncounterSession["participants"][number];
  phaseContexts?: CombatRoundPhaseContexts;
  phaseWeaponNames?: Partial<Record<PhaseKey, string | undefined>>;
  resolvedEquipmentState?: EquipmentFeatureState;
  roundState?: CombatRoundState;
  scenarioParticipant?: ScenarioParticipant;
  secondaryActionId?: string;
}): ScenarioParticipantCombatContext {
  const distanceModifiers = getCombatDeclarationAttackPhases({
    actionId: input.actionId,
    secondaryActionId: input.secondaryActionId,
  })
    .map((phase) =>
      buildDistanceModifierInput({
        actionId: input.actionId,
        encounterParticipant: input.encounterParticipant,
        phase,
        phaseContexts: input.phaseContexts,
        phaseWeaponName: input.phaseWeaponNames?.[phase],
        resolvedEquipmentState: input.resolvedEquipmentState,
        roundState: input.roundState,
        scenarioParticipant: input.scenarioParticipant,
      }),
    )
    .filter(
      (entry): entry is CombatActionGeneratedDistanceModifierInput => entry !== undefined,
    );

  return applyCombatActionGeneratedModifiers({
    actionId: input.actionId,
    combatContext: input.combatContext,
    distanceModifiers,
  });
}
