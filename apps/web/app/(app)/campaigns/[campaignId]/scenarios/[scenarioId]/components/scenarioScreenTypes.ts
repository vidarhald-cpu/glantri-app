import type {
  CampaignRosterEntry,
  ReusableEntity,
  ScenarioParticipant
} from "@glantri/domain";

export type ScenarioParticipantTypeFilter =
  | "all"
  | "pc"
  | "npc"
  | "temporary"
  | "monster"
  | "other";

export type ScenarioControllerFilter = "all" | "players" | "gms";

export interface ScenarioParticipantTypeFilterOption {
  id: ScenarioParticipantTypeFilter;
  label: string;
}

export interface ScenarioRosterCandidate {
  civilizationLabel: string;
  controllerFilter: ScenarioControllerFilter;
  controllerLabel: string;
  existingParticipant?: ScenarioParticipant;
  name: string;
  professionLabel: string;
  rosterEntry: CampaignRosterEntry;
  skillGroups: string[];
  sourceKind: string;
  typeFilter: ScenarioParticipantTypeFilter;
  typeLabel: string;
}

export interface TemplateSource {
  entity: ReusableEntity;
  label: string;
}
