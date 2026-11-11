import {
  AI_INTAKE_PRODUCER,
  artifactPackageSchema,
  parseAiIntakeContext,
  aiIntakeArtifactSuggestionNotes,
  aiIntakeGmNotes,
  aiIntakeObjectGmNotes,
  type AiIntakeContext,
  type AiIntakeEntry,
  type ArtifactPackage,
} from "@glantri/domain";

import { randomId } from "@/lib/browser/randomId";
import {
  deriveArtifactPackageResources,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  mediaTypeFromFile,
  type OrdinaryArtifactDraft,
} from "../artifactPackageDerivation";

export interface IntakeProposalProblem {
  message: string;
}

export interface IntakePlannedEntry {
  entry: AiIntakeEntry;
  file?: File;
}

export interface IntakePlan {
  entries: IntakePlannedEntry[];
  context: AiIntakeContext;
}

const compareFilename = (left: string, right: string) =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

/**
 * Pairs the described entries with the chosen files. Every mismatch is a
 * problem the GM sees; nothing is matched approximately and no entry is
 * silently dropped, because a mispaired file is exactly the copy-paste failure
 * staging exists to catch.
 */
export function planIntake(
  rawContext: string,
  files: File[],
): { ok: false; problems: string[] } | { ok: true; plan: IntakePlan } {
  const parsed = parseAiIntakeContext(rawContext);
  if (!parsed.ok) return { ok: false, problems: parsed.problems };
  const problems: string[] = [];

  if (files.length > MAX_FILES) problems.push("Choose no more than 100 files at a time.");
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) problems.push("The chosen files exceed 100 MiB in total.");
  for (const file of files) {
    if (!mediaTypeFromFile(file))
      problems.push(`“${file.name}” is not a PNG, JPEG, WebP or PDF file.`);
    else if (file.size === 0) problems.push(`“${file.name}” is empty.`);
    else if (file.size > MAX_FILE_BYTES) problems.push(`“${file.name}” is larger than 25 MiB.`);
  }

  const used = new Set<File>();
  const entries: IntakePlannedEntry[] = parsed.context.entries.map((entry) => {
    if (!entry.filename) return { entry };
    const matches = files.filter((file) => compareFilename(file.name, entry.filename!));
    if (matches.length === 0) {
      problems.push(
        `“${entry.title}” names the file “${entry.filename}”, which is not among the chosen files.`,
      );
      return { entry };
    }
    if (matches.length > 1) {
      problems.push(`More than one chosen file is named “${entry.filename}”.`);
      return { entry };
    }
    used.add(matches[0]!);
    return { entry, file: matches[0]! };
  });
  for (const file of files)
    if (!used.has(file))
      problems.push(
        `“${file.name}” was chosen but no entry describes it. Remove it, or describe it.`,
      );

  if (problems.length) return { ok: false, problems };
  return { ok: true, plan: { context: parsed.context, entries } };
}

/**
 * Turns the plan into the staged proposal. The semantic fields come from the
 * context; every technical fact — resource identity, media type, SHA-256 — is
 * derived here from the files by the one shared derivation.
 */
export async function buildIntakeProposal(
  plan: IntakePlan,
): Promise<{ files: Record<string, File>; manifest: ArtifactPackage }> {
  const withFiles = plan.entries.filter((planned): planned is IntakePlannedEntry & { file: File } =>
    Boolean(planned.file),
  );
  const drafts: OrdinaryArtifactDraft[] = withFiles.map((planned, index) => ({
    altText: planned.entry.playerDescription ?? "",
    artifactKind: planned.entry.kind ?? "image",
    description: planned.entry.description ?? "",
    file: planned.file,
    id: `entry-${index + 1}`,
    mediaType: mediaTypeFromFile(planned.file)!,
    title: planned.entry.title,
  }));
  const { files, resources } = await deriveArtifactPackageResources(drafts);

  const artifactIdOf = new Map<AiIntakeEntry, string>();
  const objects: ArtifactPackage["objects"] = [];

  withFiles.forEach((planned, index) => {
    const id = `artifact-${index + 1}`;
    artifactIdOf.set(planned.entry, id);
    // A pure Artifact entry keeps everything the context said about it. When
    // the entry describes a physical object, the generic GM note belongs on the
    // Item below and is not duplicated here merely because a representation
    // exists; only the suggestions about filing and sharing the media — an
    // Artifact concern — stay with the Artifact.
    const notes =
      planned.entry.represents === "artifact"
        ? aiIntakeGmNotes(planned.entry, plan.context.notes)
        : aiIntakeArtifactSuggestionNotes(planned.entry);
    objects.push({
      attachments: [],
      dependencies: [],
      // A pure Artifact carries the reference directly; when the entry
      // describes an object, the Item below owns the relationship instead.
      ...(planned.entry.represents === "artifact" && planned.entry.relatedTo
        ? { relationshipLabel: planned.entry.relatedTo }
        : {}),
      ...(notes ? { gmNotes: notes } : {}),
      id,
      metadata: {
        altText: planned.entry.playerDescription || undefined,
        artifactKind: planned.entry.kind ?? "image",
        description: planned.entry.description || undefined,
        provenanceKind: "user_upload",
        title: planned.entry.title,
      },
      optional: true,
      resourceId: resources[index]!.id,
      type: "Artifact",
    });
  });

  plan.entries
    .filter((planned) => planned.entry.represents === "item")
    .forEach((planned, index) => {
      const attachedId = artifactIdOf.get(planned.entry);
      // Only GM-authored prose reaches the Item. Intake scaffolding — suggested
      // tags, suggested visibility — is never persisted as Item text.
      const notes = aiIntakeObjectGmNotes(planned.entry, plan.context.notes);
      objects.push({
        // A described physical object becomes the canonical Item; the file, if
        // any, becomes its attached representation rather than the object.
        attachments: attachedId ? [{ kind: "local", id: attachedId }] : [],
        dependencies: [],
        ...(planned.entry.relatedTo ? { relationshipLabel: planned.entry.relatedTo } : {}),
        ...(notes ? { gmNotes: notes } : {}),
        id: `item-${index + 1}`,
        itemMetadata: {
          description: planned.entry.description || undefined,
          title: planned.entry.title,
        },
        optional: true,
        type: "Item",
      });
    });

  const manifest = artifactPackageSchema.parse({
    objects,
    packageId: `ai-intake-${randomId()}`,
    producer: AI_INTAKE_PRODUCER,
    resources,
    schemaVersion: 1,
    title:
      plan.entries.length === 1
        ? `AI intake: ${plan.entries[0]!.entry.title}`
        : `AI intake: ${plan.entries.length} entries`,
    version: "1",
  });
  return { files, manifest };
}
