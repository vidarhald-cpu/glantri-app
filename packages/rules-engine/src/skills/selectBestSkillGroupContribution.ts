export interface SkillGroupContributionCandidate {
  groupId: string;
  groupLevel: number;
  name: string;
  sortOrder: number;
}

export function compareSkillGroupContributionCandidates(
  left: SkillGroupContributionCandidate,
  right: SkillGroupContributionCandidate
): number {
  if (right.groupLevel !== left.groupLevel) {
    return right.groupLevel - left.groupLevel;
  }

  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  const byName = left.name.localeCompare(right.name);

  if (byName !== 0) {
    return byName;
  }

  return left.groupId.localeCompare(right.groupId);
}

export function selectBestSkillGroupContribution(
  candidates: SkillGroupContributionCandidate[]
): SkillGroupContributionCandidate | undefined {
  return [...candidates].sort(compareSkillGroupContributionCandidates)[0];
}
