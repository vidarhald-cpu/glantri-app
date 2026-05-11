import { defaultCanonicalContent } from "@glantri/content";
import type { ReusableEntity, ScenarioParticipant } from "@glantri/domain";

import type { ScenarioParticipantTypeFilter } from "./scenarioScreenTypes";

const civilizationNameById = new Map(
  defaultCanonicalContent.civilizations.map((civilization) => [civilization.id, civilization.name])
);
const civilizationNameByName = new Map(
  defaultCanonicalContent.civilizations.map((civilization) => [
    civilization.name.toLowerCase(),
    civilization.name
  ])
);
const civilizationNamesBySocietyId = new Map<string, string[]>();

for (const civilization of defaultCanonicalContent.civilizations) {
  const existingNames = civilizationNamesBySocietyId.get(civilization.linkedSocietyId) ?? [];
  civilizationNamesBySocietyId.set(civilization.linkedSocietyId, [
    ...existingNames,
    civilization.name
  ]);
}

export function formatEntityKind(kind: ReusableEntity["kind"]): string {
  if (kind === "npc") {
    return "NPC";
  }

  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function getCivilizationDisplayName(value?: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return "—";
  }

  const exactCivilizationName =
    civilizationNameById.get(normalizedValue) ??
    civilizationNameByName.get(normalizedValue.toLowerCase());

  if (exactCivilizationName) {
    return exactCivilizationName;
  }

  const societyCivilizationNames = civilizationNamesBySocietyId.get(normalizedValue);

  if (societyCivilizationNames && societyCivilizationNames.length > 0) {
    return societyCivilizationNames.join(" / ");
  }

  return "—";
}

export function readSnapshotMetadata(snapshot: unknown): {
  civilizationLabel?: string;
  professionLabel?: string;
  skillGroups: string[];
} {
  if (!isRecord(snapshot)) {
    return { skillGroups: [] };
  }

  const progression = isRecord(snapshot.progression) ? snapshot.progression : undefined;
  const progressionSkillGroups = Array.isArray(progression?.skillGroups)
    ? progression.skillGroups
        .map((entry) => (isRecord(entry) ? readOptionalString(entry.groupId) : undefined))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return {
    civilizationLabel:
      readOptionalString(snapshot.civilization) ??
      readOptionalString(snapshot.civilizationId) ??
      readOptionalString(snapshot.culture) ??
      readOptionalString(snapshot.societyId) ??
      readOptionalString(snapshot.society),
    professionLabel: readOptionalString(snapshot.profession) ?? readOptionalString(snapshot.professionId),
    skillGroups: [
      ...readStringList(snapshot.skillGroups),
      ...readStringList(snapshot.skillGroupIds),
      ...readStringList(snapshot.trainingPackages),
      ...progressionSkillGroups
    ]
  };
}

export function getScenarioParticipantType(input: {
  characterId?: string;
  entityId?: string;
  role: ScenarioParticipant["role"];
  sourceType: ScenarioParticipant["sourceType"];
}): {
  label: string;
  typeFilter: ScenarioParticipantTypeFilter;
} {
  if (input.role === "player_character" || input.sourceType === "character") {
    return { label: "PC", typeFilter: "pc" };
  }

  if (input.role === "monster") {
    return { label: input.entityId ? "Monster" : "Temporary monster", typeFilter: "monster" };
  }

  if (input.sourceType === "entity" && !input.entityId) {
    return { label: "Temporary actor", typeFilter: "temporary" };
  }

  if (input.role === "npc" || input.role === "enemy" || input.role === "ally") {
    return { label: "NPC", typeFilter: "npc" };
  }

  return { label: "Other", typeFilter: "other" };
}

export function getConcreteParticipantMetadata(participant: ScenarioParticipant): {
  civilizationLabel: string;
  professionLabel: string;
  skillGroups: string[];
  typeFilter: ScenarioParticipantTypeFilter;
  typeLabel: string;
} {
  const participantType = getScenarioParticipantType({
    characterId: participant.characterId,
    entityId: participant.entityId,
    role: participant.role,
    sourceType: participant.sourceType
  });
  const buildMetadata = readSnapshotMetadata(participant.snapshot.build);

  return {
    civilizationLabel: getCivilizationDisplayName(buildMetadata.civilizationLabel),
    professionLabel: buildMetadata.professionLabel ?? "—",
    skillGroups: buildMetadata.skillGroups,
    typeFilter: participantType.typeFilter,
    typeLabel: participantType.label
  };
}

export function formatEventType(value: string): string {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatShortDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month} ${hours}:${minutes}`;
}
