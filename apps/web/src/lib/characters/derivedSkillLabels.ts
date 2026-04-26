export function formatDerivedSkillSourceLabel(input: {
  sourceSkillName?: string;
  sourceType?: "explicit" | "melee-cross-training";
}): string | undefined {
  if (!input.sourceSkillName || !input.sourceType) {
    return undefined;
  }

  if (input.sourceType === "melee-cross-training") {
    return `Cross-trained from ${input.sourceSkillName}`;
  }

  return `Derived from ${input.sourceSkillName}`;
}
