import type {
  CharacterChargenGroupSlotSelection,
  CharacterProgression,
  SkillDefinition,
  SkillGroupDefinition
} from "@glantri/domain";
import { getSkillGroupIds } from "@glantri/domain";

function normalizeGroupSlotSelections(
  selections: CharacterChargenGroupSlotSelection[]
): CharacterChargenGroupSlotSelection[] {
  const normalizedByKey = new Map<string, CharacterChargenGroupSlotSelection>();

  for (const selection of selections) {
    normalizedByKey.set(`${selection.groupId}:${selection.slotId}`, {
      groupId: selection.groupId,
      selectedSkillIds: [...new Set(selection.selectedSkillIds ?? [])],
      slotId: selection.slotId
    });
  }

  return [...normalizedByKey.values()];
}

function hasStructuredMembership(group: SkillGroupDefinition | undefined): boolean {
  return ((group?.skillMemberships?.length ?? 0) > 0) || ((group?.selectionSlots?.length ?? 0) > 0);
}

export function getActiveSkillGroupIds(input: {
  progression: CharacterProgression;
  skill: SkillDefinition;
  skillGroups?: SkillGroupDefinition[];
}): string[] {
  const baseGroupIds = getSkillGroupIds(input.skill);
  const groupById = new Map((input.skillGroups ?? []).map((group) => [group.id, group]));
  const selectedSlots = normalizeGroupSlotSelections(
    input.progression.chargenSelections?.selectedGroupSlots ?? []
  );

  return [...new Set(baseGroupIds.filter((groupId) => {
    const group = groupById.get(groupId);

    if (!hasStructuredMembership(group)) {
      return true;
    }

    const isFixedMember =
      group?.skillMemberships?.some((membership) => membership.skillId === input.skill.id) ?? false;

    if (isFixedMember) {
      return true;
    }

    return (
      group?.selectionSlots?.some((slot) => {
        if (!slot.candidateSkillIds.includes(input.skill.id)) {
          return false;
        }

        const selectedSlot = selectedSlots.find(
          (selection) => selection.groupId === groupId && selection.slotId === slot.id
        );
        const resolvedSelectedSkillIds = (selectedSlot?.selectedSkillIds ?? [])
          .filter((skillId) => slot.candidateSkillIds.includes(skillId))
          .slice(0, slot.chooseCount);

        return resolvedSelectedSkillIds.includes(input.skill.id);
      }) ?? false
    );
  }))];
}
