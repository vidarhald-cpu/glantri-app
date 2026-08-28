import type { PilotSkillContentRelease } from "@glantri/domain";

export function getPilotSkillCharacterBuildInput(
  release: PilotSkillContentRelease,
  characterId: string,
) {
  const character = release.characters.find(({ id }) => id === characterId);
  if (!character) throw new Error(`Unknown pilot Character fixture "${characterId}".`);
  const background = release.backgrounds.find(({ id }) => id === character.backgroundId)!;

  return {
    competencies: [
      ...release.competencies.map(({ id, kind, name, weight }) => ({ id, kind, name, weight })),
      ...release.specializations.map((specialization) => ({
        id: specialization.id,
        kind: specialization.kind,
        name: specialization.name,
        specialization: {
          acquisitionWeight: specialization.acquisitionWeight,
          prerequisites: specialization.prerequisites,
        },
      })),
    ],
    directAcquisitions: [...character.directAcquisitions, ...character.specializationAcquisitions],
    grantedAcquisitions: [
      {
        competencyId: background.startingSpokenLanguageId,
        ranks: character.startingSpokenLanguageRanks,
        sourceId: background.id,
        sourceKind: "background" as const,
      },
    ],
    groups: character.histories.map((selection) => {
      const history = release.histories.find(({ id }) => id === selection.historyId)!;
      return {
        competencyIds: [...history.fixedCompetencyIds, ...selection.selectedCompetencyIds],
        id: history.id,
        level: selection.level,
        name: history.name,
      };
    }),
    professionId: character.professionId,
    relationships: release.relationships.map(
      ({ id, sourceCompetencyId, strength, targetCompetencyId }) => ({
        id,
        sourceCompetencyId,
        strength,
        targetCompetencyId,
      }),
    ),
  };
}
