import { type CanonicalContent } from "@glantri/content";

import { uniqueSorted, formatSocietyEntryLabel } from "./_helpers";
import { buildProfessionAdminRows } from "./professions";
import { buildSocietyAdminRows } from "./societies";

export interface ProfessionAccessRow {
  id: string;
  name: string;
  societyEntries: string[];
  skillGroups: string[];
  skills: string[];
}

export interface SocietyAccessRow {
  id: string;
  professions: string[];
  skillGroups: string[];
  skills: string[];
  societyEntry: string;
}

export function buildProfessionAccessRows(content: CanonicalContent): ProfessionAccessRow[] {
  const professionRows = buildProfessionAdminRows(content);

  return professionRows.map((profession) => ({
    id: profession.id,
    name: profession.name,
    societyEntries: profession.allowedSocietyEntries,
    skillGroups: profession.grantedSkillGroups,
    skills: uniqueSorted(
      profession.reachableGroupSkills.concat(profession.directlyGrantedSkills)
    )
  }));
}

export function buildSocietyAccessRows(content: CanonicalContent): SocietyAccessRow[] {
  return buildSocietyAdminRows(content).map((societyRow) => ({
    id: societyRow.id,
    professions: societyRow.reachableProfessions,
    skillGroups: societyRow.directSkillGroups,
    skills: uniqueSorted(
      societyRow.effectiveProfessionSkills.concat(societyRow.directOnlySkills)
    ),
    societyEntry: formatSocietyEntryLabel(
      societyRow.society,
      societyRow.societyLevel,
      societyRow.societyClassName
    )
  }));
}
