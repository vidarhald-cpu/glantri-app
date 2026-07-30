export function resolveHistoricalFeintSkillLabel(input: {
  skillId?: string;
  skills: readonly { id: string; name: string }[];
  specializations: readonly { id: string; name: string }[];
}): string | undefined {
  if (!input.skillId) return undefined;
  return (
    input.skills.find((skill) => skill.id === input.skillId)?.name ??
    input.specializations.find((skill) => skill.id === input.skillId)?.name ??
    "Recorded skill unavailable"
  );
}
