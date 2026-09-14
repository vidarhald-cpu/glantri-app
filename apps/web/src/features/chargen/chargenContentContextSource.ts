import type { CanonicalContent } from "@glantri/content";

export interface ChargenCatalogueIdentity {
  projectionVersion: number;
  sourceId: string;
}

export interface ChargenCatalogueProjection {
  content: CanonicalContent;
  identity: ChargenCatalogueIdentity;
}

export interface LegacySocietyChargenAcquisitionContext {
  kind: "legacy-society";
  socialBand?: 1 | 2 | 3 | 4;
  societyId?: string;
}

export interface UnboundGeneralChargenAcquisitionContext {
  kind: "unbound";
  scope: "general";
}

export type ChargenAcquisitionContext =
  | LegacySocietyChargenAcquisitionContext
  | UnboundGeneralChargenAcquisitionContext;

export interface ChargenContentContextSource {
  acquisitionContext: ChargenAcquisitionContext;
  catalogue: ChargenCatalogueProjection;
}

export interface LegacyCanonicalChargenContentSource extends ChargenContentContextSource {
  acquisitionContext: LegacySocietyChargenAcquisitionContext;
}

/** Future adapter context only; current legacy content remains Society/Social-Band bound. */
export const UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT = {
  kind: "unbound",
  scope: "general",
} as const satisfies UnboundGeneralChargenAcquisitionContext;

const LEGACY_CANONICAL_CHARGEN_CATALOGUE_IDENTITY = {
  projectionVersion: 1,
  sourceId: "legacy-canonical",
} as const satisfies ChargenCatalogueIdentity;

export function createLegacyCanonicalChargenSource(
  content: CanonicalContent,
): LegacyCanonicalChargenContentSource {
  return {
    acquisitionContext: { kind: "legacy-society" },
    catalogue: {
      content,
      identity: LEGACY_CANONICAL_CHARGEN_CATALOGUE_IDENTITY,
    },
  };
}

export function bindLegacySocietyChargenContext(
  source: LegacyCanonicalChargenContentSource,
  selection: {
    socialBand?: 1 | 2 | 3 | 4;
    societyId?: string;
  },
): LegacyCanonicalChargenContentSource {
  return {
    ...source,
    acquisitionContext: {
      kind: "legacy-society",
      socialBand: selection.socialBand,
      societyId: selection.societyId,
    },
  };
}

export function getLegacySocietyChargenContext(
  source: ChargenContentContextSource,
): LegacySocietyChargenAcquisitionContext | undefined {
  return source.acquisitionContext.kind === "legacy-society"
    ? source.acquisitionContext
    : undefined;
}
