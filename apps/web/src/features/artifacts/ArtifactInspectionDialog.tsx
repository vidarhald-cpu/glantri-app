"use client";

import { FullViewportInspection } from "./inspection/FullViewportInspection";
import { MediaInspectionViewport } from "./inspection/MediaInspectionViewport";

export interface InspectedArtifact {
  alt: string;
  kind: "image" | "document";
  /** Artifact kind as players and the GM speak about it, such as `map`. */
  artifactKind: string;
  /** Who this Artifact is already shared with, when the viewer may know. */
  audience?: string;
  src: string;
  title: string;
}

/**
 * Full-viewport inspection of one Artifact, keeping its identity visible and
 * showing only what the surrounding library already shows.
 */
export function ArtifactInspectionDialog({
  artifact,
  onExit,
}: {
  artifact: InspectedArtifact;
  onExit: () => void;
}) {
  return (
    <FullViewportInspection
      exitLabel="Close inspection"
      onExit={onExit}
      presentation="dialog"
      subtitle={
        artifact.audience
          ? `${artifact.artifactKind} · ${artifact.audience}`
          : artifact.artifactKind
      }
      title={artifact.title}
    >
      <MediaInspectionViewport
        alt={artifact.alt}
        kind={artifact.kind}
        mediaLabel="Artifact"
        src={artifact.src}
      />
    </FullViewportInspection>
  );
}
