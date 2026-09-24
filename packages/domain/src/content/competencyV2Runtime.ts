/** The acquisition mechanics projected from canonical Competency Content V2. */
export interface CompetencyV2RouteBound {
  minSocietyLevel?: number;
  minSocialBand?: "L1" | "L2" | "L3" | "L4";
}

export interface CompetencyV2Route extends CompetencyV2RouteBound {
  id: string;
  label: string;
  kind: "group" | "direct";
  groupId?: string;
  skillIds: string[];
  specializationIds: string[];
}

export interface CompetencyV2CoreRoute {
  id: string;
  label: string;
  groupIds: string[];
  skillIds: string[];
  writtenLanguageChoiceCount: number;
}

export interface CompetencyV2Path {
  id: string;
  familyId: string;
  familyCode: string;
  trackId?: string;
  routes: CompetencyV2Route[];
  /** Alternatives: satisfying any one route is sufficient. */
  coreRoutes: CompetencyV2CoreRoute[];
}

export interface CompetencyV2CivilizationLanguage {
  civilizationId: string;
  spokenCompetencyId: string;
  writtenCompetencyId?: string;
}

export interface CompetencyV2Runtime {
  sourceId: "competency-content-v2";
  sourceDigest: string;
  paths: CompetencyV2Path[];
  civilizationLanguages: CompetencyV2CivilizationLanguage[];
  writtenCompetencyIds: string[];
  writtenCompetencyFloors: { competencyId: string; minSocietyLevel: number }[];
  groupBounds: {
    groupId: string;
    minSocietyLevel?: number;
    minSocialBand?: "L1" | "L2" | "L3" | "L4";
  }[];
}
