import { resolveEffectiveItemTemplate } from "@glantri/domain";
import {
  AnyEquipmentTemplateSchema,
  type ArmorTemplate,
  type CombatModifierResolution,
  type CombatRoundAttackOpportunity,
  type ScenarioParticipant,
  type WeaponAttackMode,
  type WeaponTemplate,
} from "@glantri/domain";
import {
  defaultCombatAllocationState,
  getDerivedObValue,
  getWorkbookCombinedRowParry,
  isCombatCompetencyRefusal,
  getWorkbookShieldRowParry,
  getWorkbookWeaponRowParry,
} from "@glantri/rules-engine";

import { resolveCanonicalParticipantCalculationContext } from "./combatParticipantCalculationResolution";

export interface CompleteCanonicalAttackOffense {
  authority: "canonical_scenario_state";
  baseOb: number;
  completeness: "complete";
  dynamicRawPercentage: number;
  equipmentLoadoutRevision?: string;
  participantId: string;
  preOpponentOb: number;
  sourceSnapshotId: string;
}

export interface CompleteCanonicalParryBase {
  authority: "canonical_scenario_state";
  combinedParryScore: number;
  completeness: "complete";
  equipmentLoadoutRevision?: string;
  mainHandParryScore?: number;
  offHandParryScore?: number;
  participantId: string;
  parrySourceLabel: string;
  sourceSnapshotId: string;
  usedMainHand: boolean;
  usedOffHand: boolean;
}

export interface IncompleteCanonicalManualCalculation {
  authority: "canonical_scenario_state";
  completeness: "partial";
  missingFacts: string[];
  participantId: string;
  sourceSnapshotId: string;
}

export type CanonicalAttackOffense =
  | CompleteCanonicalAttackOffense
  | IncompleteCanonicalManualCalculation;
export type CanonicalParryBase = CompleteCanonicalParryBase | IncompleteCanonicalManualCalculation;

function incomplete(input: {
  missingFacts: string[];
  participantId: string;
  sourceSnapshotId: string;
}): IncompleteCanonicalManualCalculation {
  return {
    authority: "canonical_scenario_state",
    completeness: "partial",
    missingFacts: [...new Set(input.missingFacts)].sort(),
    participantId: input.participantId,
    sourceSnapshotId: input.sourceSnapshotId,
  };
}

function resolveOpportunityWeapon(input: {
  opportunity: CombatRoundAttackOpportunity;
  participant: ScenarioParticipant;
}):
  | {
      armorTemplate: ArmorTemplate | null;
      attackMode: WeaponAttackMode;
      context: Extract<
        ReturnType<typeof resolveCanonicalParticipantCalculationContext>,
        { completeness: "complete" }
      >;
      weaponTemplate: WeaponTemplate;
    }
  | IncompleteCanonicalManualCalculation {
  const context = resolveCanonicalParticipantCalculationContext(input.participant);
  if (context.completeness !== "complete") return context;
  const opportunity = input.opportunity;
  if (!opportunity.weaponSourceId || !opportunity.weaponTemplateId) {
    return incomplete({
      missingFacts: ["weapon_source_identity"],
      participantId: input.participant.id,
      sourceSnapshotId: context.sourceSnapshotId,
    });
  }
  const sourceItem = opportunity.weaponInstanceId
    ? context.itemsById.get(opportunity.weaponInstanceId)
    : context.itemsById.get(opportunity.weaponSourceId);
  if (opportunity.weaponSourceSlot !== "virtual" && !sourceItem) {
    return incomplete({
      missingFacts: ["weapon_source_identity"],
      participantId: input.participant.id,
      sourceSnapshotId: context.sourceSnapshotId,
    });
  }
  if (
    sourceItem &&
    (sourceItem.templateId !== opportunity.weaponTemplateId ||
      sourceItem.id !== (opportunity.weaponInstanceId ?? opportunity.weaponSourceId))
  ) {
    return incomplete({
      missingFacts: ["weapon_source_identity"],
      participantId: input.participant.id,
      sourceSnapshotId: context.sourceSnapshotId,
    });
  }
  const parsedTemplate = AnyEquipmentTemplateSchema.safeParse(
    context.templateValues[opportunity.weaponTemplateId],
  );
  if (!parsedTemplate.success || parsedTemplate.data.category !== "weapon") {
    return incomplete({
      missingFacts: ["weapon_template"],
      participantId: input.participant.id,
      sourceSnapshotId: context.sourceSnapshotId,
    });
  }
  const attackMode = parsedTemplate.data.attackModes?.find(
    (mode) => mode.id === opportunity.attackModeId,
  );
  if (!attackMode) {
    return incomplete({
      missingFacts: ["attack_mode"],
      participantId: input.participant.id,
      sourceSnapshotId: context.sourceSnapshotId,
    });
  }
  return {
    armorTemplate: context.armorTemplate,
    attackMode,
    context,
    weaponTemplate: parsedTemplate.data,
  };
}

/** Resolves the exact pre-opponent attack OB from canonical build, loadout, and live modifiers. */
export function resolveCanonicalAttackOffense(input: {
  attackerResolution: CombatModifierResolution;
  opponentResolution: CombatModifierResolution;
  opportunity: CombatRoundAttackOpportunity;
  participant: ScenarioParticipant;
}): CanonicalAttackOffense {
  const weapon = resolveOpportunityWeapon(input);
  if ("missingFacts" in weapon) return weapon;
  const dynamicRawPercentage = input.attackerResolution.total - input.opponentResolution.total;
  const baseOb = getDerivedObValue({
    allocationInputs: defaultCombatAllocationState,
    armorTemplate: weapon.armorTemplate,
    characterInputs: weapon.context.characterInputs,
    mode: weapon.attackMode,
    template: weapon.weaponTemplate,
  });
  const preOpponentOb = getDerivedObValue({
    allocationInputs: {
      ...defaultCombatAllocationState,
      situationalModifiers: {
        ...defaultCombatAllocationState.situationalModifiers,
        attack: dynamicRawPercentage,
      },
    },
    armorTemplate: weapon.armorTemplate,
    characterInputs: weapon.context.characterInputs,
    mode: weapon.attackMode,
    template: weapon.weaponTemplate,
  });
  // A mode with no authored competency reference is refused outright: it is neither guessed from
  // the weapon's skill name nor resolved as a missing skill (#512 P1.3).
  if (isCombatCompetencyRefusal(baseOb) || isCombatCompetencyRefusal(preOpponentOb)) {
    return incomplete({
      missingFacts: ["attack_mode_competency"],
      participantId: input.participant.id,
      sourceSnapshotId: weapon.context.sourceSnapshotId,
    });
  }
  if (typeof baseOb !== "number" || typeof preOpponentOb !== "number") {
    return incomplete({
      missingFacts: ["attack_offense"],
      participantId: input.participant.id,
      sourceSnapshotId: weapon.context.sourceSnapshotId,
    });
  }
  return {
    authority: "canonical_scenario_state",
    baseOb,
    completeness: "complete",
    dynamicRawPercentage,
    equipmentLoadoutRevision: weapon.context.equipmentLoadoutRevision,
    participantId: input.participant.id,
    preOpponentOb,
    sourceSnapshotId: weapon.context.sourceSnapshotId,
  };
}

function parryScore(value: string | number): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/** Resolves selected Parry source totals from the canonical build and active loadout. */
export function resolveCanonicalParryBase(input: {
  participant: ScenarioParticipant;
  usedMainHand?: boolean;
  usedOffHand?: boolean;
}): CanonicalParryBase {
  const context = resolveCanonicalParticipantCalculationContext(input.participant);
  if (context.completeness !== "complete") return context;
  const usedMainHand = input.usedMainHand ?? true;
  const usedOffHand = input.usedOffHand ?? true;
  if (!usedMainHand && !usedOffHand) {
    return incomplete({
      missingFacts: ["parry_source_selection"],
      participantId: input.participant.id,
      sourceSnapshotId: context.sourceSnapshotId,
    });
  }
  const mainHandParryScore = context.primaryWeaponTemplate
    ? parryScore(
        getWorkbookWeaponRowParry({
          armorTemplate: context.armorTemplate,
          characterInputs: context.characterInputs,
          template: context.primaryWeaponTemplate,
        }),
      )
    : undefined;
  const offHandParryScore = context.readyShieldTemplate
    ? parryScore(
        getWorkbookShieldRowParry({
          armorTemplate: context.armorTemplate,
          characterInputs: context.characterInputs,
          shieldTemplate: context.readyShieldTemplate,
        }),
      )
    : context.secondaryWeaponTemplate
      ? parryScore(
          getWorkbookWeaponRowParry({
            armorTemplate: context.armorTemplate,
            characterInputs: context.characterInputs,
            template: context.secondaryWeaponTemplate,
          }),
        )
      : undefined;
  const combinedParryScore = usedMainHand
    ? usedOffHand
      ? parryScore(
          getWorkbookCombinedRowParry({
            armorTemplate: context.armorTemplate,
            characterInputs: context.characterInputs,
            offHandShieldTemplate: context.readyShieldTemplate,
            primaryWeaponTemplate: context.primaryWeaponTemplate,
            secondaryWeaponTemplate: context.secondaryWeaponTemplate,
          }),
        )
      : mainHandParryScore
    : offHandParryScore;
  if (combinedParryScore === undefined) {
    return incomplete({
      missingFacts: ["parry_base"],
      participantId: input.participant.id,
      sourceSnapshotId: context.sourceSnapshotId,
    });
  }
  const mainLabel = context.primaryWeaponTemplate?.name;
  const offLabel = context.readyShieldTemplate?.name ?? context.secondaryWeaponTemplate?.name;
  return {
    authority: "canonical_scenario_state",
    combinedParryScore,
    completeness: "complete",
    equipmentLoadoutRevision: context.equipmentLoadoutRevision,
    mainHandParryScore: usedMainHand ? mainHandParryScore : undefined,
    offHandParryScore: usedOffHand ? offHandParryScore : undefined,
    participantId: input.participant.id,
    parrySourceLabel:
      usedMainHand && usedOffHand
        ? [mainLabel, offLabel].filter(Boolean).join(" + ")
        : usedMainHand
          ? (mainLabel ?? "Main hand")
          : (offLabel ?? "Off hand"),
    sourceSnapshotId: context.sourceSnapshotId,
    usedMainHand,
    usedOffHand,
  };
}

/** Resolves a special Parry from one exact, currently wielded weapon Item. */
export function resolveCanonicalWeaponParryBase(input: {
  expectedItemRevision: string;
  expectedTemplateId: string;
  participant: ScenarioParticipant;
  weaponItemId: string;
}): CanonicalParryBase {
  const context = resolveCanonicalParticipantCalculationContext(input.participant);
  if (context.completeness !== "complete") return context;
  const item = context.itemsById.get(input.weaponItemId);
  const isPrimary = context.loadout?.activePrimaryWeaponItemId === input.weaponItemId;
  const isSecondary = context.loadout?.activeSecondaryWeaponItemId === input.weaponItemId;
  const template = item
    ? resolveEffectiveItemTemplate(item, Object.fromEntries(context.templatesById))
    : undefined;
  if (
    !item ||
    (!isPrimary && !isSecondary) ||
    item.templateId !== input.expectedTemplateId ||
    item.revision !== input.expectedItemRevision ||
    item.conditionState !== "intact" ||
    item.storageAssignment?.carryMode !== "equipped" ||
    template?.category !== "weapon"
  ) {
    return incomplete({
      missingFacts: ["parry_source_identity"],
      participantId: input.participant.id,
      sourceSnapshotId: context.sourceSnapshotId,
    });
  }
  const score = parryScore(
    getWorkbookWeaponRowParry({
      armorTemplate: context.armorTemplate,
      characterInputs: context.characterInputs,
      template,
    }),
  );
  if (score === undefined) {
    return incomplete({
      missingFacts: ["parry_base"],
      participantId: input.participant.id,
      sourceSnapshotId: context.sourceSnapshotId,
    });
  }
  return {
    authority: "canonical_scenario_state",
    combinedParryScore: score,
    completeness: "complete",
    equipmentLoadoutRevision: context.equipmentLoadoutRevision,
    mainHandParryScore: isPrimary ? score : undefined,
    offHandParryScore: isSecondary ? score : undefined,
    participantId: input.participant.id,
    parrySourceLabel: template.name,
    sourceSnapshotId: context.sourceSnapshotId,
    usedMainHand: isPrimary,
    usedOffHand: isSecondary,
  };
}
