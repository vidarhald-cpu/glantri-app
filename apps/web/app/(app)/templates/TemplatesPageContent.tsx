"use client";

import { useEffect, useMemo, useState } from "react";

import { type CanonicalContent } from "@glantri/content";
import { equipmentTemplates } from "@glantri/content/equipment";
import type {
  GlantriCharacteristicKey,
  ReusableEntity
} from "@glantri/domain";
import {
  glantriCharacteristicLabels,
  glantriCharacteristicOrder
} from "@glantri/domain";
import type { EquipmentTemplate } from "@glantri/domain/equipment";
import { resolveGlantriCharacterStats } from "@glantri/rules-engine";

import {
  createTemplateOnServer,
  loadTemplates,
  updateTemplateOnServer
} from "../../../src/lib/api/localServiceClient";
import { getCampaignActorMetadata } from "../../../src/lib/campaigns/campaignActors";
import { loadCanonicalContent } from "../../../src/lib/content/loadCanonicalContent";
import {
  filterInventoryTemplateOptions,
  type InventoryTemplateFilter
} from "../../../src/features/equipment/inventoryTemplateGroups";
import { getPlayerFacingEquipmentTemplateName } from "../../../src/features/equipment/playerFacingTemplateOptions";
import {
  NPC_ARCHETYPE_SENIORITY_OPTIONS,
  buildHumanoidNpcArchetypeSnapshot,
  createEmptyHumanoidNpcArchetypeDraft,
  getDefaultSkillLevelForRelevance,
  listProfessionsForSociety,
  listSocietyOptions,
  listSuggestedSkills,
  listSuggestedSkillGroupIds,
  loadHumanoidNpcArchetypeDraft,
  parseHumanoidNpcArchetypeTemplate,
  type HumanoidNpcArchetypeDraft,
  type NpcArchetypeSkillRelevance
} from "../../../src/lib/templates/npcArchetypeTemplates";

type TemplateKindFilter = "all" | ReusableEntity["kind"];
type TemplatesPageTab = "create-template" | "library";
type SkillsFilterMode =
  | "selected-groups"
  | "core-skills"
  | "optional-skills"
  | "skill-type"
  | "all-skills";
type ArchetypeStepId =
  | "society"
  | "profession"
  | "skill-groups"
  | "skills"
  | "stats"
  | "gear"
  | "review"
  | "variability";

const ARCHETYPE_STEPS: Array<{ id: ArchetypeStepId; label: string }> = [
  { id: "society", label: "Society" },
  { id: "profession", label: "Profession" },
  { id: "skill-groups", label: "Skill groups" },
  { id: "skills", label: "Skills" },
  { id: "stats", label: "Stats" },
  { id: "gear", label: "Gear" },
  { id: "review", label: "Review" },
  { id: "variability", label: "Variability" }
];

function clampLevel(value: number): number {
  return Math.max(0, Math.min(99, Math.trunc(value)));
}

function clampStat(value: number): number {
  return Math.max(1, Math.min(25, Math.trunc(value)));
}

function sortTemplatesByName(templates: EquipmentTemplate[]): EquipmentTemplate[] {
  return [...templates].sort((left, right) =>
    getPlayerFacingEquipmentTemplateName(left).localeCompare(getPlayerFacingEquipmentTemplateName(right))
  );
}

function getProfessionDirectSkillGroupIds(
  content: CanonicalContent,
  professionId: string
): string[] {
  const profession = content.professions.find((candidate) => candidate.id === professionId);

  return content.professionSkills
    .filter((entry) => entry.grantType === "group" && typeof entry.skillGroupId === "string")
    .filter((entry) => {
      if (!profession) {
        return false;
      }

      if (entry.scope === "family") {
        return entry.professionId === profession.familyId;
      }

      return entry.professionId === profession.id;
    })
    .map((entry) => entry.skillGroupId as string);
}

function getProfessionDirectSkillIds(content: CanonicalContent, professionId: string): string[] {
  const profession = content.professions.find((candidate) => candidate.id === professionId);

  return content.professionSkills
    .filter((entry) => typeof entry.skillId === "string")
    .filter((entry) => {
      if (!profession) {
        return false;
      }

      if (entry.scope === "family") {
        return entry.professionId === profession.familyId;
      }

      return entry.professionId === profession.id;
    })
    .map((entry) => entry.skillId as string);
}

function getGroupRelevanceLabel(input: {
  directProfessionGroupIds: string[];
  groupId: string;
  suggestedSkillGroupIds: string[];
}): string {
  if (input.directProfessionGroupIds.includes(input.groupId)) {
    return "Core to profession";
  }

  if (input.suggestedSkillGroupIds.includes(input.groupId)) {
    return "Optional to frame";
  }

  return "Manual expansion";
}

function getSelectedGroupTypeLabel(input: {
  directProfessionGroupIds: string[];
  groupId: string;
  suggestedSkillGroupIds: string[];
}): string {
  if (input.directProfessionGroupIds.includes(input.groupId)) {
    return "Core";
  }

  if (input.suggestedSkillGroupIds.includes(input.groupId)) {
    return "Optional";
  }

  return "Other";
}

function getSkillRelevance(input: {
  directProfessionSkillIds: string[];
  selectedGroupIds: string[];
  skill: CanonicalContent["skills"][number];
  suggestedSkillIds: string[];
}): NpcArchetypeSkillRelevance {
  if (input.directProfessionSkillIds.includes(input.skill.id)) {
    return "core";
  }

  if (
    input.suggestedSkillIds.includes(input.skill.id) ||
    input.skill.groupIds.some((groupId) => input.selectedGroupIds.includes(groupId))
  ) {
    return "optional";
  }

  return "other";
}

function getSkillRelevanceLabel(relevance: NpcArchetypeSkillRelevance): string {
  if (relevance === "core") {
    return "Core";
  }

  if (relevance === "optional") {
    return "Optional";
  }

  return "Other";
}

function buildTagStringFromValues(values: string[]): string {
  return values.join(", ");
}

export default function TemplatesPageContent() {
  const [content, setContent] = useState<CanonicalContent | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [kindFilter, setKindFilter] = useState<TemplateKindFilter>("all");
  const [loading, setLoading] = useState(true);
  const [pageTab, setPageTab] = useState<TemplatesPageTab>("create-template");
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);
  const [activeStep, setActiveStep] = useState<ArchetypeStepId>("society");
  const [archetypeDraft, setArchetypeDraft] = useState<HumanoidNpcArchetypeDraft>(
    createEmptyHumanoidNpcArchetypeDraft()
  );
  const [showAllSkillGroups, setShowAllSkillGroups] = useState(false);
  const [skillsFilterMode, setSkillsFilterMode] = useState<SkillsFilterMode>("selected-groups");
  const [skillTypeFilter, setSkillTypeFilter] = useState("all");
  const [skillSearch, setSkillSearch] = useState("");
  const [gearFilter, setGearFilter] = useState<InventoryTemplateFilter>("all");
  const [selectedGearTemplateId, setSelectedGearTemplateId] = useState("");

  async function refreshTemplates() {
    const [nextTemplates, nextContent] = await Promise.all([
      loadTemplates(),
      loadCanonicalContent()
    ]);
    const filteredTemplates = nextTemplates.filter(
      (template) => getCampaignActorMetadata(template).actorClass === "template"
    );

    setTemplates(filteredTemplates);
    setContent(nextContent);
  }

  useEffect(() => {
    refreshTemplates()
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load templates.");
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleTemplates = useMemo(
    () => templates.filter((template) => kindFilter === "all" || template.kind === kindFilter),
    [kindFilter, templates]
  );
  const societyOptions = useMemo(
    () => (content ? listSocietyOptions(content) : []),
    [content]
  );
  const professionOptions = useMemo(
    () =>
      content
        ? listProfessionsForSociety({
            content,
            societyId: archetypeDraft.societyId
          })
        : [],
    [archetypeDraft.societyId, content]
  );
  const suggestedSkillGroupIds = useMemo(
    () =>
      content && archetypeDraft.societyId && archetypeDraft.professionId
        ? listSuggestedSkillGroupIds({
            content,
            professionId: archetypeDraft.professionId,
            societyId: archetypeDraft.societyId
          })
        : [],
    [archetypeDraft.professionId, archetypeDraft.societyId, content]
  );
  const directProfessionSkillGroupIds = useMemo(
    () =>
      content && archetypeDraft.professionId
        ? getProfessionDirectSkillGroupIds(content, archetypeDraft.professionId)
        : [],
    [archetypeDraft.professionId, content]
  );
  const directProfessionSkillIds = useMemo(
    () =>
      content && archetypeDraft.professionId
        ? getProfessionDirectSkillIds(content, archetypeDraft.professionId)
        : [],
    [archetypeDraft.professionId, content]
  );
  const suggestedSkills = useMemo(() => {
    if (!content || !archetypeDraft.societyId || !archetypeDraft.professionId) {
      return [];
    }

    const selectedSkillIds = new Set(archetypeDraft.skillSelections.map((selection) => selection.skillId));

    return listSuggestedSkills({
      content,
      professionId: archetypeDraft.professionId,
      selectedSkillGroupIds: archetypeDraft.selectedSkillGroupIds,
      societyId: archetypeDraft.societyId
    })
      .filter((skill) => !selectedSkillIds.has(skill.id))
      .filter((skill) => {
        const normalizedSearch = skillSearch.trim().toLowerCase();

        return (
          normalizedSearch.length === 0 ||
          skill.name.toLowerCase().includes(normalizedSearch) ||
          skill.id.toLowerCase().includes(normalizedSearch)
        );
      });
  }, [
    archetypeDraft.professionId,
    archetypeDraft.selectedSkillGroupIds,
    archetypeDraft.skillSelections,
    archetypeDraft.societyId,
    content,
    skillSearch
  ]);
  const suggestedSkillIds = useMemo(
    () => suggestedSkills.map((skill) => skill.id),
    [suggestedSkills]
  );
  const allKnownTags = useMemo(() => {
    return [...new Set(
      templates.flatMap((template) => {
        const archetypeSummary = parseHumanoidNpcArchetypeTemplate(template);
        const metadata = getCampaignActorMetadata(template);
        return archetypeSummary.tags ?? metadata.tags ?? [];
      })
    )].sort((left, right) => left.localeCompare(right));
  }, [templates]);
  const rawTagParts = archetypeDraft.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const pendingTagFragment = archetypeDraft.tags.trim().endsWith(",")
    ? ""
    : rawTagParts.at(-1) ?? "";
  const selectedTagValues = useMemo(() => {
    if (pendingTagFragment.length === 0) {
      return rawTagParts;
    }

    return rawTagParts.slice(0, -1);
  }, [pendingTagFragment, rawTagParts]);
  const tagSuggestions = useMemo(() => {
    const selectedTags = new Set(selectedTagValues);
    const normalizedFragment = pendingTagFragment.toLowerCase();

    return allKnownTags.filter((tag) => {
      if (selectedTags.has(tag)) {
        return false;
      }

      if (normalizedFragment.length === 0) {
        return true;
      }

      return tag.toLowerCase().includes(normalizedFragment);
    });
  }, [allKnownTags, pendingTagFragment, selectedTagValues]);
  const skillFilterOptions = useMemo(
    () =>
      content
        ? ["all", ...new Set(content.skills.map((skill) => skill.category))].filter(Boolean)
        : ["all"],
    [content]
  );
  const filteredSkillCards = useMemo(() => {
    if (!content) {
      return [];
    }
    const normalizedSearch = skillSearch.trim().toLowerCase();
    const selectedGroupIds = new Set(archetypeDraft.selectedSkillGroupIds);

    return content.skills
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .filter((skill) => {
        if (
          normalizedSearch.length > 0 &&
          !skill.name.toLowerCase().includes(normalizedSearch) &&
          !skill.id.toLowerCase().includes(normalizedSearch)
        ) {
          return false;
        }

        if (skillsFilterMode === "selected-groups") {
          return (
            archetypeDraft.skillSelections.some((selection) => selection.skillId === skill.id) ||
            skill.groupIds.some((groupId) => selectedGroupIds.has(groupId))
          );
        }

        if (skillsFilterMode === "core-skills") {
          return directProfessionSkillIds.includes(skill.id);
        }

        if (skillsFilterMode === "optional-skills") {
          return suggestedSkillIds.includes(skill.id) && !directProfessionSkillIds.includes(skill.id);
        }

        if (skillsFilterMode === "skill-type") {
          return skillTypeFilter === "all" ? true : skill.category === skillTypeFilter;
        }

        return true;
      });
  }, [
    archetypeDraft.selectedSkillGroupIds,
    archetypeDraft.skillSelections,
    content,
    directProfessionSkillIds,
    skillSearch,
    skillTypeFilter,
    skillsFilterMode,
    suggestedSkillIds,
    archetypeDraft.skillSelections
  ]);
  const availableGearTemplates = useMemo(() => {
    const selectedIds = new Set(archetypeDraft.selectedGearTemplateIds);

    return sortTemplatesByName(
      filterInventoryTemplateOptions(equipmentTemplates, gearFilter).filter(
        (template) => !selectedIds.has(template.id)
      )
    );
  }, [archetypeDraft.selectedGearTemplateIds, gearFilter]);
  const selectedGearTemplates = useMemo(
    () =>
      sortTemplatesByName(
        equipmentTemplates.filter((template) =>
          archetypeDraft.selectedGearTemplateIds.includes(template.id)
        )
      ),
    [archetypeDraft.selectedGearTemplateIds]
  );
  const selectedSociety = societyOptions.find(
    (option) => option.societyId === archetypeDraft.societyId
  );
  const selectedProfession = professionOptions.find(
    (profession) => profession.id === archetypeDraft.professionId
  );
  const selectedProfessionFamily =
    selectedProfession && content
      ? content.professionFamilies.find((family) => family.id === selectedProfession.familyId)
      : undefined;
  const visibleSkillGroups = useMemo(() => {
    const sortedGroups =
      content?.skillGroups
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name)) ?? [];

    const coreGroupIds = new Set(directProfessionSkillGroupIds);
    const optionalGroupIds = new Set(
      suggestedSkillGroupIds.filter((groupId) => !coreGroupIds.has(groupId))
    );

    const coreGroups = sortedGroups.filter((group) => coreGroupIds.has(group.id));
    const optionalGroups = sortedGroups.filter((group) => optionalGroupIds.has(group.id));

    if (!showAllSkillGroups) {
      return [...coreGroups, ...optionalGroups];
    }

    const otherGroups = sortedGroups.filter(
      (group) => !coreGroupIds.has(group.id) && !optionalGroupIds.has(group.id)
    );

    return [...coreGroups, ...optionalGroups, ...otherGroups];
  }, [content, directProfessionSkillGroupIds, showAllSkillGroups, suggestedSkillGroupIds]);
  const coreSkillGroups = useMemo(
    () => visibleSkillGroups.filter((group) => directProfessionSkillGroupIds.includes(group.id)),
    [directProfessionSkillGroupIds, visibleSkillGroups]
  );
  const optionalSkillGroups = useMemo(
    () =>
      visibleSkillGroups.filter(
        (group) =>
          !directProfessionSkillGroupIds.includes(group.id) &&
          suggestedSkillGroupIds.includes(group.id)
      ),
    [directProfessionSkillGroupIds, suggestedSkillGroupIds, visibleSkillGroups]
  );
  const otherSkillGroups = useMemo(
    () =>
      visibleSkillGroups.filter(
        (group) =>
          !directProfessionSkillGroupIds.includes(group.id) &&
          !suggestedSkillGroupIds.includes(group.id)
      ),
    [directProfessionSkillGroupIds, suggestedSkillGroupIds, visibleSkillGroups]
  );
  const hiddenSkillGroupCount =
    (content?.skillGroups.length ?? 0) - visibleSkillGroups.length;
  const selectedSkillGroupCount = archetypeDraft.selectedSkillGroupIds.length;
  const selectedSkillCount = archetypeDraft.skillSelections.length;
  const selectedSkillPointCount = useMemo(() => {
    if (!content) {
      return 0;
    }

    return archetypeDraft.skillSelections.reduce((total, selection) => {
      const skill = content.skills.find((entry) => entry.id === selection.skillId);
      const multiplier = skill?.category === "secondary" ? 1 : 2;
      return total + selection.targetLevel * multiplier;
    }, 0);
  }, [archetypeDraft.skillSelections, content]);
  const resolvedStats = resolveGlantriCharacterStats(archetypeDraft.stats);
  const activeStepIndex = ARCHETYPE_STEPS.findIndex((step) => step.id === activeStep);
  const canMoveForwardByStep: Record<ArchetypeStepId, boolean> = {
    gear: true,
    profession: Boolean(archetypeDraft.professionId),
    review: true,
    skills: archetypeDraft.skillSelections.length > 0,
    "skill-groups": archetypeDraft.selectedSkillGroupIds.length > 0,
    society: Boolean(archetypeDraft.societyId),
    stats: true,
    variability: archetypeDraft.name.trim().length > 0
  };
  function updateDraft(updater: (current: HumanoidNpcArchetypeDraft) => HumanoidNpcArchetypeDraft) {
    setArchetypeDraft((current) => updater(current));
  }

  function resetArchetypeEditor() {
    setArchetypeDraft(createEmptyHumanoidNpcArchetypeDraft());
    setEditingTemplateId(null);
    setActiveStep("society");
    setSelectedGearTemplateId("");
    setSkillSearch("");
    setSkillsFilterMode("selected-groups");
    setSkillTypeFilter("all");
    setGearFilter("all");
    setShowAllSkillGroups(false);
  }

  function handleSocietyChange(societyId: string) {
    updateDraft((current) => ({
      ...current,
      professionId: "",
      selectedSkillGroupIds: [],
      skillSelections: [],
      societyId
    }));
    setShowAllSkillGroups(false);
    setSkillsFilterMode("selected-groups");
  }

  function handleProfessionChange(professionId: string) {
    updateDraft((current) => ({
      ...current,
      professionId,
      roleLabel:
        content?.professions.find((profession) => profession.id === professionId)?.name ?? current.roleLabel,
      selectedSkillGroupIds: [],
      skillSelections: []
    }));
    setShowAllSkillGroups(false);
    setSkillsFilterMode("selected-groups");
  }

  function handleApplyTagSuggestion(tag: string) {
    const nextTags = [...new Set([...selectedTagValues, tag])];
    updateDraft((current) => ({
      ...current,
      tags: buildTagStringFromValues(nextTags)
    }));
  }

  function handleToggleSkillGroup(groupId: string) {
    updateDraft((current) => ({
      ...current,
      selectedSkillGroupIds: current.selectedSkillGroupIds.includes(groupId)
        ? current.selectedSkillGroupIds.filter((entry) => entry !== groupId)
        : [...current.selectedSkillGroupIds, groupId]
    }));
  }

  function handleToggleSkill(skillId: string, relevance: NpcArchetypeSkillRelevance) {
    updateDraft((current) => ({
      ...current,
      skillSelections: current.skillSelections.some((selection) => selection.skillId === skillId)
        ? current.skillSelections.filter((selection) => selection.skillId !== skillId)
        : [
            ...current.skillSelections,
            {
              skillId,
              targetLevel: getDefaultSkillLevelForRelevance({
                relevance,
                seniority: current.seniority
              })
            }
          ]
    }));
  }

  function handleSkillLevelChange(skillId: string, nextValue: number) {
    updateDraft((current) => ({
      ...current,
      skillSelections: current.skillSelections.map((selection) =>
        selection.skillId === skillId
          ? { ...selection, targetLevel: clampLevel(nextValue) }
          : selection
      )
    }));
  }

  function handleRemoveSkill(skillId: string) {
    updateDraft((current) => ({
      ...current,
      skillSelections: current.skillSelections.filter((selection) => selection.skillId !== skillId)
    }));
  }

  function handleStatChange(stat: GlantriCharacteristicKey, nextValue: number) {
    updateDraft((current) => ({
      ...current,
      stats: {
        ...current.stats,
        [stat]: clampStat(nextValue)
      }
    }));
  }

  function handleAddGearTemplate() {
    if (!selectedGearTemplateId) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      selectedGearTemplateIds: [...current.selectedGearTemplateIds, selectedGearTemplateId]
    }));
    setSelectedGearTemplateId("");
  }

  function handleRemoveGearTemplate(templateId: string) {
    updateDraft((current) => ({
      ...current,
      selectedGearTemplateIds: current.selectedGearTemplateIds.filter((entry) => entry !== templateId)
    }));
  }

  function goToNextStep() {
    if (!canMoveForwardByStep[activeStep]) {
      return;
    }

    setActiveStep((current) => {
      const index = ARCHETYPE_STEPS.findIndex((step) => step.id === current);
      const next = ARCHETYPE_STEPS[index + 1];
      return next?.id ?? current;
    });
  }

  function goToPreviousStep() {
    setActiveStep((current) => {
      const index = ARCHETYPE_STEPS.findIndex((step) => step.id === current);
      const previous = ARCHETYPE_STEPS[index - 1];
      return previous?.id ?? current;
    });
  }

  async function handleSaveNpcArchetypeTemplate() {
    if (!content) {
      return;
    }

    try {
      setError(undefined);
      setFeedback(undefined);

      const snapshot = buildHumanoidNpcArchetypeSnapshot({
        content,
        draft: archetypeDraft,
        equipmentTemplates
      });

      const template = editingTemplateId
        ? await updateTemplateOnServer({
            description: archetypeDraft.description,
            kind: "npc",
            name: archetypeDraft.name,
            snapshot,
            templateId: editingTemplateId
          })
        : await createTemplateOnServer({
            description: archetypeDraft.description,
            kind: "npc",
            name: archetypeDraft.name,
            snapshot
          });

      setFeedback(
        editingTemplateId
          ? `Updated archetype template ${template.name}.`
          : `Created archetype template ${template.name}.`
      );

      if (!editingTemplateId) {
        resetArchetypeEditor();
      }

      await refreshTemplates();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the NPC archetype template."
      );
    }
  }

  function handleLoadTemplateIntoEditor(template: ReusableEntity) {
    const loaded = loadHumanoidNpcArchetypeDraft(template);

    setArchetypeDraft(loaded.draft);
    setEditingTemplateId(loaded.isHumanoidNpcArchetype ? template.id : null);
    setActiveStep("society");
    setSelectedGearTemplateId("");
    setSkillSearch("");
    setSkillsFilterMode("selected-groups");
    setSkillTypeFilter("all");
    setGearFilter("all");
    setShowAllSkillGroups(false);
    setPageTab("create-template");
    setFeedback(
      loaded.isHumanoidNpcArchetype
        ? `Loaded ${template.name} into the archetype editor.`
        : `Loaded ${template.name} as a starting point for a new humanoid archetype.`
    );
  }

  if (loading) {
    return <section>Loading templates...</section>;
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1100 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Templates</h1>
        <p style={{ margin: 0 }}>
          Reusable library archetypes for NPCs, monsters, and animals. Templates are not specific
          campaign individuals.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={() => setPageTab("create-template")}
          style={{
            background: pageTab === "create-template" ? "#ece8da" : "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 999,
            padding: "0.45rem 0.85rem"
          }}
          type="button"
        >
          Create template
        </button>
        <button
          onClick={() => setPageTab("library")}
          style={{
            background: pageTab === "library" ? "#ece8da" : "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 999,
            padding: "0.45rem 0.85rem"
          }}
          type="button"
        >
          Library
        </button>
      </div>

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

      {pageTab === "create-template" ? (
      <section
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.85rem",
          padding: "1rem"
        }}
      >
        <div
          style={{
            background: "#fbfaf4",
            borderBottom: "1px solid #ece8da",
            display: "grid",
            gap: "0.75rem",
            margin: "-1rem -1rem 0",
            padding: "1rem",
            position: "sticky",
            top: 0,
            zIndex: 1
          }}
        >
          <div
            style={{
              alignItems: "start",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "space-between"
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Create humanoid NPC archetype</h2>
              <div style={{ color: "#5e5a50", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                Manual authoring flow for chargen-compatible human-like NPC templates.
              </div>
            </div>
            <div style={{ alignItems: "center", display: "flex", gap: "0.75rem" }}>
              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                {editingTemplateId ? "Editing existing template" : "Creating new template"}
              </div>
              <button onClick={resetArchetypeEditor} type="button">
                New archetype
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {ARCHETYPE_STEPS.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                style={{
                  background: activeStep === step.id ? "#ece8da" : "#f6f5ef",
                  border: "1px solid #d9ddd8",
                  borderRadius: 999,
                  fontWeight: activeStep === step.id ? 600 : 400,
                  padding: "0.35rem 0.75rem"
                }}
                type="button"
              >
                {index + 1}. {step.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
            <button disabled={activeStepIndex === 0} onClick={goToPreviousStep} type="button">
              Back
            </button>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              {activeStep !== "variability" ? (
                <button disabled={!canMoveForwardByStep[activeStep]} onClick={goToNextStep} type="button">
                  Next
                </button>
              ) : (
                <button
                  disabled={archetypeDraft.name.trim().length === 0}
                  onClick={() => void handleSaveNpcArchetypeTemplate()}
                  type="button"
                >
                  {editingTemplateId ? "Save template changes" : "Save archetype template"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
          }}
        >
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Template name</span>
            <input
              onChange={(event) =>
                updateDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="City Guard"
              value={archetypeDraft.name}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Role label</span>
            <input
              onChange={(event) =>
                updateDraft((current) => ({ ...current, roleLabel: event.target.value }))
              }
              placeholder="Town watch"
              value={archetypeDraft.roleLabel}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Tags</span>
            <input
              onChange={(event) =>
                updateDraft((current) => ({ ...current, tags: event.target.value }))
              }
              placeholder="urban, guard, patrol"
              value={archetypeDraft.tags}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Seniority</span>
            <select
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  seniority: event.target.value as HumanoidNpcArchetypeDraft["seniority"]
                }))
              }
              value={archetypeDraft.seniority}
            >
              {NPC_ARCHETYPE_SENIORITY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {tagSuggestions.length > 0 ? (
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>Tag suggestions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {tagSuggestions.slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleApplyTagSuggestion(tag)}
                  style={{
                    background: "#f6f5ef",
                    border: "1px solid #d9ddd8",
                    borderRadius: 999,
                    padding: "0.25rem 0.65rem"
                  }}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Description</span>
          <textarea
            onChange={(event) =>
              updateDraft((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Reusable humanoid archetype for city patrols and gate duty."
            rows={3}
            value={archetypeDraft.description}
          />
        </label>

        {activeStep === "society" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Society</h3>
            <div
              style={{
                display: "grid",
                gap: "0.5rem",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
              }}
            >
              {societyOptions.map((society) => (
                <button
                  key={society.societyId}
                  onClick={() => handleSocietyChange(society.societyId)}
                  style={{
                    background: archetypeDraft.societyId === society.societyId ? "#ece8da" : "#fff",
                    border:
                      archetypeDraft.societyId === society.societyId
                        ? "1px solid #a89c78"
                        : "1px solid #d9ddd8",
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "grid",
                    gap: "0.25rem",
                    padding: "0.75rem",
                    textAlign: "left"
                  }}
                  type="button"
                >
                  <strong>{society.societyName}</strong>
                  <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    {society.societyLevel ? `Society level ${society.societyLevel}` : "Society level pending"}
                    {society.socialClasses.length > 0
                      ? ` • ${society.socialClasses.join(", ")}`
                      : ""}
                  </div>
                  {society.shortDescription ? (
                    <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                      {society.shortDescription}
                    </div>
                  ) : null}
                  <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    {society.professionIds.length} profession options • {society.skillGroupIds.length} recommended skill groups
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activeStep === "profession" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Profession</h3>
            {professionOptions.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: "0.5rem",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
                }}
              >
                {professionOptions.map((profession) => {
                  const family = content?.professionFamilies.find(
                    (entry) => entry.id === profession.familyId
                  );
                  const isSelected = archetypeDraft.professionId === profession.id;

                  return (
                    <button
                      key={profession.id}
                      onClick={() => handleProfessionChange(profession.id)}
                      style={{
                        background: isSelected ? "#ece8da" : "#fff",
                        border: isSelected ? "1px solid #a89c78" : "1px solid #d9ddd8",
                        borderRadius: 10,
                        cursor: "pointer",
                        display: "grid",
                        gap: "0.25rem",
                        padding: "0.75rem",
                        textAlign: "left"
                      }}
                      type="button"
                    >
                      <strong>{profession.name}</strong>
                      {family ? (
                        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                          Family: {family.name}
                        </div>
                      ) : null}
                      {profession.description ? <div>{profession.description}</div> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div>Choose a society first to reveal professions.</div>
            )}
          </section>
        ) : null}

        {activeStep === "skill-groups" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <div
              style={{
                background: "#f6f5ef",
                border: "1px solid #e6e2d5",
                borderRadius: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem 1rem",
                padding: "0.75rem"
              }}
            >
              <div>
                <strong>Profession:</strong> {selectedProfession?.name ?? "Not selected"}
              </div>
              <div>
                <strong>Society:</strong> {selectedSociety?.societyName ?? "Not selected"}
              </div>
              <div>
                <strong>Seniority:</strong>{" "}
                {NPC_ARCHETYPE_SENIORITY_OPTIONS.find((option) => option.id === archetypeDraft.seniority)?.label}
              </div>
            </div>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "grid", gap: "0.25rem" }}>
                <h3 style={{ margin: 0 }}>Skill groups</h3>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                  Selected groups: {selectedSkillGroupCount}
                </div>
                {suggestedSkillGroupIds.length > 0 ? (
                  <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    Core groups come from profession. Optional groups come from the wider society frame. Other groups stay available through Show all.
                  </div>
                ) : null}
                {suggestedSkillGroupIds.length > 0 && otherSkillGroups.length === 0 ? (
                  <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    This profession/society frame currently leaves no groups in the Other bucket.
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {suggestedSkillGroupIds.length > 0 ? (
                  <button onClick={() => setShowAllSkillGroups((current) => !current)} type="button">
                    {showAllSkillGroups ? "Hide other groups" : `Show all groups${hiddenSkillGroupCount > 0 ? ` (${hiddenSkillGroupCount} more)` : ""}`}
                  </button>
                ) : null}
              </div>
            </div>
            {archetypeDraft.selectedSkillGroupIds.length > 0 ? (
              <div style={{ display: "grid", gap: "0.4rem" }}>
                <div style={{ fontWeight: 600 }}>Selected groups</div>
                <div style={{ border: "1px solid #d9ddd8", borderRadius: 10, overflow: "hidden" }}>
                  <div
                    style={{
                      background: "#ece8da",
                      display: "grid",
                      gap: "0.5rem",
                      gridTemplateColumns: "minmax(0, 1.2fr) 120px 140px 80px",
                      padding: "0.55rem 0.75rem"
                    }}
                  >
                    <strong>Group</strong>
                    <strong>Type</strong>
                    <strong>Profession relevance</strong>
                    <strong style={{ textAlign: "right" }}>Remove</strong>
                  </div>
                  {archetypeDraft.selectedSkillGroupIds.map((groupId, index) => {
                    const group = content?.skillGroups.find((entry) => entry.id === groupId);

                    return (
                      <div
                        key={`selected-group-${groupId}`}
                        style={{
                          alignItems: "center",
                          background: index % 2 === 0 ? "#f6f5ef" : "#f2efe6",
                          borderTop: index === 0 ? "none" : "1px solid #e6e2d5",
                          display: "grid",
                          gap: "0.5rem",
                          gridTemplateColumns: "minmax(0, 1.2fr) 120px 140px 80px",
                          padding: "0.5rem 0.75rem"
                        }}
                      >
                        <span>{group?.name ?? groupId}</span>
                        <span>
                          {getSelectedGroupTypeLabel({
                            directProfessionGroupIds: directProfessionSkillGroupIds,
                            groupId,
                            suggestedSkillGroupIds
                          })}
                        </span>
                        <span>
                          {getGroupRelevanceLabel({
                            directProfessionGroupIds: directProfessionSkillGroupIds,
                            groupId,
                            suggestedSkillGroupIds
                          })}
                        </span>
                        <button
                          onClick={() => handleToggleSkillGroup(groupId)}
                          style={{ justifySelf: "end" }}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {coreSkillGroups.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div style={{ fontWeight: 600 }}>Core groups</div>
                  <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                    {coreSkillGroups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => handleToggleSkillGroup(group.id)}
                        style={{
                          background: archetypeDraft.selectedSkillGroupIds.includes(group.id) ? "#ece8da" : "#fff",
                          border: archetypeDraft.selectedSkillGroupIds.includes(group.id)
                            ? "1px solid #a89c78"
                            : "1px solid #d9ddd8",
                          borderRadius: 10,
                          cursor: "pointer",
                          display: "grid",
                          gap: "0.25rem",
                          padding: "0.75rem",
                          textAlign: "left"
                        }}
                        type="button"
                      >
                        <strong>{group.name}</strong>
                        <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>Core group</div>
                        {group.description ? <div>{group.description}</div> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {optionalSkillGroups.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div style={{ fontWeight: 600 }}>Optional groups</div>
                  <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                    {optionalSkillGroups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => handleToggleSkillGroup(group.id)}
                        style={{
                          background: archetypeDraft.selectedSkillGroupIds.includes(group.id) ? "#ece8da" : "#fff",
                          border: archetypeDraft.selectedSkillGroupIds.includes(group.id)
                            ? "1px solid #a89c78"
                            : "1px solid #d9ddd8",
                          borderRadius: 10,
                          cursor: "pointer",
                          display: "grid",
                          gap: "0.25rem",
                          padding: "0.75rem",
                          textAlign: "left"
                        }}
                        type="button"
                      >
                        <strong>{group.name}</strong>
                        <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>Optional group</div>
                        {group.description ? <div>{group.description}</div> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {showAllSkillGroups && otherSkillGroups.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div style={{ fontWeight: 600 }}>Other groups</div>
                  <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                    {otherSkillGroups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => handleToggleSkillGroup(group.id)}
                        style={{
                          background: archetypeDraft.selectedSkillGroupIds.includes(group.id) ? "#ece8da" : "#fff",
                          border: archetypeDraft.selectedSkillGroupIds.includes(group.id)
                            ? "1px solid #a89c78"
                            : "1px solid #d9ddd8",
                          borderRadius: 10,
                          cursor: "pointer",
                          display: "grid",
                          gap: "0.25rem",
                          padding: "0.75rem",
                          textAlign: "left"
                        }}
                        type="button"
                      >
                        <strong>{group.name}</strong>
                        <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>Other group</div>
                        {group.description ? <div>{group.description}</div> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeStep === "skills" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <div
              style={{
                background: "#f6f5ef",
                border: "1px solid #e6e2d5",
                borderRadius: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem 1rem",
                padding: "0.75rem"
              }}
            >
              <div>
                <strong>Profession:</strong> {selectedProfession?.name ?? "Not selected"}
              </div>
              <div>
                <strong>Society:</strong> {selectedSociety?.societyName ?? "Not selected"}
              </div>
              <div>
                <strong>Seniority:</strong>{" "}
                {NPC_ARCHETYPE_SENIORITY_OPTIONS.find((option) => option.id === archetypeDraft.seniority)?.label}
              </div>
            </div>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "grid", gap: "0.25rem" }}>
                <h3 style={{ margin: 0 }}>Skills</h3>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                  Selected groups: {selectedSkillGroupCount} • Selected skills: {selectedSkillCount}
                </div>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                  Skill points: {selectedSkillPointCount}
                </div>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                  Core skills use the selected seniority band. Optional skills default one band lower, and all target levels stay editable after selection.
                </div>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gap: "0.75rem"
              }}
            >
              <div
                style={{
                  alignItems: "end",
                  display: "grid",
                  gap: "0.75rem",
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr)) minmax(180px, 1.2fr)"
                }}
              >
                {([
                  ["selected-groups", "Selected groups"],
                  ["core-skills", "Core skills"],
                  ["optional-skills", "Optional skills"],
                  ["skill-type", "Skill type"],
                  ["all-skills", "All skills"]
                ] as Array<[SkillsFilterMode, string]>).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSkillsFilterMode(mode);
                    }}
                    style={{
                      background: skillsFilterMode === mode ? "#ece8da" : "#f6f5ef",
                      border: "1px solid #d9ddd8",
                      borderRadius: 999,
                      padding: "0.45rem 0.75rem"
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
                <label style={{ display: "grid", gap: "0.25rem" }}>
                  <span>Search</span>
                  <input
                    onChange={(event) => setSkillSearch(event.target.value)}
                    placeholder="Filter visible skills"
                    value={skillSearch}
                  />
                </label>
              </div>
              {skillsFilterMode === "skill-type" ? (
                <label style={{ display: "grid", gap: "0.25rem", maxWidth: 220 }}>
                  <span>Skill type</span>
                  <select
                    onChange={(event) => setSkillTypeFilter(event.target.value)}
                    value={skillTypeFilter}
                  >
                    {skillFilterOptions.map((option) => (
                      <option key={option} value={option}>
                        {option === "all" ? "All types" : option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {archetypeDraft.skillSelections.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div style={{ fontWeight: 600 }}>Selected skills</div>
                  <div style={{ border: "1px solid #d9ddd8", borderRadius: 10, overflow: "hidden" }}>
                    <div
                      style={{
                        background: "#ece8da",
                        display: "grid",
                        gap: "0.5rem",
                        gridTemplateColumns: "minmax(0, 1fr) 120px minmax(0, 1fr) 100px 80px",
                        padding: "0.55rem 0.75rem"
                      }}
                    >
                      <strong>Skill</strong>
                      <strong>Type</strong>
                      <strong>Group membership</strong>
                      <strong style={{ textAlign: "right" }}>Target level</strong>
                      <strong style={{ textAlign: "right" }}>Remove</strong>
                    </div>
                    {archetypeDraft.skillSelections.map((selection, index) => {
                      const skill = content?.skills.find((candidate) => candidate.id === selection.skillId);
                      const groupNames =
                        skill?.groupIds
                          .map((groupId) => content?.skillGroups.find((group) => group.id === groupId)?.name ?? groupId)
                          .join(", ") ?? selection.skillId;

                      return (
                        <div
                          key={`selected-skill-${selection.skillId}`}
                          style={{
                            alignItems: "center",
                            background: index % 2 === 0 ? "#f6f5ef" : "#f2efe6",
                            borderTop: index === 0 ? "none" : "1px solid #e6e2d5",
                            display: "grid",
                            gap: "0.5rem",
                            gridTemplateColumns: "minmax(0, 1fr) 120px minmax(0, 1fr) 100px 80px",
                            padding: "0.5rem 0.75rem"
                          }}
                        >
                          <span>{skill?.name ?? selection.skillId}</span>
                          <span>{skill?.category ?? "unknown"}</span>
                          <span>{groupNames}</span>
                          <input
                            min={0}
                            onChange={(event) =>
                              handleSkillLevelChange(
                                selection.skillId,
                                Number.parseInt(event.target.value, 10) || 0
                              )
                            }
                            style={{ textAlign: "right" }}
                            type="number"
                            value={selection.targetLevel}
                          />
                          <button
                            onClick={() => handleRemoveSkill(selection.skillId)}
                            style={{ justifySelf: "end" }}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div style={{ fontWeight: 600 }}>
                  {skillsFilterMode === "selected-groups"
                    ? "Skills in selected groups"
                    : skillsFilterMode === "core-skills"
                      ? "Core skills"
                      : skillsFilterMode === "optional-skills"
                        ? "Optional skills"
                        : skillsFilterMode === "skill-type"
                          ? "Skills by type"
                          : "All skills"}
                </div>
                {filteredSkillCards.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "0.5rem",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
                    }}
                  >
                    {filteredSkillCards.map((skill) => {
                      const groupNames = skill.groupIds
                        .map((groupId) => content?.skillGroups.find((group) => group.id === groupId)?.name ?? groupId)
                        .join(", ");
                      const relevance = getSkillRelevance({
                        directProfessionSkillIds,
                        selectedGroupIds: archetypeDraft.selectedSkillGroupIds,
                        skill,
                        suggestedSkillIds
                      });
                      const isSelected = archetypeDraft.skillSelections.some(
                        (selection) => selection.skillId === skill.id
                      );
                      const defaultLevel = getDefaultSkillLevelForRelevance({
                        relevance,
                        seniority: archetypeDraft.seniority
                      });

                      return (
                        <button
                          key={`skill-card-${skill.id}`}
                          onClick={() => handleToggleSkill(skill.id, relevance)}
                          style={{
                            background: isSelected ? "#ece8da" : "#fff",
                            border: isSelected ? "1px solid #a89c78" : "1px solid #d9ddd8",
                            borderRadius: 10,
                            cursor: "pointer",
                            display: "grid",
                            gap: "0.25rem",
                            padding: "0.75rem",
                            textAlign: "left"
                          }}
                          type="button"
                        >
                          <strong>{skill.name}</strong>
                          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                            {skill.category} • {groupNames}
                          </div>
                          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                            {getSkillRelevanceLabel(relevance)} • Level {defaultLevel}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    No skills match the current filter and search.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeStep === "stats" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Stats</h3>
            <div
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 10,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  background: "#ece8da",
                  display: "grid",
                  gap: "0.5rem",
                  gridTemplateColumns: "minmax(0, 1fr) 72px 72px",
                  padding: "0.55rem 0.75rem"
                }}
              >
                <strong>Stat</strong>
                <strong style={{ textAlign: "right" }}>Base</strong>
                <strong style={{ textAlign: "right" }}>Final</strong>
              </div>
              {glantriCharacteristicOrder.map((stat, index) => (
                <div
                  key={stat}
                  style={{
                    alignItems: "center",
                    background: index % 2 === 0 ? "#f6f5ef" : "#f2efe6",
                    borderTop: index === 0 ? "none" : "1px solid #e6e2d5",
                    display: "grid",
                    gap: "0.5rem",
                    gridTemplateColumns: "minmax(0, 1fr) 72px 72px",
                    padding: "0.5rem 0.75rem"
                  }}
                >
                  <span>{glantriCharacteristicLabels[stat]}</span>
                  <input
                    min={1}
                    onChange={(event) =>
                      handleStatChange(stat, Number.parseInt(event.target.value, 10) || 1)
                    }
                    style={{ textAlign: "right" }}
                    type="number"
                    value={archetypeDraft.stats[stat]}
                  />
                  <strong style={{ textAlign: "right" }}>{resolvedStats[stat]}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeStep === "gear" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Gear</h3>
            <div
              style={{
                alignItems: "end",
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "180px minmax(0, 1fr) auto"
              }}
            >
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Category</span>
                <select
                  onChange={(event) => setGearFilter(event.target.value as InventoryTemplateFilter)}
                  value={gearFilter}
                >
                  <option value="all">All</option>
                  <option value="weapons">Weapons</option>
                  <option value="missile">Missile</option>
                  <option value="throwing">Throwing</option>
                  <option value="armor">Armor</option>
                  <option value="gear">Gear</option>
                  <option value="valuables">Valuables</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Available template</span>
                <select
                  onChange={(event) => setSelectedGearTemplateId(event.target.value)}
                  value={selectedGearTemplateId}
                >
                  <option value="">Select gear</option>
                  {availableGearTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {getPlayerFacingEquipmentTemplateName(template)}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={!selectedGearTemplateId} onClick={handleAddGearTemplate} type="button">
                Add gear
              </button>
            </div>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Loadout notes</span>
              <textarea
                onChange={(event) =>
                  updateDraft((current) => ({ ...current, gearNotes: event.target.value }))
                }
                placeholder="Optional notes about preferred loadout, substitutions, or carried tools."
                rows={3}
                value={archetypeDraft.gearNotes}
              />
            </label>
            {selectedGearTemplates.length > 0 ? (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {selectedGearTemplates.map((template) => (
                  <div
                    key={template.id}
                    style={{
                      alignItems: "center",
                      border: "1px solid #d9ddd8",
                      borderRadius: 10,
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.75rem"
                    }}
                  >
                    <div>
                      <strong>{getPlayerFacingEquipmentTemplateName(template)}</strong>
                      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{template.category}</div>
                    </div>
                    <button onClick={() => handleRemoveGearTemplate(template.id)} type="button">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div>No default gear selected yet.</div>
            )}
          </section>
        ) : null}

        {activeStep === "review" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Review</h3>
            <div
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 10,
                display: "grid",
                gap: "0.75rem",
                padding: "0.85rem"
              }}
            >
              <div>
                <strong>{archetypeDraft.name || "Unnamed archetype"}</strong>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                  {selectedSociety?.societyName ?? "No society selected"} •{" "}
                  {selectedProfession?.name ?? "No profession selected"}
                  {selectedProfessionFamily ? ` • ${selectedProfessionFamily.name}` : ""}
                </div>
              </div>
              <div>{archetypeDraft.description || "No description yet."}</div>
              <div style={{ display: "grid", gap: "0.35rem" }}>
                <div>Skill groups: {archetypeDraft.selectedSkillGroupIds.length}</div>
                <div>
                  Seniority:{" "}
                  {NPC_ARCHETYPE_SENIORITY_OPTIONS.find((option) => option.id === archetypeDraft.seniority)?.label ??
                    archetypeDraft.seniority}
                </div>
                <div>Skills: {archetypeDraft.skillSelections.length}</div>
                <div>
                  Gear:{" "}
                  {selectedGearTemplates.length > 0
                    ? selectedGearTemplates.map((template) => getPlayerFacingEquipmentTemplateName(template)).join(", ")
                    : "None selected"}
                </div>
                <div>
                  Variability: stats ±{archetypeDraft.variability.statVariance}, skills ±
                  {archetypeDraft.variability.skillVariance}
                </div>
              </div>
              <div
                style={{
                  border: "1px solid #e6e2d5",
                  borderRadius: 10,
                  overflow: "hidden"
                }}
              >
                <div
                  style={{
                    background: "#ece8da",
                    display: "grid",
                    gap: "0.5rem",
                    gridTemplateColumns: "minmax(0, 1fr) 72px 72px",
                    padding: "0.55rem 0.75rem"
                  }}
                >
                  <strong>Stat</strong>
                  <strong style={{ textAlign: "right" }}>Base</strong>
                  <strong style={{ textAlign: "right" }}>Final</strong>
                </div>
                {glantriCharacteristicOrder.map((stat, index) => (
                  <div
                    key={`review-${stat}`}
                    style={{
                      background: index % 2 === 0 ? "#f6f5ef" : "#f2efe6",
                      borderTop: index === 0 ? "none" : "1px solid #e6e2d5",
                      display: "grid",
                      gap: "0.5rem",
                      gridTemplateColumns: "minmax(0, 1fr) 72px 72px",
                      padding: "0.5rem 0.75rem"
                    }}
                  >
                    <span>{glantriCharacteristicLabels[stat]}</span>
                    <strong style={{ textAlign: "right" }}>{archetypeDraft.stats[stat]}</strong>
                    <strong style={{ textAlign: "right" }}>{resolvedStats[stat]}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeStep === "variability" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Variability</h3>
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
              }}
            >
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Stat variance</span>
                <input
                  min={0}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      variability: {
                        ...current.variability,
                        statVariance: clampLevel(Number.parseInt(event.target.value, 10) || 0)
                      }
                    }))
                  }
                  type="number"
                  value={archetypeDraft.variability.statVariance}
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Skill variance</span>
                <input
                  min={0}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      variability: {
                        ...current.variability,
                        skillVariance: clampLevel(Number.parseInt(event.target.value, 10) || 0)
                      }
                    }))
                  }
                  type="number"
                  value={archetypeDraft.variability.skillVariance}
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Gear substitution hooks</span>
              <textarea
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    variability: {
                      ...current.variability,
                      gearSubstitutionNotes: event.target.value
                    }
                  }))
                }
                placeholder="Optional notes for later generator substitutions."
                rows={3}
                value={archetypeDraft.variability.gearSubstitutionNotes}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Variability notes</span>
              <textarea
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    variability: {
                      ...current.variability,
                      notes: event.target.value
                    }
                  }))
                }
                placeholder="Optional notes for later random generation tuning."
                rows={3}
                value={archetypeDraft.variability.notes}
              />
            </label>
            <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
              This template stores later-generation hints for competency bands and suitability steps,
              but does not generate random NPCs yet.
            </div>
          </section>
        ) : null}
      </section>
      ) : null}

      {pageTab === "library" ? (
      <section
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Library</h2>
        <label style={{ display: "grid", gap: "0.25rem", maxWidth: 180 }}>
          <span>Type</span>
          <select
            onChange={(event) => setKindFilter(event.target.value as TemplateKindFilter)}
            value={kindFilter}
          >
            <option value="all">All</option>
            <option value="npc">NPC</option>
            <option value="monster">Monster</option>
            <option value="animal">Animal</option>
          </select>
        </label>
        {visibleTemplates.length > 0 ? (
          visibleTemplates.map((template) => {
            const metadata = getCampaignActorMetadata(template);
            const archetypeSummary = parseHumanoidNpcArchetypeTemplate(template);

            return (
              <div
                key={template.id}
                style={{
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  display: "grid",
                  gap: "0.5rem",
                  padding: "1rem"
                }}
              >
                <div
                  style={{
                    alignItems: "start",
                    display: "flex",
                    gap: "0.75rem",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "grid", gap: "0.25rem" }}>
                    <strong>{template.name}</strong>
                    <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                      {template.kind}
                      {archetypeSummary.isHumanoidNpcArchetype ? " • humanoid NPC archetype" : ""}
                    </div>
                  </div>
                  <button onClick={() => handleLoadTemplateIntoEditor(template)} type="button">
                    Load into editor
                  </button>
                </div>
                <div>{template.description || "No description yet."}</div>
                {archetypeSummary.societyName ? <div>Society: {archetypeSummary.societyName}</div> : null}
                {archetypeSummary.profession ?? metadata.profession ? (
                  <div>Profession: {archetypeSummary.profession ?? metadata.profession}</div>
                ) : null}
                {archetypeSummary.roleLabel ?? metadata.roleLabel ? (
                  <div>Role: {archetypeSummary.roleLabel ?? metadata.roleLabel}</div>
                ) : null}
                {archetypeSummary.isHumanoidNpcArchetype ? (
                  <>
                    <div>
                      Skill groups: {archetypeSummary.skillGroupCount} • Skills: {archetypeSummary.skillCount}
                    </div>
                    {archetypeSummary.gearNames.length > 0 ? (
                      <div>Gear: {archetypeSummary.gearNames.join(", ")}</div>
                    ) : null}
                    {archetypeSummary.variability ? (
                      <div>
                        Variability: stats ±{archetypeSummary.variability.statVariance}, skills ±
                        {archetypeSummary.variability.skillVariance}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    {metadata.socialClass ? <div>Social context: {metadata.socialClass}</div> : null}
                    {metadata.equipmentProfile ? (
                      <div>Equipment profile: {metadata.equipmentProfile}</div>
                    ) : null}
                  </>
                )}
                {(archetypeSummary.tags ?? metadata.tags)?.length ? (
                  <div>Tags: {(archetypeSummary.tags ?? metadata.tags)?.join(", ")}</div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div>No templates match the current library view.</div>
        )}
      </section>
      ) : null}

    </section>
  );
}
