import type { CanonicalContent, TargetCompetencyCatalogue } from "@glantri/content";
import { createTargetCompetencyProjectionSource } from "@glantri/content";
import {
  type ChargenContentContextSource,
  UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT,
} from "./chargenContentContextSource";
export {
  buildTargetChargenDefinitions,
  buildTargetRuntimeContent,
  getTargetCompetencyActivationBlockers,
  type TargetLinkedStats,
  type TargetCompetency,
  type TargetCompetencyCatalogue,
} from "@glantri/content";
export interface TargetCompetencyChargenSource extends ChargenContentContextSource<TargetCompetencyCatalogue> {
  acquisitionContext: typeof UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT;
  compatibilityContent: CanonicalContent;
}
export function createTargetCompetencyChargenSource(
  compatibilityContent: CanonicalContent,
): TargetCompetencyChargenSource {
  const projection = createTargetCompetencyProjectionSource(compatibilityContent);
  return {
    ...projection,
    acquisitionContext: UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT,
    catalogue: {
      ...projection.catalogue,
      identity: { projectionVersion: 2, sourceId: "competency-content-v2" },
    },
  };
}
