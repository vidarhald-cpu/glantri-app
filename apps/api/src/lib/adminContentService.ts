import {
  defaultCanonicalContent,
  type CanonicalContent,
  pilotSkillContentReleaseV1,
  validateCanonicalContent
} from "@glantri/content";
import { ContentService } from "@glantri/database";
import type {
  AdminSkillReferenceResponse,
  AdminSkillReferenceSnapshot,
  RevisionedContentSnapshot
} from "@glantri/shared";

const CANONICAL_CONTENT_SNAPSHOT_KEY = "canonical-content";

function toPilotSummaryText(value: string, limit = 110): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trimEnd()}…`;
}

function splitWrittenTraditionBinding(id: string): {
  scriptId: string;
  spokenLanguageId: string;
} {
  const [, language, script] = /^written:([^:]+):(.+)$/.exec(id) ?? [];

  if (!language || !script) {
    return { scriptId: `script:${id}`, spokenLanguageId: `spoken:${id}` };
  }

  return {
    scriptId: `script:${script}`,
    spokenLanguageId: `spoken:${language}`
  };
}

function buildDerivedScripts(
  records: Array<{
    id: string;
    domainId: string;
    name: string;
    description: string;
  }>
): Array<{
  domainId: string;
  description: string;
  familyIds: readonly string[];
  id: string;
  name: string;
}> {
  const scriptsById = new Map<
    string,
    { domainId: string; description: string; familyIds: string[] }
  >();

  for (const written of records) {
    const split = /^written:([^:]+):([^:]+)$/.exec(written.id);

    if (!split) {
      continue;
    }

    const [, language, scriptName] = split;
    const scriptId = `script:${scriptName}`;
    const existing = scriptsById.get(scriptId);
    const familyIds = existing?.familyIds ?? [];

    familyIds.push(`language-family:${language}`);
    familyIds.push(`script:${scriptName}`);

    scriptsById.set(scriptId, {
      domainId: written.domainId,
      description: `Binding for ${written.name}`,
      familyIds
    });
  }

  return [...scriptsById.entries()].map(([id, script]) => ({
    description: script.description,
    domainId: script.domainId,
    familyIds: script.familyIds,
    id,
    name: id.replace(/^script:/, "Script ")
  }));
}

function formatPilotDomainLabel(domainId: string): string {
  const suffix = domainId.replace(/^domain:/, "");
  return suffix
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapCompetencyDomain(domainId: string, fallback: string): string {
  if (domainId.startsWith("domain:")) {
    return domainId;
  }

  return fallback;
}

function buildSkillReferenceSnapshot(label: "candidate" | "canonical"): AdminSkillReferenceSnapshot {
  const status: AdminSkillReferenceSnapshot["status"] = label === "canonical" ? "canonical" : "proposal";
  const compatibility = {
    characterMigrationReviewRequired: false,
    classification: "presentation-only" as const,
    rationale:
      "This read-only projection is for Admin reference review only and is not used for runtime skill activation."
  };

  const competencyMap = new Map(
    pilotSkillContentReleaseV1.competencies.map((competency) => [competency.id, competency])
  );
  const domainsById = new Map<string, string>();

  const trackDomain = (domainId: string): string => {
    const normalizedDomainId = mapCompetencyDomain(domainId, "domain:skills");
    const name = formatPilotDomainLabel(normalizedDomainId);
    if (!domainsById.has(normalizedDomainId)) {
      domainsById.set(normalizedDomainId, name);
    }
    return normalizedDomainId;
  };

  const competencies = [
    ...pilotSkillContentReleaseV1.competencies.map((competency) => ({
      acquisitionWeight: undefined,
      description: competency.description,
      domainId: trackDomain(competency.domainId),
      id: competency.id,
      kind: competency.kind,
      name: competency.name,
      prerequisites: [],
      recordVersion: pilotSkillContentReleaseV1.manifest.payloadDigest,
      shortDescription: toPilotSummaryText(competency.description),
      shortLabel: competency.name,
      status,
      provenance: pilotSkillContentReleaseV1.provenance,
      transfer: undefined,
      weight: competency.weight,
      writtenLanguageBinding:
        competency.kind === "written-tradition" ? splitWrittenTraditionBinding(competency.id) : undefined,
      taskEnvelope: {
        coreTasks: ["Apply the referenced Pilot competency semantics."],
        limits: ["Use this projection for documentation and review only."],
        methods: ["Use direct projected values as the canonical source for this slice."],
        useGuidance: "Do not use this view for live content mutation."
      }
    })),
    ...pilotSkillContentReleaseV1.specializations.map((specialization) => {
      const parentCompetencyId = specialization.prerequisites[0]?.competencyId;
      const parentDomainId =
        parentCompetencyId
          ? mapCompetencyDomain(
              competencyMap.get(parentCompetencyId)?.domainId ?? "",
              "domain:skills"
            )
          : "domain:skills";

      return {
        acquisitionWeight: specialization.acquisitionWeight,
        description: specialization.description,
        domainId: trackDomain(parentDomainId),
        id: specialization.id,
        kind: "specialization" as const,
        name: specialization.name,
        parentCompetencyId,
        prerequisites: specialization.prerequisites,
        recordVersion: pilotSkillContentReleaseV1.manifest.payloadDigest,
        shortDescription: toPilotSummaryText(specialization.description),
        shortLabel: specialization.name,
        status,
        provenance: pilotSkillContentReleaseV1.provenance,
        transfer: specialization.transfer,
        weight: specialization.acquisitionWeight,
        taskEnvelope: {
          coreTasks: ["Apply the specialization when prerequisites are satisfied."],
          limits: ["Use this projection for documentation and review only."],
          methods: ["Apply specialization transfer and prerequisite logic as documented."],
          useGuidance: "Do not edit runtime relationships from this view yet."
        },
        writtenLanguageBinding: undefined
      };
    })
  ];

  const scripts = buildDerivedScripts(
    pilotSkillContentReleaseV1.competencies
      .filter((competency) => competency.kind === "written-tradition")
      .map((competency) => ({
        description: competency.description,
        domainId: competency.domainId,
        id: competency.id,
        name: competency.name
      }))
  );

  const domains = [...domainsById.entries()].map(([id, name]) => ({
    description: `Pilot competency domain exposure for ${name}.`,
    id,
    name
  }));

  const histories = pilotSkillContentReleaseV1.histories.map((history) => ({
    context: history.context,
    fixedCompetencyIds: history.fixedCompetencyIds,
    id: history.id,
    selectionSlots: history.selectionSlots.map((slot) => ({
      candidateCompetencyIds: slot.candidateCompetencyIds,
      chooseCount: slot.chooseCount,
      id: slot.id,
      label: slot.label
    })),
    name: history.name
  }));

  const profiles = pilotSkillContentReleaseV1.profiles.map((profile) => ({
    accessBand: profile.accessBand,
    developmentStage: profile.developmentStage,
    id: profile.id,
    name: profile.name,
    normalRoutes: profile.normalRoutes.map((route) => ({
      accessBand: route.accessBand,
      competencyIds: route.competencyIds,
      description: route.description,
      id: route.id
    })),
    overrides: profile.overrides.map((override) => ({
      attributionId: override.attributionId,
      availability: override.availability,
      competencyIds: override.competencyIds,
      explanation: override.explanation
    }))
  }));

  const relationships = pilotSkillContentReleaseV1.relationships.map((relationship) => ({
    id: relationship.id,
    rationale: relationship.rationale,
    sourceCompetencyId: relationship.sourceCompetencyId,
    strength: relationship.strength,
    targetCompetencyId: relationship.targetCompetencyId
  }));

  const accessExceptions = pilotSkillContentReleaseV1.accessExceptions.map((exception) => ({
    basis: exception.basis,
    competencyIds: exception.competencyIds,
    explanation: exception.explanation,
    grantsCompetence: exception.grantsCompetence,
    historyIds: exception.historyIds,
    id: exception.id,
    profileId: exception.profileId
  }));

  return {
    compatibility,
    contentVersion: pilotSkillContentReleaseV1.contentVersion,
    id: pilotSkillContentReleaseV1.id,
    manifest: {
      counts: {
        accessExceptions: accessExceptions.length,
        competencies: competencies.length,
        domains: domains.length,
        histories: histories.length,
        profiles: profiles.length,
        relationships: relationships.length,
        scripts: scripts.length
      },
      packageDigest: pilotSkillContentReleaseV1.manifest.payloadDigest,
      serialization: pilotSkillContentReleaseV1.manifest.serialization
    },
    provenance: pilotSkillContentReleaseV1.provenance,
    records: {
      accessExceptions,
      competencies,
      domains,
      histories,
      profiles,
      relationships,
      scripts
    },
    rulesVersion: pilotSkillContentReleaseV1.rulesVersion,
    schemaVersion: pilotSkillContentReleaseV1.schemaVersion,
    status,
    title: pilotSkillContentReleaseV1.title
  };
}

export class CanonicalContentValidationError extends Error {}

export class CanonicalContentRevisionConflictError extends Error {
  constructor(public readonly current: RevisionedContentSnapshot<CanonicalContent>) {
    super("Canonical content revision conflict.");
  }
}

export class CanonicalContentService {
  constructor(
    private readonly contentService: ContentService = new ContentService(),
    private readonly snapshotKey = CANONICAL_CONTENT_SNAPSHOT_KEY
  ) {}

  async getCanonicalContent(): Promise<RevisionedContentSnapshot<CanonicalContent>> {
    const snapshot = await this.contentService.findByKey(this.snapshotKey);

    if (!snapshot) {
      return {
        content: defaultCanonicalContent,
        revision: 0,
        source: "seed"
      };
    }

    return {
      content: validateCanonicalContent(snapshot.content),
      revision: snapshot.revision,
      source: "database",
      updatedAt: snapshot.updatedAt
    };
  }

  async getSkillReference(): Promise<AdminSkillReferenceResponse> {
    return {
      canonical: buildSkillReferenceSnapshot("canonical"),
      candidate: buildSkillReferenceSnapshot("candidate")
    };
  }

  async saveCanonicalContent(input: {
    content: unknown;
    expectedRevision: number;
  }): Promise<RevisionedContentSnapshot<CanonicalContent>> {
    let validatedContent: CanonicalContent;

    try {
      validatedContent = validateCanonicalContent(input.content);
    } catch (error) {
      throw new CanonicalContentValidationError(
        error instanceof Error ? error.message : "Canonical content validation failed."
      );
    }

    const saveResult = await this.contentService.saveWithOptimisticRevision({
      content: validatedContent,
      expectedRevision: input.expectedRevision,
      key: this.snapshotKey
    });

    if (saveResult.status === "conflict") {
      throw new CanonicalContentRevisionConflictError(await this.getCanonicalContent());
    }

    return {
      content: validateCanonicalContent(saveResult.record.content),
      revision: saveResult.record.revision,
      source: "database",
      updatedAt: saveResult.record.updatedAt
    };
  }
}
