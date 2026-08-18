import {
  buildLiveCombatModifierContributionProjection,
  combatSkillContestPreviewSchema,
  type CombatSkillContestPreview,
  type CombatEffectsState,
  type CombatObservationRelationship,
  type ScenarioParticipantCombatContext,
  type SkillDefinition,
} from "@glantri/domain";
import {
  resolveCombatFeintSkillPreview,
  resolveCombatFeintSkillProfile,
  type CharacterSheetSummary,
} from "@glantri/rules-engine";

export function buildFeintSkillPreview(input: {
  readonly build?: unknown;
  readonly combatContext?: ScenarioParticipantCombatContext;
  readonly combatEffects?: CombatEffectsState;
  readonly content?: Parameters<typeof resolveCombatFeintSkillProfile>[0]["content"];
  readonly currentInitiativeGroupId?: string;
  readonly encounterId: string;
  readonly method: "movement" | "weapon";
  readonly observationRelationships?: readonly CombatObservationRelationship[];
  readonly participantId: string;
  readonly roundNumber: number;
  readonly sheetSummary?: CharacterSheetSummary;
  readonly skill?: SkillDefinition;
  readonly targetParticipantId?: string;
}): CombatSkillContestPreview {
  const contestType = input.method === "movement" ? "movement_feint" : "weapon_feint";
  if (!input.content || !input.skill || !input.build) {
    return combatSkillContestPreviewSchema.parse({
      completeness: "unavailable",
      contestType,
      missingFacts: ["participant_skill_profile"],
      participantId: input.participantId,
      role:
        input.method === "movement"
          ? "movement_feint_initiator"
          : "weapon_feint_initiator",
      schemaVersion: 1,
    });
  }

  const profile = resolveCombatFeintSkillProfile({
    build: input.build,
    characteristic: "dex",
    content: input.content,
    participantId: input.participantId,
    sheetSummary: input.sheetSummary,
    skill: input.skill,
  });
  if (profile.sourceQuality === "missing") {
    return combatSkillContestPreviewSchema.parse({
      completeness: "unavailable",
      contestType,
      missingFacts: ["governing_characteristic"],
      participantId: input.participantId,
      role:
        input.method === "movement"
          ? "movement_feint_initiator"
          : "weapon_feint_initiator",
      schemaVersion: 1,
    });
  }

  const projection = buildLiveCombatModifierContributionProjection({
    combatContext: input.combatContext,
    combatEffects: input.combatEffects,
    currentInitiativeGroupId: input.currentInitiativeGroupId,
    currentRound: input.roundNumber,
    encounterId: input.encounterId,
    ownerParticipantId: input.participantId,
  });
  const preview = resolveCombatFeintSkillPreview({
    context: {
      actionId: "feint_attack",
      encounterId: input.encounterId,
      opponentParticipantId: input.targetParticipantId,
      ownerParticipantId: input.participantId,
      phase: "phase1",
      rollType: input.method === "movement" ? "feint_dodge" : "feint_weapon",
      roundNumber: input.roundNumber,
      skillId: profile.skillId,
      step: "phase_1_actions",
    },
    governingStatValue: profile.avgStats,
    method: input.method,
    modifierContributions: projection.contributions,
    observationRelationshipIds: new Set(
      (input.observationRelationships ?? []).map((relationship) => relationship.id),
    ),
    participantId: input.participantId,
    skill: { id: profile.skillId, label: profile.skillName, totalXp: profile.totalXP },
    unknownSkillPenalty: profile.unknownSkillPenalty,
  });

  return profile.sourceQuality === "snapshot"
    ? combatSkillContestPreviewSchema.parse({
        ...preview,
        completeness: "partial",
        missingFacts: [...preview.missingFacts, "full_character_profile"],
      })
    : preview;
}
function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value).replace("-", "−");
}

export function FeintSkillPreview({ preview }: { preview: CombatSkillContestPreview }) {
  if (
    preview.completeness === "unavailable" ||
    !preview.governingStat ||
    !preview.skill ||
    preview.baseSkill === undefined ||
    preview.preDieTotal === undefined
  ) {
    return <div>Effective skill unavailable</div>;
  }

  const characteristic = preview.governingStat.id?.toUpperCase() ?? preview.governingStat.label;
  const profileAdjustment =
    preview.baseSkill - preview.governingStat.value - preview.skill.totalXp;
  return (
    <div aria-label="Feint effective skill preview" style={{ display: "grid", gap: "0.15rem" }}>
      <strong>{preview.skill.label}</strong>
      <div>
        {characteristic} {preview.governingStat.value} + XP {preview.skill.totalXp}
        {profileAdjustment === 0 ? "" : ` ${formatSigned(profileAdjustment)}`} = {preview.baseSkill}
      </div>
      {preview.totalPercentageAdjustment ? (
        <div title={preview.percentageContributions.map((entry) => entry.label).join(", ")}>
          Modifiers {formatSigned(preview.totalPercentageAdjustment)}% → {formatSigned(
            preview.derivedIntegerAdjustment ?? 0,
          )}
        </div>
      ) : null}
      <div>
        Effective skill {preview.preDieTotal}
        {preview.completeness === "partial" ? " (partial)" : ""}
      </div>
    </div>
  );
}
