import type { PilotSkillContentRelease } from "@glantri/domain";

export interface PilotSkillContentReleaseValidation {
  diagnostics: readonly { code: string; message: string; path: string }[];
  releaseId: string;
  valid: boolean;
}

const STABLE_ID = /^[a-z][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$/;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function serializePilotSkillContentReleasePayload(
  release: PilotSkillContentRelease,
): string {
  const { manifest: _manifest, ...payload } = release;
  return JSON.stringify(canonicalize(payload));
}

export function validatePilotSkillContentRelease(
  release: PilotSkillContentRelease,
): PilotSkillContentReleaseValidation {
  const diagnostics: Array<{ code: string; message: string; path: string }> = [];
  const add = (code: string, path: string, message: string) =>
    diagnostics.push({ code, message, path });

  const collections = {
    accessExceptions: release.accessExceptions,
    backgrounds: release.backgrounds,
    characters: release.characters,
    competencies: release.competencies,
    histories: release.histories,
    professions: release.professions,
    profiles: release.profiles,
    relationships: release.relationships,
    specializations: release.specializations,
  } as const;
  const allRecords = Object.entries(collections).flatMap(([collection, records]) =>
    records.map((record, index) => ({ collection, index, record })),
  );
  const recordById = new Map<string, { collection: string; index: number }>();

  for (const { collection, index, record } of allRecords) {
    const path = `${collection}[${index}].id`;
    if (!STABLE_ID.test(record.id)) {
      add("PILOT_CONTENT_INVALID_STABLE_ID", path, `Invalid stable ID "${record.id}".`);
    }
    const existing = recordById.get(record.id);
    if (existing) {
      add(
        "PILOT_CONTENT_DUPLICATE_ID",
        path,
        `ID "${record.id}" duplicates ${existing.collection}[${existing.index}].`,
      );
    } else {
      recordById.set(record.id, { collection, index });
    }
  }

  for (const [collection, expected] of Object.entries(release.manifest.counts)) {
    const actual = collections[collection as keyof typeof collections].length;
    if (actual !== expected) {
      add(
        "PILOT_CONTENT_MANIFEST_COUNT_MISMATCH",
        `manifest.counts.${collection}`,
        `Manifest declares ${expected}; release contains ${actual}.`,
      );
    }
  }

  const competencyIds = new Set(release.competencies.map(({ id }) => id));
  const specializationIds = new Set(release.specializations.map(({ id }) => id));
  const competenceIds = new Set([...competencyIds, ...specializationIds]);
  const relationshipIds = new Set(release.relationships.map(({ id }) => id));
  const historyById = new Map(release.histories.map((history) => [history.id, history]));
  const backgroundById = new Map(
    release.backgrounds.map((background) => [background.id, background]),
  );
  const professionIds = new Set(release.professions.map(({ id }) => id));
  const profileIds = new Set(release.profiles.map(({ id }) => id));
  const exceptionIds = new Set(release.accessExceptions.map(({ id }) => id));

  release.histories.forEach((history, historyIndex) => {
    const allMembers = [
      ...history.fixedCompetencyIds,
      ...history.selectionSlots.flatMap((slot) => slot.candidateCompetencyIds),
    ];
    allMembers.forEach((id) => {
      if (!competenceIds.has(id)) {
        add(
          "PILOT_CONTENT_UNKNOWN_HISTORY_MEMBER",
          `histories[${historyIndex}]`,
          `Unknown competency "${id}".`,
        );
      }
    });
    history.selectionSlots.forEach((slot, slotIndex) => {
      if (slot.chooseCount < 1 || slot.chooseCount > slot.candidateCompetencyIds.length) {
        add(
          "PILOT_CONTENT_INVALID_SELECTION_SLOT",
          `histories[${historyIndex}].selectionSlots[${slotIndex}]`,
          `Selection slot "${slot.id}" has an impossible choose count.`,
        );
      }
    });
  });

  release.relationships.forEach((relationship, index) => {
    if (
      !competenceIds.has(relationship.sourceCompetencyId) ||
      !competenceIds.has(relationship.targetCompetencyId)
    ) {
      add(
        "PILOT_CONTENT_UNKNOWN_RELATIONSHIP_ENDPOINT",
        `relationships[${index}]`,
        `Relationship "${relationship.id}" has an unknown endpoint.`,
      );
    }
    if (
      relationship.direction !== "source-to-target" ||
      relationship.reverseEdge !== "not-inferred"
    ) {
      add(
        "PILOT_CONTENT_RELATIONSHIP_DIRECTION_INVALID",
        `relationships[${index}]`,
        `Relationship "${relationship.id}" must be explicit, directional, and have no inferred reverse.`,
      );
    }
  });

  release.specializations.forEach((specialization, index) => {
    specialization.prerequisites.forEach(({ competencyId }) => {
      if (!competencyIds.has(competencyId)) {
        add(
          "PILOT_CONTENT_UNKNOWN_SPECIALIZATION_PREREQUISITE",
          `specializations[${index}]`,
          `Specialization "${specialization.id}" references unknown prerequisite "${competencyId}".`,
        );
      }
    });
    if (specialization.transfer.kind === "explicit-relationships") {
      specialization.transfer.relationshipIds.forEach((id) => {
        if (!relationshipIds.has(id)) {
          add(
            "PILOT_CONTENT_UNKNOWN_SPECIALIZATION_TRANSFER",
            `specializations[${index}].transfer`,
            `Unknown relationship "${id}".`,
          );
        }
      });
    }
  });

  release.backgrounds.forEach((background, index) => {
    const language = release.competencies.find(
      ({ id }) => id === background.startingSpokenLanguageId,
    );
    if (language?.kind !== "spoken-language") {
      add(
        "PILOT_CONTENT_BACKGROUND_LANGUAGE_NOT_SPOKEN",
        `backgrounds[${index}]`,
        `Background "${background.id}" must grant one spoken-language identity.`,
      );
    }
    if (!profileIds.has(background.profileId)) {
      add(
        "PILOT_CONTENT_UNKNOWN_BACKGROUND_PROFILE",
        `backgrounds[${index}]`,
        `Unknown profile "${background.profileId}".`,
      );
    }
  });

  release.profiles.forEach((profile, index) => {
    [
      ...profile.normalRoutes.flatMap(({ competencyIds }) => competencyIds),
      ...profile.overrides.flatMap(({ competencyIds }) => competencyIds),
    ].forEach((id) => {
      if (!competenceIds.has(id)) {
        add(
          "PILOT_CONTENT_UNKNOWN_PROFILE_COMPETENCY",
          `profiles[${index}]`,
          `Profile "${profile.id}" references unknown competency "${id}".`,
        );
      }
    });
  });

  release.professions.forEach((profession, index) => {
    if (profession.mechanics !== "none") {
      add(
        "PILOT_CONTENT_PROFESSION_MECHANICS_FORBIDDEN",
        `professions[${index}].mechanics`,
        `Profession "${profession.id}" must remain mechanically inert.`,
      );
    }
    [...profession.suggestedCompetencyIds].forEach((id) => {
      if (!competenceIds.has(id))
        add(
          "PILOT_CONTENT_UNKNOWN_PROFESSION_SUGGESTION",
          `professions[${index}]`,
          `Unknown suggested competency "${id}".`,
        );
    });
    [...profession.suggestedHistoryIds].forEach((id) => {
      if (!historyById.has(id))
        add(
          "PILOT_CONTENT_UNKNOWN_PROFESSION_HISTORY",
          `professions[${index}]`,
          `Unknown suggested history "${id}".`,
        );
    });
  });

  release.accessExceptions.forEach((exception, index) => {
    if (!profileIds.has(exception.profileId) || exception.grantsCompetence !== 0) {
      add(
        "PILOT_CONTENT_ACCESS_EXCEPTION_INVALID",
        `accessExceptions[${index}]`,
        `Access exception "${exception.id}" needs a known profile and must grant zero competence.`,
      );
    }
    exception.competencyIds.forEach((id) => {
      if (!competenceIds.has(id))
        add(
          "PILOT_CONTENT_UNKNOWN_EXCEPTION_COMPETENCY",
          `accessExceptions[${index}]`,
          `Unknown exception competency "${id}".`,
        );
    });
    exception.historyIds.forEach((id) => {
      if (!historyById.has(id))
        add(
          "PILOT_CONTENT_UNKNOWN_EXCEPTION_HISTORY",
          `accessExceptions[${index}]`,
          `Unknown exception history "${id}".`,
        );
    });
  });

  release.characters.forEach((character, index) => {
    const background = backgroundById.get(character.backgroundId);
    if (!background || !professionIds.has(character.professionId)) {
      add(
        "PILOT_CONTENT_CHARACTER_CONTEXT_UNKNOWN",
        `characters[${index}]`,
        `Character "${character.id}" needs a known profession and background.`,
      );
    }
    character.accessExceptionIds.forEach((id) => {
      if (!exceptionIds.has(id))
        add(
          "PILOT_CONTENT_CHARACTER_EXCEPTION_UNKNOWN",
          `characters[${index}]`,
          `Unknown access exception "${id}".`,
        );
    });
    [...character.directAcquisitions, ...character.specializationAcquisitions].forEach(
      ({ competencyId }) => {
        if (!competenceIds.has(competencyId))
          add(
            "PILOT_CONTENT_CHARACTER_ACQUISITION_UNKNOWN",
            `characters[${index}]`,
            `Unknown acquired competency "${competencyId}".`,
          );
      },
    );
    character.histories.forEach((selection, selectionIndex) => {
      const history = historyById.get(selection.historyId);
      if (
        !history ||
        selection.level < history.intensity.minimum ||
        selection.level > history.intensity.maximum
      ) {
        add(
          "PILOT_CONTENT_CHARACTER_HISTORY_INVALID",
          `characters[${index}].histories[${selectionIndex}]`,
          `Unknown history or invalid level for "${selection.historyId}".`,
        );
        return;
      }
      const selected = new Set(selection.selectedCompetencyIds);
      const expectedSelectedCount = history.selectionSlots.reduce(
        (sum, slot) => sum + slot.chooseCount,
        0,
      );
      const candidates = new Set(
        history.selectionSlots.flatMap((slot) => slot.candidateCompetencyIds),
      );
      if (
        selected.size !== expectedSelectedCount ||
        [...selected].some((id) => !candidates.has(id))
      ) {
        add(
          "PILOT_CONTENT_CHARACTER_HISTORY_CHOICES_INVALID",
          `characters[${index}].histories[${selectionIndex}]`,
          `Resolved choices for "${selection.historyId}" do not match its authored slots.`,
        );
      }
    });
    if (background && character.startingSpokenLanguageRanks !== 11) {
      add(
        "PILOT_CONTENT_STARTING_LANGUAGE_VALUE_INVALID",
        `characters[${index}].startingSpokenLanguageRanks`,
        `Pilot fixtures with Education at most 11 must use the accepted starting value 11.`,
      );
    }
  });

  if (
    !release.manifest.payloadDigest.startsWith("sha256:") ||
    release.manifest.payloadDigest.length !== 71
  ) {
    add(
      "PILOT_CONTENT_DIGEST_INVALID",
      "manifest.payloadDigest",
      "Manifest digest must be a complete sha256 value.",
    );
  }

  diagnostics.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.path.localeCompare(right.path) ||
      left.message.localeCompare(right.message),
  );
  return { diagnostics, releaseId: release.id, valid: diagnostics.length === 0 };
}
