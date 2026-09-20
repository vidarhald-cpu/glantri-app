"use client";

import { MediaInspectionViewport } from "@/features/artifacts/inspection";

interface ArtifactInspectionViewportProps {
  alt: string;
  src: string;
}

/**
 * Blackboard Artifact inspection. The behaviour lives in the shared,
 * media-agnostic inspection pattern so Maps and other visual material can reuse
 * it without a second viewer.
 */
export function ArtifactInspectionViewport({ alt, src }: ArtifactInspectionViewportProps) {
  return <MediaInspectionViewport alt={alt} mediaLabel="Artifact" src={src} />;
}
