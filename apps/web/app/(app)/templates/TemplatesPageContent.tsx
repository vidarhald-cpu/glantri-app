"use client";

import { useEffect, useMemo, useState } from "react";

import { type CanonicalContent } from "@glantri/content";
import { equipmentTemplates } from "@glantri/content/equipment";
import type {
  Campaign,
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
  createReusableEntityOnServer,
  createTemplateOnServer,
  loadCampaigns,
  loadTemplates,
  updateTemplateOnServer
} from "../../../src/lib/api/localServiceClient";
import {
  buildCampaignNpcSnapshotFromTemplate,
  getCampaignActorMetadata
} from "../../../src/lib/campaigns/campaignActors";
import { loadCanonicalContent } from "../../../src/lib/content/loadCanonicalContent";
import {
  filterInventoryTemplateOptions,
  type InventoryTemplateFilter
} from "../../../src/features/equipment/inventoryTemplateGroups";
import { getPlayerFacingEquipmentTemplateName } from "../../../src/features/equipment/playerFacingTemplateOptions";
import {
  buildHumanoidNpcArchetypeSnapshot,
  createEmptyHumanoidNpcArchetypeDraft,
  listAvailableSkills,
  listProfessionsForSociety,
  listSocietyOptions,
  listSuggestedSkillGroupIds,
  loadHumanoidNpcArchetypeDraft,
  parseHumanoidNpcArchetypeTemplate,
  type HumanoidNpcArchetypeDraft
} from "../../../src/lib/templates/npcArchetypeTemplates";

type TemplateKindFilter = "all" | ReusableEntity["kind"];
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

export default function TemplatesPageContent() {
  const [content, setContent] = useState<CanonicalContent | null>(null);
  const [campaignNpcName, setCampaignNpcName] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [kindFilter, setKindFilter] = useState<TemplateKindFilter>("all");
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);
  const [activeStep, setActiveStep] = useState<ArchetypeStepId>("society");
  const [archetypeDraft, setArchetypeDraft] = useState<HumanoidNpcArchetypeDraft>(
    createEmptyHumanoidNpcArchetypeDraft()
  );
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const [gearFilter, setGearFilter] = useState<InventoryTemplateFilter>("all");
  const [selectedGearTemplateId, setSelectedGearTemplateId] = useState("");

  const [quickTemplateName, setQuickTemplateName] = useState("");
  const [quickTemplateDescription, setQuickTemplateDescription] = useState("");
  const [quickTemplateKind, setQuickTemplateKind] = useState<ReusableEntity["kind"]>("monster");
  const [quickTemplateRoleLabel, setQuickTemplateRoleLabel] = useState("");
  const [quickTemplateProfession, setQuickTemplateProfession] = useState("");
  const [quickTemplateSocialClass, setQuickTemplateSocialClass] = useState("");
  const [quickTemplateEquipmentProfile, setQuickTemplateEquipmentProfile] = useState("");
  const [quickTemplateTags, setQuickTemplateTags] = useState("");

  async function refreshTemplates() {
    const [nextTemplates, nextCampaigns, nextContent] = await Promise.all([
      loadTemplates(),
      loadCampaigns(),
      loadCanonicalContent()
    ]);
    const filteredTemplates = nextTemplates.filter(
      (template) => getCampaignActorMetadata(template).actorClass === "template"
    );

    setTemplates(filteredTemplates);
    setCampaigns(nextCampaigns);
    setContent(nextContent);
    setSelectedCampaignId((current) => current || nextCampaigns[0]?.id || "");
    setSelectedTemplateId((current) => current || filteredTemplates[0]?.id || "");
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
  const availableSkills = useMemo(() => {
    if (!content || !archetypeDraft.societyId || !archetypeDraft.professionId) {
      return [];
    }

    const selectedSkillIds = new Set(archetypeDraft.skillSelections.map((selection) => selection.skillId));

    return listAvailableSkills({
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
  const selectedTemplateEntity = templates.find((entry) => entry.id === selectedTemplateId);

  function updateDraft(updater: (current: HumanoidNpcArchetypeDraft) => HumanoidNpcArchetypeDraft) {
    setArchetypeDraft((current) => updater(current));
  }

  function resetArchetypeEditor() {
    setArchetypeDraft(createEmptyHumanoidNpcArchetypeDraft());
    setEditingTemplateId(null);
    setActiveStep("society");
    setSelectedSkillId("");
    setSelectedGearTemplateId("");
    setSkillSearch("");
    setGearFilter("all");
  }

  function handleSocietyChange(societyId: string) {
    updateDraft((current) => ({
      ...current,
      professionId: "",
      selectedSkillGroupIds: [],
      skillSelections: [],
      societyId
    }));
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
  }

  function handleApplySuggestedSkillGroups() {
    updateDraft((current) => ({
      ...current,
      selectedSkillGroupIds: [...new Set([...current.selectedSkillGroupIds, ...suggestedSkillGroupIds])]
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

  function handleAddSkill() {
    if (!selectedSkillId) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      skillSelections: [...current.skillSelections, { skillId: selectedSkillId, targetLevel: 11 }]
    }));
    setSelectedSkillId("");
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

  async function handleCreateQuickTemplate() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const template = await createTemplateOnServer({
        description: quickTemplateDescription,
        kind: quickTemplateKind,
        name: quickTemplateName,
        snapshot: {
          actorClass: "template",
          equipmentProfile: quickTemplateEquipmentProfile.trim() || undefined,
          profession: quickTemplateProfession.trim() || undefined,
          roleLabel: quickTemplateRoleLabel.trim() || undefined,
          socialClass: quickTemplateSocialClass.trim() || undefined,
          tags: quickTemplateTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        }
      });

      setFeedback(`Created generic template ${template.name}.`);
      setQuickTemplateName("");
      setQuickTemplateDescription("");
      setQuickTemplateEquipmentProfile("");
      setQuickTemplateProfession("");
      setQuickTemplateRoleLabel("");
      setQuickTemplateSocialClass("");
      setQuickTemplateTags("");
      await refreshTemplates();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to create the generic template."
      );
    }
  }

  async function handleCreateCampaignNpcFromTemplate() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const template = templates.find((entry) => entry.id === selectedTemplateId);

      if (!template || !selectedCampaignId) {
        setError("Choose both a template and a target campaign.");
        return;
      }

      const entity = await createReusableEntityOnServer({
        campaignId: selectedCampaignId,
        description: template.description,
        kind: template.kind,
        name: campaignNpcName.trim() || template.name,
        snapshot: buildCampaignNpcSnapshotFromTemplate({
          campaignId: selectedCampaignId,
          name: campaignNpcName.trim() || template.name,
          template
        })
      });

      setFeedback(`Created campaign NPC ${entity.name} from template ${template.name}.`);
      setCampaignNpcName("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to create campaign NPC from template."
      );
    }
  }

  function handleLoadTemplateIntoEditor(template: ReusableEntity) {
    const loaded = loadHumanoidNpcArchetypeDraft(template);

    setArchetypeDraft(loaded.draft);
    setEditingTemplateId(loaded.isHumanoidNpcArchetype ? template.id : null);
    setActiveStep("society");
    setSelectedSkillId("");
    setSelectedGearTemplateId("");
    setSkillSearch("");
    setGearFilter("all");
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

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

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
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={resetArchetypeEditor} type="button">
              New archetype
            </button>
            {editingTemplateId ? <div>Editing existing template</div> : <div>Creating new template</div>}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
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
        </div>

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

        {activeStep === "society" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Society</h3>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {societyOptions.map((society) => (
                <label
                  key={society.societyId}
                  style={{
                    border: "1px solid #d9ddd8",
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "grid",
                    gap: "0.25rem",
                    padding: "0.75rem"
                  }}
                >
                  <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                    <input
                      checked={archetypeDraft.societyId === society.societyId}
                      name="archetype-society"
                      onChange={() => handleSocietyChange(society.societyId)}
                      type="radio"
                    />
                    <strong>{society.societyName}</strong>
                  </div>
                  <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    {society.professionIds.length} profession options • {society.skillGroupIds.length} suggested skill groups
                  </div>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {activeStep === "profession" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Profession</h3>
            {professionOptions.length > 0 ? (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {professionOptions.map((profession) => {
                  const family = content?.professionFamilies.find(
                    (entry) => entry.id === profession.familyId
                  );

                  return (
                    <label
                      key={profession.id}
                      style={{
                        border: "1px solid #d9ddd8",
                        borderRadius: 10,
                        cursor: "pointer",
                        display: "grid",
                        gap: "0.25rem",
                        padding: "0.75rem"
                      }}
                    >
                      <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                        <input
                          checked={archetypeDraft.professionId === profession.id}
                          name="archetype-profession"
                          onChange={() => handleProfessionChange(profession.id)}
                          type="radio"
                        />
                        <strong>{profession.name}</strong>
                      </div>
                      {family ? (
                        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                          Family: {family.name}
                        </div>
                      ) : null}
                      {profession.description ? <div>{profession.description}</div> : null}
                    </label>
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
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                justifyContent: "space-between"
              }}
            >
              <h3 style={{ margin: 0 }}>Skill groups</h3>
              {suggestedSkillGroupIds.length > 0 ? (
                <button onClick={handleApplySuggestedSkillGroups} type="button">
                  Apply suggested groups
                </button>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {content?.skillGroups
                .slice()
                .sort((left, right) => left.name.localeCompare(right.name))
                .map((group) => (
                  <label
                    key={group.id}
                    style={{
                      border: "1px solid #d9ddd8",
                      borderRadius: 10,
                      cursor: "pointer",
                      display: "grid",
                      gap: "0.25rem",
                      padding: "0.75rem"
                    }}
                  >
                    <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                      <input
                        checked={archetypeDraft.selectedSkillGroupIds.includes(group.id)}
                        onChange={() => handleToggleSkillGroup(group.id)}
                        type="checkbox"
                      />
                      <strong>{group.name}</strong>
                    </div>
                    {suggestedSkillGroupIds.includes(group.id) ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>Suggested from society/profession</div>
                    ) : null}
                    {group.description ? <div>{group.description}</div> : null}
                  </label>
                ))}
            </div>
          </section>
        ) : null}

        {activeStep === "skills" ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Skills</h3>
            <div
              style={{
                alignItems: "end",
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto"
              }}
            >
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Search</span>
                <input
                  onChange={(event) => setSkillSearch(event.target.value)}
                  placeholder="Filter available skills"
                  value={skillSearch}
                />
              </label>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Available skill</span>
                <select
                  onChange={(event) => setSelectedSkillId(event.target.value)}
                  value={selectedSkillId}
                >
                  <option value="">Select a skill</option>
                  {availableSkills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={!selectedSkillId} onClick={handleAddSkill} type="button">
                Add skill
              </button>
            </div>
            {archetypeDraft.skillSelections.length > 0 ? (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                {archetypeDraft.skillSelections.map((selection) => {
                  const skill = content?.skills.find((candidate) => candidate.id === selection.skillId);
                  const groupNames =
                    skill?.groupIds
                      .map((groupId) => content?.skillGroups.find((group) => group.id === groupId)?.name ?? groupId)
                      .join(", ") ?? selection.skillId;

                  return (
                    <div
                      key={selection.skillId}
                      style={{
                        alignItems: "end",
                        border: "1px solid #d9ddd8",
                        borderRadius: 10,
                        display: "grid",
                        gap: "0.75rem",
                        gridTemplateColumns: "minmax(0, 1fr) 110px auto",
                        padding: "0.75rem"
                      }}
                    >
                      <div style={{ display: "grid", gap: "0.25rem" }}>
                        <strong>{skill?.name ?? selection.skillId}</strong>
                        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{groupNames}</div>
                      </div>
                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        <span>Target</span>
                        <input
                          min={0}
                          onChange={(event) =>
                            handleSkillLevelChange(selection.skillId, Number.parseInt(event.target.value, 10) || 0)
                          }
                          type="number"
                          value={selection.targetLevel}
                        />
                      </label>
                      <button onClick={() => handleRemoveSkill(selection.skillId)} type="button">
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>No skills selected yet.</div>
            )}
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
      </section>

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

      <section
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Quick generic template</h2>
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
          Keep using this for quick monster or animal archetypes while the humanoid NPC editor grows.
        </div>
        <input
          onChange={(event) => setQuickTemplateName(event.target.value)}
          placeholder="Template name"
          value={quickTemplateName}
        />
        <textarea
          onChange={(event) => setQuickTemplateDescription(event.target.value)}
          placeholder="Description"
          rows={3}
          value={quickTemplateDescription}
        />
        <select
          onChange={(event) => setQuickTemplateKind(event.target.value as ReusableEntity["kind"])}
          value={quickTemplateKind}
        >
          <option value="npc">NPC</option>
          <option value="monster">Monster</option>
          <option value="animal">Animal</option>
        </select>
        <input
          onChange={(event) => setQuickTemplateRoleLabel(event.target.value)}
          placeholder="Role or use case (optional)"
          value={quickTemplateRoleLabel}
        />
        <input
          onChange={(event) => setQuickTemplateProfession(event.target.value)}
          placeholder="Profession or archetype fit (optional)"
          value={quickTemplateProfession}
        />
        <input
          onChange={(event) => setQuickTemplateSocialClass(event.target.value)}
          placeholder="Social class or society context (optional)"
          value={quickTemplateSocialClass}
        />
        <input
          onChange={(event) => setQuickTemplateEquipmentProfile(event.target.value)}
          placeholder="Equipment profile or notes (optional)"
          value={quickTemplateEquipmentProfile}
        />
        <input
          onChange={(event) => setQuickTemplateTags(event.target.value)}
          placeholder="Tags (comma-separated, optional)"
          value={quickTemplateTags}
        />
        <div>
          <button onClick={() => void handleCreateQuickTemplate()} type="button">
            Create generic template
          </button>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Create campaign NPC from template</h2>
        <select
          onChange={(event) => setSelectedTemplateId(event.target.value)}
          value={selectedTemplateId}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.kind})
            </option>
          ))}
        </select>
        <select
          onChange={(event) => setSelectedCampaignId(event.target.value)}
          value={selectedCampaignId}
        >
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
        <input
          onChange={(event) => setCampaignNpcName(event.target.value)}
          placeholder="Optional campaign NPC name override"
          value={campaignNpcName}
        />
        <div>
          <button
            disabled={templates.length === 0 || campaigns.length === 0}
            onClick={() => void handleCreateCampaignNpcFromTemplate()}
            type="button"
          >
            Create campaign NPC
          </button>
        </div>
      </section>
    </section>
  );
}
