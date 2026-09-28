"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SkillReferenceModel, SkillReferenceTab } from "@/lib/skills/skillReferenceModel";
import {
  GroupInspector,
  SkillInspector,
  SocietyInspector,
  WithdrawnGroupInspector,
} from "./ReferenceInspectors";
import { ProfessionInspector } from "./ProfessionInspector";
import { CatalogueTable, ReferenceLinkView } from "./ReferenceParts";
import { RulesContent } from "./RulesContent";
import {
  accessLabel,
  earliestAccessIndex,
  groupTraining,
  professionTraining,
  rangeLabel,
  readerProse,
} from "@/lib/skills/referenceCatalogue";
import {
  destinationFromHash,
  hashFor,
  referenceTabs,
  type Destination,
} from "./referenceNavigation";
import styles from "./skillsReference.module.css";

const ALL = "all";

export function SkillReferenceContent({
  model,
  admin = false,
  initialTab = "skills",
}: {
  model: SkillReferenceModel;
  admin?: boolean;
  initialTab?: SkillReferenceTab;
}) {
  const initial = destinationFromHash();
  const [activeTab, setActiveTab] = useState<SkillReferenceTab>(initial?.tab ?? initialTab);
  const [selectedSkill, setSelectedSkill] = useState(
    initial?.tab === "skills" ? initial.key : model.skills[0]?.key,
  );
  const [selectedGroup, setSelectedGroup] = useState(
    initial?.tab === "groups" ? initial.key : model.learningGroups[0]?.key,
  );
  const [selectedProfession, setSelectedProfession] = useState(
    initial?.tab === "professions" ? initial.key : model.professions[0]?.key,
  );
  const [selectedSociety, setSelectedSociety] = useState(
    initial?.tab === "societies" ? initial.key : model.societies[0]?.key,
  );
  /* Each catalogue owns its own named filters. There is deliberately no generic filter framework. */
  /**
   * `follow` decides what the Inspector shows when the selection and the filter disagree.
   *
   * Editing a filter or search follows the narrowed catalogue, which is what a reader expects while
   * browsing. Selecting a row or following a relationship pins that entry instead, so a destination
   * outside the reader's current filter still opens and the filter itself is left alone.
   */
  const [followSkills, setFollowSkills] = useState(initial?.tab !== "skills" || !initial.key);
  const [followGroups, setFollowGroups] = useState(initial?.tab !== "groups" || !initial.key);
  const [followProfessions, setFollowProfessions] = useState(
    initial?.tab !== "professions" || !initial.key,
  );
  const [followSocieties, setFollowSocieties] = useState(
    initial?.tab !== "societies" || !initial.key,
  );
  const [skillSearch, setSkillSearch] = useState("");
  const [skillType, setSkillType] = useState(ALL);
  const [skillCategory, setSkillCategory] = useState(ALL);
  const [skillStat, setSkillStat] = useState(ALL);
  const [skillRoute, setSkillRoute] = useState(ALL);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupChoices, setGroupChoices] = useState(ALL);
  const [groupUse, setGroupUse] = useState(ALL);
  const [groupLevel, setGroupLevel] = useState(ALL);
  const [professionSearch, setProfessionSearch] = useState("");
  const [professionLevel, setProfessionLevel] = useState(ALL);
  const [professionBand, setProfessionBand] = useState(ALL);
  const [professionReach, setProfessionReach] = useState(ALL);
  const [societySearch, setSocietySearch] = useState("");
  const [societyLevel, setSocietyLevel] = useState(ALL);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const focusDetail = useRef(false);
  const tabList = useRef<HTMLDivElement>(null);

  /**
   * Section 9.11: following a relationship must not gratuitously clear the reader's context, so this
   * changes the selection and the tab only. Search and filter state survive the traversal and the
   * return, and the selected entry is resolved against the whole catalogue so a target outside the
   * current filter still opens.
   */
  function applyDestination(destination: Destination, focus: boolean) {
    setActiveTab(destination.tab);
    if (destination.key) {
      if (destination.tab === "skills") {
        setSelectedSkill(destination.key);
        setFollowSkills(false);
      }
      if (destination.tab === "groups") {
        setSelectedGroup(destination.key);
        setFollowGroups(false);
      }
      if (destination.tab === "professions") {
        setSelectedProfession(destination.key);
        setFollowProfessions(false);
      }
      if (destination.tab === "societies") {
        setSelectedSociety(destination.key);
        setFollowSocieties(false);
      }
    }
    focusDetail.current = focus;
  }
  function navigate(destination: Destination, focus = true) {
    applyDestination(destination, focus);
    const hash = hashFor(destination);
    if (window.location.hash !== hash) window.location.hash = hash;
  }
  useEffect(() => {
    const restore = () => {
      const destination = destinationFromHash();
      if (destination) applyDestination(destination, false);
    };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  useEffect(() => {
    if (focusDetail.current) {
      focusDetail.current = false;
      detailHeading.current?.focus();
    }
  }, [activeTab, selectedSkill, selectedGroup, selectedProfession, selectedSociety]);

  const specializationIds = useMemo(
    () =>
      new Set(
        model.skills.filter((skill) => skill.type === "Specialization").map((skill) => skill.id),
      ),
    [model.skills],
  );
  const skillAccess = useMemo(
    () => earliestAccessIndex(model.access, (cell) => cell.reachableCompetencyIds),
    [model.access],
  );
  const groupAccess = useMemo(
    () => earliestAccessIndex(model.access, (cell) => cell.availableGroupIds),
    [model.access],
  );
  const pathAccess = useMemo(
    () => earliestAccessIndex(model.access, (cell) => cell.validPathIds),
    [model.access],
  );
  const groupCounts = useMemo(
    () =>
      new Map(
        model.learningGroups.map((group) => [
          group.id,
          groupTraining(group, (id) => specializationIds.has(id)),
        ]),
      ),
    [model.learningGroups, specializationIds],
  );
  const professionCounts = useMemo(
    () => new Map(model.professions.map((row) => [row.id, professionTraining(row, model)])),
    [model],
  );
  const categories = useMemo(
    () => [...new Set(model.skills.map((skill) => skill.category))].sort(),
    [model.skills],
  );
  const stats = useMemo(
    () => [...new Set(model.skills.flatMap((skill) => skill.linkedStats))].sort(),
    [model.skills],
  );
  const authoredLevels = useMemo(
    () => model.access.societyLevels.filter((level) => level <= model.access.authoredCeiling),
    [model.access],
  );

  /* ------------------------------------------------------------------ Skills */
  const filteredSkills = useMemo(() => {
    const query = skillSearch.trim().toLowerCase();
    return model.skills.filter((skill) => {
      if (skillType !== ALL && skill.type !== skillType) return false;
      if (skillCategory !== ALL && skill.category !== skillCategory) return false;
      if (skillStat !== ALL && !skill.linkedStats.includes(skillStat)) return false;
      const groups = new Set(skill.groups.map((group) => group.id)).size;
      if (skillRoute === "grouped" && groups === 0) return false;
      if (skillRoute === "groupless" && groups > 0) return false;
      if (skillRoute === "direct" && skill.directRoutes.length === 0) return false;
      return [skill.name, skill.description, skill.type, skill.category, ...skill.linkedStats]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [model.skills, skillType, skillCategory, skillStat, skillRoute, skillSearch]);

  /* --------------------------------------------------------- Learning Groups */
  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    return model.learningGroups.filter((group) => {
      const counts = groupCounts.get(group.id)!;
      if (groupChoices === "with" && counts.trainingChoices === 0) return false;
      if (groupChoices === "without" && counts.trainingChoices > 0) return false;
      if (groupUse === "used" && counts.professionRoutes === 0) return false;
      if (groupUse === "unused" && counts.professionRoutes > 0) return false;
      if (groupLevel !== ALL) {
        const access = groupAccess.get(group.id);
        if (!access || access.societyLevel > Number(groupLevel)) return false;
      }
      return [
        group.name,
        readerProse(group.readerContent, group.description).summary,
        ...group.fixedSkills.map((item) => item.name),
        ...group.selectionSlots.flatMap((slot) => slot.candidates.map((item) => item.name)),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    model.learningGroups,
    groupCounts,
    groupAccess,
    groupChoices,
    groupUse,
    groupLevel,
    groupSearch,
  ]);

  /* ------------------------------------------------------------- Professions */
  const filteredProfessions = useMemo(() => {
    const query = professionSearch.trim().toLowerCase();
    const bandOrder = model.access.socialBands.map((band) => band.id);
    return model.professions.filter((profession) => {
      const training = professionCounts.get(profession.id)!;
      const access = pathAccess.get(profession.id);
      if (professionLevel !== ALL && (!access || access.societyLevel > Number(professionLevel)))
        return false;
      if (
        professionBand !== ALL &&
        (!access || bandOrder.indexOf(access.socialBand) > bandOrder.indexOf(professionBand))
      )
        return false;
      if (professionReach !== ALL && training.effectiveBaseSkills.min < Number(professionReach))
        return false;
      return [
        profession.name,
        readerProse(profession.readerContent, "").summary,
        ...profession.routes.map((route) => route.label),
        ...profession.coreAlternatives.map((route) => route.label),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    model.professions,
    model.access.socialBands,
    professionCounts,
    pathAccess,
    professionLevel,
    professionBand,
    professionReach,
    professionSearch,
  ]);

  /* --------------------------------------------------------------- Societies */
  const filteredSocieties = useMemo(() => {
    const query = societySearch.trim().toLowerCase();
    return model.societies.filter((society) => {
      if (societyLevel !== ALL && society.level !== Number(societyLevel)) return false;
      return [society.name, society.description, ...society.civilizations.map((row) => row.name)]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [model.societies, societyLevel, societySearch]);

  const byKey = <T extends { id: string; key: string }>(rows: T[], wanted?: string) =>
    rows.find((row) => row.key === wanted || row.id === wanted);
  const resolve = <T extends { id: string; key: string }>(
    all: T[],
    filtered: T[],
    wanted: string | undefined,
    follow: boolean,
  ) =>
    (follow ? (filtered[0] ?? byKey(all, wanted)) : (byKey(all, wanted) ?? filtered[0])) ?? all[0];
  const skill = resolve(model.skills, filteredSkills, selectedSkill, followSkills);
  const withdrawn = model.withdrawnGroups.find((group) => group.id === selectedGroup);
  const group = resolve(model.learningGroups, filteredGroups, selectedGroup, followGroups);
  const profession = resolve(
    model.professions,
    filteredProfessions,
    selectedProfession,
    followProfessions,
  );
  const society = resolve(model.societies, filteredSocieties, selectedSociety, followSocieties);
  const outsideFilter = (rows: { key: string }[], selected?: { key: string }) =>
    selected && rows.length > 0 && !rows.some((row) => row.key === selected.key) ? (
      <p className={styles.scopeNote}>
        This entry is outside the current filter, which has been kept as you left it.
      </p>
    ) : null;

  const accessFor = (
    entry: { societyLevel: number; socialBand: string; bandName: string } | undefined,
  ) => accessLabel(model.access, entry);
  const levelOptions = authoredLevels.map((level) => (
    <option key={level} value={String(level)}>
      Level {level} or earlier
    </option>
  ));

  return (
    <section className={`${styles.page} ${admin ? styles.adminPage : ""}`}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>
          {admin ? "Admin competency reference" : "Player and Game Master reference"}
        </p>
        <h1>Skills and training</h1>
        <p>
          Explore the Skills, Learning Groups, Professions, and societies of Glantri, and the routes
          through which training becomes available.
        </p>
      </header>
      <div
        aria-label="Skill reference sections"
        className={styles.tabs}
        ref={tabList}
        role="tablist"
      >
        {referenceTabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-controls={`panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
            onClick={() => navigate({ tab: tab.id }, false)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? referenceTabs.length - 1
                    : (index + (event.key === "ArrowRight" ? 1 : -1) + referenceTabs.length) %
                      referenceTabs.length;
              navigate({ tab: referenceTabs[next]!.id }, false);
              tabList.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "skills" && (
        <div id="panel-skills" role="tabpanel" aria-labelledby="tab-skills">
          <div className={styles.filters}>
            <label>
              <span>Search</span>
              <input
                aria-label="Search Skills, languages, and writing"
                type="search"
                value={skillSearch}
                onChange={(event) => {
                  setSkillSearch(event.target.value);
                  setFollowSkills(true);
                }}
              />
            </label>
            <label>
              <span>Type</span>
              <select
                aria-label="Competency type"
                value={skillType}
                onChange={(event) => {
                  setSkillType(event.target.value);
                  setFollowSkills(true);
                }}
              >
                <option value={ALL}>All types</option>
                {["Skill", "Specialization", "Spoken language", "Written tradition"].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Category</span>
              <select
                aria-label="Competency category"
                value={skillCategory}
                onChange={(event) => {
                  setSkillCategory(event.target.value);
                  setFollowSkills(true);
                }}
              >
                <option value={ALL}>All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/-/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Linked Stat</span>
              <select
                aria-label="Linked Stat"
                value={skillStat}
                onChange={(event) => {
                  setSkillStat(event.target.value);
                  setFollowSkills(true);
                }}
              >
                <option value={ALL}>Any Stat</option>
                {stats.map((stat) => (
                  <option key={stat}>{stat}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Training route</span>
              <select
                aria-label="Training route"
                value={skillRoute}
                onChange={(event) => {
                  setSkillRoute(event.target.value);
                  setFollowSkills(true);
                }}
              >
                <option value={ALL}>Any route</option>
                <option value="grouped">Taught by a Learning Group</option>
                <option value="direct">Has a direct Profession route</option>
                <option value="groupless">No Learning Group route</option>
              </select>
            </label>
          </div>
          <CatalogueTable
            caption={`${filteredSkills.length} of ${model.skills.length} competencies`}
            columns={[
              { key: "type", label: "Type" },
              { key: "category", label: "Category" },
              { key: "stats", label: "Linked Stats" },
              { key: "groups", label: "Learning Groups" },
              { key: "direct", label: "Direct routes" },
              { key: "access", label: "Available from" },
            ]}
            rows={filteredSkills.map((row) => ({
              key: row.key,
              name: row.name,
              cells: [
                row.type,
                row.category.replace(/-/g, " "),
                row.linkedStats.join(" / "),
                new Set(row.groups.map((entry) => entry.id)).size,
                row.directRoutes.length,
                accessFor(skillAccess.get(row.id)),
              ],
            }))}
            selectedKey={skill?.key}
            onSelect={(key) => navigate({ tab: "skills", key })}
            empty="No competency matches this search and filter."
          />
          {outsideFilter(filteredSkills, skill)}
          {skill && (
            <SkillInspector
              skill={skill}
              model={model}
              navigate={navigate}
              heading={detailHeading}
            />
          )}
        </div>
      )}

      {activeTab === "groups" && (
        <div id="panel-groups" role="tabpanel" aria-labelledby="tab-groups">
          <div className={styles.filters}>
            <label>
              <span>Search</span>
              <input
                aria-label="Search Learning Groups or members"
                type="search"
                value={groupSearch}
                onChange={(event) => {
                  setGroupSearch(event.target.value);
                  setFollowGroups(true);
                }}
              />
            </label>
            <label>
              <span>Taught choices</span>
              <select
                aria-label="Taught choices"
                value={groupChoices}
                onChange={(event) => {
                  setGroupChoices(event.target.value);
                  setFollowGroups(true);
                }}
              >
                <option value={ALL}>Any curriculum</option>
                <option value="with">Offers a taught choice</option>
                <option value="without">Fixed curriculum only</option>
              </select>
            </label>
            <label>
              <span>Profession use</span>
              <select
                aria-label="Profession use"
                value={groupUse}
                onChange={(event) => {
                  setGroupUse(event.target.value);
                  setFollowGroups(true);
                }}
              >
                <option value={ALL}>Any use</option>
                <option value="used">Used by a Profession</option>
                <option value="unused">Not used by a Profession</option>
              </select>
            </label>
            <label>
              <span>Available from</span>
              <select
                aria-label="Availability by Society Level"
                value={groupLevel}
                onChange={(event) => {
                  setGroupLevel(event.target.value);
                  setFollowGroups(true);
                }}
              >
                <option value={ALL}>Any Society Level</option>
                {levelOptions}
              </select>
            </label>
          </div>
          <CatalogueTable
            caption={`${filteredGroups.length} of ${model.learningGroups.length} Learning Groups`}
            columns={[
              { key: "fixed", label: "Fixed Skills" },
              { key: "choices", label: "Taught choices" },
              { key: "specializations", label: "Specializations" },
              { key: "professions", label: "Profession routes" },
              { key: "access", label: "Available from" },
            ]}
            rows={filteredGroups.map((row) => {
              const counts = groupCounts.get(row.id)!;
              return {
                key: row.key,
                name: row.name,
                cells: [
                  counts.fixedBaseSkills,
                  counts.trainingChoices,
                  counts.specializations,
                  counts.professionRoutes,
                  accessFor(groupAccess.get(row.id)),
                ],
              };
            })}
            selectedKey={withdrawn ? undefined : group?.key}
            onSelect={(key) => navigate({ tab: "groups", key })}
            empty="No Learning Group matches this search and filter."
          />
          <p className={styles.scopeNote}>
            {model.readerContentCoverage.groups.published} of{" "}
            {model.readerContentCoverage.groups.canonical} Learning Groups have a published full
            description
            {model.readerContentCoverage.groups.awaiting > 0
              ? `. The remaining ${model.readerContentCoverage.groups.awaiting} show their short summary and say so.`
              : "."}
          </p>
          {!withdrawn && outsideFilter(filteredGroups, group)}
          {withdrawn ? (
            <WithdrawnGroupInspector
              group={withdrawn}
              model={model}
              navigate={navigate}
              heading={detailHeading}
            />
          ) : (
            group && (
              <GroupInspector
                group={group}
                model={model}
                navigate={navigate}
                heading={detailHeading}
              />
            )
          )}
          {admin && (
            <>
              <details className={styles.groupless}>
                <summary>Audit — retired Learning Groups ({model.withdrawnGroups.length})</summary>
                <ul>
                  {model.withdrawnGroups.map((row) => (
                    <li key={row.id}>
                      <a
                        href={`#group-${row.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate({ tab: "groups", key: row.id });
                        }}
                      >
                        {row.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
              <details className={styles.groupless}>
                <summary>
                  Audit — competencies with no Learning Group ({model.grouplessSkills.length})
                </summary>
                <ul>
                  {model.grouplessSkills.map((row) => (
                    <li key={row.id}>
                      <ReferenceLinkView item={row} tab="skills" navigate={navigate} />
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
      )}

      {activeTab === "professions" && (
        <div id="panel-professions" role="tabpanel" aria-labelledby="tab-professions">
          <div className={styles.filters}>
            <label>
              <span>Search</span>
              <input
                aria-label="Search Professions, tracks, or training"
                type="search"
                value={professionSearch}
                onChange={(event) => {
                  setProfessionSearch(event.target.value);
                  setFollowProfessions(true);
                }}
              />
            </label>
            <label>
              <span>Available from</span>
              <select
                aria-label="Availability by Society Level"
                value={professionLevel}
                onChange={(event) => {
                  setProfessionLevel(event.target.value);
                  setFollowProfessions(true);
                }}
              >
                <option value={ALL}>Any Society Level</option>
                {levelOptions}
              </select>
            </label>
            <label>
              <span>Open to Social Band</span>
              <select
                aria-label="Open to Social Band"
                value={professionBand}
                onChange={(event) => {
                  setProfessionBand(event.target.value);
                  setFollowProfessions(true);
                }}
              >
                <option value={ALL}>Any Social Band</option>
                {model.access.socialBands.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Training reach</span>
              <select
                aria-label="Training reach"
                value={professionReach}
                onChange={(event) => {
                  setProfessionReach(event.target.value);
                  setFollowProfessions(true);
                }}
              >
                <option value={ALL}>Any breadth</option>
                <option value="8">8 or more base Skills</option>
                <option value="10">10 or more base Skills</option>
                <option value="12">12 or more base Skills</option>
              </select>
            </label>
          </div>
          <CatalogueTable
            caption={`${filteredProfessions.length} of ${model.professions.length} Professions`}
            columns={[
              { key: "core", label: "Core routes" },
              { key: "routes", label: "Training routes" },
              { key: "base", label: "Effective base Skills" },
              { key: "specializations", label: "Specializations" },
              { key: "access", label: "Available from" },
            ]}
            rows={filteredProfessions.map((row) => {
              const training = professionCounts.get(row.id)!;
              return {
                key: row.key,
                name: row.name,
                cells: [
                  training.coreAlternatives.length,
                  training.totalTrainingRoutes,
                  rangeLabel(training.effectiveBaseSkills),
                  rangeLabel(training.effectiveSpecializations),
                  accessFor(pathAccess.get(row.id)),
                ],
              };
            })}
            selectedKey={profession?.key}
            onSelect={(key) => navigate({ tab: "professions", key })}
            empty="No Profession matches this search and filter."
          />
          <p className={styles.scopeNote}>
            Effective base Skills follow the settled counting rules: each Skill once, only what a
            taught choice actually grants, and no unselected alternative.
          </p>
          {outsideFilter(filteredProfessions, profession)}
          {profession && (
            <ProfessionInspector
              profession={profession}
              model={model}
              navigate={navigate}
              heading={detailHeading}
            />
          )}
        </div>
      )}

      {activeTab === "societies" && (
        <div id="panel-societies" role="tabpanel" aria-labelledby="tab-societies">
          <div className={styles.filters}>
            <label>
              <span>Search</span>
              <input
                aria-label="Search Societies and civilizations"
                type="search"
                value={societySearch}
                onChange={(event) => {
                  setSocietySearch(event.target.value);
                  setFollowSocieties(true);
                }}
              />
            </label>
            <label>
              <span>Society Level</span>
              <select
                aria-label="Society Level"
                value={societyLevel}
                onChange={(event) => {
                  setSocietyLevel(event.target.value);
                  setFollowSocieties(true);
                }}
              >
                <option value={ALL}>Any Society Level</option>
                {model.access.societyLevels.map((level) => (
                  <option key={level} value={String(level)}>
                    Level {level}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <CatalogueTable
            caption={`${filteredSocieties.length} of ${model.societies.length} Societies`}
            columns={[
              { key: "level", label: "Society Level" },
              { key: "groups", label: "Learning Groups" },
              { key: "paths", label: "Profession paths" },
              { key: "band", label: "Social Band affects access" },
            ]}
            rows={filteredSocieties.map((row) => {
              const cells = model.access.cells.filter((cell) => cell.societyLevel === row.level);
              const authored = row.level <= model.access.authoredCeiling;
              const span = (values: number[]) =>
                Math.min(...values) === Math.max(...values)
                  ? String(Math.min(...values))
                  : `${Math.min(...values)}–${Math.max(...values)}`;
              const groups = cells.map((cell) => cell.availableGroupIds.length);
              const paths = cells.map((cell) => cell.validPathIds.length);
              return {
                key: row.key,
                name: row.name,
                cells: [
                  row.level,
                  authored ? span(groups) : "Not yet authored",
                  authored ? span(paths) : "Not yet authored",
                  authored ? (new Set(groups).size > 1 ? "Yes" : "No") : "Not yet authored",
                ],
              };
            })}
            selectedKey={society?.key}
            onSelect={(key) => navigate({ tab: "societies", key })}
            empty="No Society matches this search and filter."
          />
          {outsideFilter(filteredSocieties, society)}
          {society && <SocietyInspector society={society} model={model} heading={detailHeading} />}
        </div>
      )}

      {activeTab === "rules" && (
        <div id="panel-rules" role="tabpanel" aria-labelledby="tab-rules">
          <RulesContent ceiling={model.authoredCeiling} heading={detailHeading} />
        </div>
      )}
    </section>
  );
}
