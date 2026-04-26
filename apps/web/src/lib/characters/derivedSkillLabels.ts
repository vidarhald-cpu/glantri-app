export function formatDerivedSkillSourceLabel(input: {
  sourceSkillName?: string;
  sourceType?:
    | "explicit"
    | "melee-cross-training"
    | "specialization-bridge-child"
    | "specialization-bridge-parent";
}): string | undefined {
  if (!input.sourceSkillName || !input.sourceType) {
    return undefined;
  }

  if (input.sourceType === "melee-cross-training") {
    return `Cross-trained from ${input.sourceSkillName}`;
  }

  if (input.sourceType === "specialization-bridge-parent") {
    return `Specialized from ${input.sourceSkillName}`;
  }

  return `Derived from ${input.sourceSkillName}`;
}
