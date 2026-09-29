import type { ArtifactCommonDto, ArtifactGmDto } from "@glantri/domain";

import { artifactContentUrl, loadArtifacts } from "@/lib/api/localServiceClient";

/**
 * The one boundary between the Situation Artifacts rail and the Artifact data
 * it presents.
 *
 * Player Play V1 OPEN-PPV1-2 settles that the first composition pass presents
 * the **existing player-accessible/shared Artifact set** unchanged. This module
 * therefore adds no filtering, no scope and no visibility semantics of its own:
 * it reads the existing projection and narrows the result to the fields the
 * rail renders. When the later bounded Scenario-/Encounter-relevant filtering
 * capability is authorized, only this module changes.
 */
export interface SituationArtifact {
  altText?: string;
  artifactKind: string;
  contentSrc: string;
  description?: string;
  id: string;
  /** True when the media can be previewed inline and inspected full-viewport. */
  isImage: boolean;
  mediaType?: string;
  title: string;
}

function toSituationArtifact(
  artifact: ArtifactCommonDto | ArtifactGmDto,
  campaignId: string,
): SituationArtifact {
  return {
    ...(artifact.altText ? { altText: artifact.altText } : {}),
    artifactKind: artifact.artifactKind,
    contentSrc: artifactContentUrl(campaignId, artifact.id),
    ...(artifact.description ? { description: artifact.description } : {}),
    id: artifact.id,
    isImage: Boolean(artifact.mediaType?.startsWith("image/")),
    ...(artifact.mediaType ? { mediaType: artifact.mediaType } : {}),
    title: artifact.title,
  };
}

/**
 * Reads the Artifact set this viewer can already access, through the existing
 * unchanged Artifact list projection.
 */
export async function loadSituationArtifacts(campaignId: string): Promise<SituationArtifact[]> {
  const result = await loadArtifacts(campaignId);
  return result.artifacts.map((artifact) => toSituationArtifact(artifact, campaignId));
}
