import type { CharacterProgression } from "@glantri/domain";
import type { CanonicalContentShape } from "./primaryAllocation/_helpers";

/** Profession-scoped purchase alternatives; direct competencies and other families are unaffected. */
export function getExclusiveProfessionGroupErrors(input: {
  content: Pick<CanonicalContentShape, "professions" | "skillGroups">;
  professionId?: string;
  progression: CharacterProgression;
  purchasingGroupId?: string;
}): string[] {
  const profession = input.content.professions.find((p) => p.id === input.professionId);
  const purchased = new Set(
    input.progression.skillGroups
      .filter((g) => g.ranks > 0 || g.primaryRanks > 0 || g.secondaryRanks > 0)
      .map((g) => g.groupId),
  );
  if (input.purchasingGroupId) purchased.add(input.purchasingGroupId);
  const name = (id: string) => input.content.skillGroups.find((g) => g.id === id)?.name ?? id;
  return (profession?.exclusiveLearningGroupPairs ?? [])
    .filter(([a, b]) => purchased.has(a) && purchased.has(b))
    .map(
      ([a, b]) =>
        `${name(a)} and ${name(b)} are alternative training routes for ${profession!.name}; choose one.`,
    );
}
