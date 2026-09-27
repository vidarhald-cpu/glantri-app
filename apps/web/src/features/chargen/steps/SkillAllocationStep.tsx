import { TargetGroupDetails } from "../components/TargetPackageDetails";
import { TrainingCostChangeNotice } from "../components/TrainingCostChangeNotice";
import {
  allocateChargenPoint,
  isSpecializationAccessOnlyChargenGroup,
} from "@glantri/rules-engine";
import { mergeSkillBrowseRowsBySkillId } from "@/lib/chargen/chargenBrowse";
import {
  getBadgeStyle,
  getGroupScopedSkillAllocationMetrics,
  getRowActionFeedbackKey,
  getSkillDisplayName,
  getSkillTierLabel,
  getSkillTierTone,
  sortSkills,
  type SkillBrowseRow,
} from "../chargenWizardHelpers";
import { OtherSkillsStep } from "./OtherSkillsStep";
import { SpecializationsStep } from "./SpecializationsStep";
import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface SkillAllocationStepProps {
  state: State;
}

export function SkillAllocationStep({ state }: SkillAllocationStepProps) {
  const {
    content,
    coreRouteStatus,
    coreProfessionSections,
    draftView,
    expandedAllocationSections,
    groupTrainingCostChange,
    handleAllocate,
    handleAllocateSpecialization,
    handleRemoveAllocation,
    handleRemoveSpecialization,
    handleSelectGroupSlotSkill,
    handleSelectCoreRoute,
    handleToggleLanguageSelection,
    languageSelectionSummary,
    languageSkillViews,
    motherTongueSummary,
    otherSkillFilterActive,
    otherSkillTypeOptions,
    progression,
    renderSkillRowsTable,
    rowActionFeedback,
    selectableSkillSummary,
    selectedCivilization,
    selectedProfession,
    selectedProfile,
    selectedSociety,
    selectedSocietyAccess,
    selectedSocietyBand,
    setShowAllSpecializations,
    setShowOtherSkills,
    setShowSpecializations,
    setSkillSearch,
    setSkillTypeFilter,
    setSkillVisibilityFilter,
    setSpecializationSearch,
    showAllSpecializations,
    showOtherSkills,
    showSpecializations,
    skillAllocationContext,
    skillDisplayGroupIds,
    skillRowsById,
    skillSearch,
    skillTypeFilter,
    skillVisibilityFilter,
    societyGrantedSkillRows,
    specializationFilterActive,
    specializationRows,
    specializationSearch,
    specialAccessSection,
    toggleAllocationSection,
    visibleOtherSkillRows,
    visibleSpecializationRows,
  } = state;
  return (
    <section
      style={{
        display: "grid",
        gap: "0.75rem",
        opacity: selectedProfession ? 1 : 0.6,
      }}
    >
      <div style={{ display: "grid", gap: "1rem" }}>
        <div
          style={{
            background: "rgba(246, 245, 239, 0.96)",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            boxShadow: "0 6px 18px rgba(80, 72, 55, 0.08)",
            display: "grid",
            gap: "0.65rem",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            padding: "0.75rem 0.9rem",
            position: "sticky",
            top: "0.5rem",
            zIndex: 4,
          }}
        >
          <div style={{ display: "grid", gap: "0.2rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>6. Skill allocation</h2>
            <strong style={{ fontSize: "0.9rem" }}>Culture</strong>
            <div>Civilization: {selectedCivilization?.name ?? "Not selected"}</div>
            <div>Society: {selectedSociety?.name ?? "Not selected"}</div>
          </div>
          <div style={{ display: "grid", gap: "0.2rem" }}>
            <strong style={{ fontSize: "0.9rem" }}>Access</strong>
            <div>
              Social status:{" "}
              {selectedSocietyAccess && selectedSocietyBand !== undefined
                ? `${selectedSocietyAccess.socialClass} (Band ${selectedSocietyBand})`
                : "Not selected"}
            </div>
            <div>Profession: {selectedProfession?.name ?? "Not selected"}</div>
          </div>
          <div
            aria-label="Ordinary points"
            role="group"
            style={{
              background: "#fbfaf5",
              border: "1px solid #e7e2d7",
              borderRadius: 10,
              display: "grid",
              gap: "0.2rem",
              padding: "0.65rem 0.8rem",
            }}
          >
            <strong style={{ fontSize: "0.9rem" }}>Ordinary points</strong>
            <div>
              Allocated to training {progression.primaryPoolSpent} / Still available{" "}
              {draftView.primaryPoolAvailable}
            </div>
            {groupTrainingCostChange ? (
              <TrainingCostChangeNotice change={groupTrainingCostChange} />
            ) : null}
          </div>
          <div
            aria-label="Flexible points"
            role="group"
            style={{
              background: "#fbfaf5",
              border: "1px solid #e7e2d7",
              borderRadius: 10,
              display: "grid",
              gap: "0.2rem",
              padding: "0.65rem 0.8rem",
            }}
          >
            <strong style={{ fontSize: "0.9rem" }}>Flexible points</strong>
            <div>
              Allocated to training {progression.secondaryPoolSpent} / Still available{" "}
              {draftView.secondaryPoolAvailable}
            </div>
          </div>
        </div>

        {coreRouteStatus.requiresSelection ? (
          <section
            aria-labelledby="profession-core-route-heading"
            style={{
              background: "#fbfaf5",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.75rem",
              padding: "1rem",
            }}
          >
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <h3 id="profession-core-route-heading" style={{ margin: 0 }}>
                Choose your Profession core route
              </h3>
              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                This choice defines which mandatory training completes the Profession. Training
                offered by the other route remains available for purchase.
              </div>
            </div>
            <div style={{ display: "grid", gap: "0.6rem" }}>
              {coreRouteStatus.applicableRoutes.map((route) => {
                const groupNames = route.groupIds.map(
                  (id) => content.skillGroups.find((group) => group.id === id)?.name ?? id,
                );
                const skillNames = route.skillIds.map(
                  (id) => content.skills.find((skill) => skill.id === id)?.name ?? id,
                );
                const requirements = [
                  ...groupNames,
                  ...skillNames,
                  ...(route.writtenLanguageChoiceCount > 0
                    ? [`${route.writtenLanguageChoiceCount} written-language choice`]
                    : []),
                ];

                return (
                  <label
                    key={route.id}
                    style={{
                      alignItems: "start",
                      background:
                        coreRouteStatus.selectedCoreRouteId === route.id ? "#ece8da" : "#fff",
                      border: "1px solid #d9ddd8",
                      borderRadius: 10,
                      display: "grid",
                      gap: "0.25rem",
                      gridTemplateColumns: "auto minmax(0, 1fr)",
                      padding: "0.75rem",
                    }}
                  >
                    <input
                      checked={coreRouteStatus.selectedCoreRouteId === route.id}
                      name="profession-core-route"
                      onChange={() => handleSelectCoreRoute(route.id)}
                      type="radio"
                      value={route.id}
                    />
                    <span style={{ display: "grid", gap: "0.2rem" }}>
                      <strong>{route.label}</strong>
                      <span style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                        {requirements.length > 0
                          ? requirements.join(" • ")
                          : "No purchases required"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {coreRouteStatus.effectiveRoute ? (
              <div role="status" style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                {coreRouteStatus.isComplete
                  ? "Selected core route complete."
                  : "Selected core route still has required training to acquire."}
              </div>
            ) : null}
          </section>
        ) : null}

        <section
          style={{
            background: "#fbfaf5",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "1rem",
            padding: "1rem",
          }}
        >
          <strong>Society granted skills</strong>

          {renderSkillRowsTable({
            emptyMessage: "No society-granted foundational skills are currently available.",
            rows: societyGrantedSkillRows,
          })}
        </section>

        <section
          style={{
            background: "#fbfaf5",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "1rem",
            padding: "1rem",
          }}
        >
          <strong>Profession skills</strong>

          {coreProfessionSections.length > 0 ? (
            <section
              style={{
                background: "#fbfaf5",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "1rem",
                padding: "1rem",
              }}
            >
              <div
                style={{
                  alignItems: "start",
                  display: "grid",
                  gap: "0.75rem",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                }}
              >
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <strong>Profession groups</strong>
                </div>
                <button
                  onClick={() => toggleAllocationSection("core-profession-skills")}
                  type="button"
                >
                  {expandedAllocationSections.includes("core-profession-skills")
                    ? "Collapse"
                    : "Expand"}
                </button>
              </div>

              {expandedAllocationSections.includes("core-profession-skills") ? (
                <div style={{ display: "grid", gap: "1rem" }}>
                  {motherTongueSummary.displayLabel ||
                  languageSelectionSummary.selectableLanguages.length > 0 ? (
                    <section
                      style={{
                        background: "#fbfaf5",
                        border: "1px solid #e7e2d7",
                        borderRadius: 10,
                        display: "grid",
                        gap: "0.75rem",
                        padding: "1rem",
                      }}
                    >
                      <div style={{ display: "grid", gap: "0.25rem" }}>
                        <strong>Languages</strong>
                        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                          Mother tongue is granted automatically. Extra civilization languages
                          become real Language entries when selected here.
                        </div>
                      </div>

                      {motherTongueSummary.displayLabel ? (
                        <div style={{ color: "#4a4f45", fontSize: "0.9rem" }}>
                          Mother tongue: {motherTongueSummary.displayLabel} • Starting XP{" "}
                          {motherTongueSummary.startingLevel}
                        </div>
                      ) : null}

                      {languageSelectionSummary.selectableLanguages.length > 0 ? (
                        <div style={{ display: "grid", gap: "0.5rem" }}>
                          <div
                            style={{
                              alignItems: "center",
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.5rem",
                            }}
                          >
                            <span style={getBadgeStyle({ muted: true })}>
                              Optional language choices
                            </span>
                            <span style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                              Select any civilization languages you want available in this draft.
                            </span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {languageSelectionSummary.selectableLanguages.map((language) => {
                              const isSelected =
                                languageSelectionSummary.selectedOptionalLanguageIds.includes(
                                  language.id,
                                );

                              return (
                                <button
                                  key={language.id}
                                  onClick={() => handleToggleLanguageSelection(language.id)}
                                  style={{
                                    background: isSelected ? "#ece8da" : "#fff",
                                    border: isSelected ? "1px solid #8b7345" : "1px solid #d9ddd8",
                                    borderRadius: 999,
                                    cursor: "pointer",
                                    padding: "0.4rem 0.75rem",
                                  }}
                                  type="button"
                                >
                                  {language.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {languageSkillViews.length > 0 ? (
                        <div style={{ display: "grid", gap: "0.5rem" }}>
                          {languageSkillViews.map((skillView) => {
                            const rowFeedback =
                              rowActionFeedback[
                                getRowActionFeedbackKey(skillView.skillKey, "skill")
                              ];
                            const addPreview = skillAllocationContext
                              ? allocateChargenPoint({
                                  ...skillAllocationContext,
                                  targetId: skillView.skillId,
                                  targetLanguageName: skillView.languageName,
                                  targetType: "skill",
                                })
                              : undefined;

                            return (
                              <div
                                key={skillView.skillKey}
                                style={{
                                  borderTop: "1px solid #e7e2d7",
                                  display: "grid",
                                  gap: "0.5rem",
                                  paddingTop: "0.75rem",
                                }}
                              >
                                <div
                                  style={{
                                    alignItems: "center",
                                    display: "grid",
                                    gap: "0.75rem",
                                    gridTemplateColumns:
                                      "minmax(180px, 2fr) repeat(4, minmax(72px, 84px)) minmax(150px, 1fr)",
                                  }}
                                >
                                  <div style={{ display: "grid", gap: "0.3rem" }}>
                                    <div
                                      style={{
                                        alignItems: "center",
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "0.5rem",
                                      }}
                                    >
                                      <span>
                                        {getSkillDisplayName({
                                          languageName: skillView.languageName,
                                          skill: { name: skillView.name },
                                        })}
                                      </span>
                                      <span
                                        style={getSkillTierTone({ category: skillView.category })}
                                      >
                                        {getSkillTierLabel({ category: skillView.category })}
                                      </span>
                                      {skillView.sourceTag === "mother-tongue" ? (
                                        <span style={getBadgeStyle({ muted: true })}>
                                          Mother tongue
                                        </span>
                                      ) : null}
                                      {languageSelectionSummary.selectedOptionalLanguages.some(
                                        (language) => language.name === skillView.languageName,
                                      ) ? (
                                        <span style={getBadgeStyle({ muted: true })}>
                                          Selected option
                                        </span>
                                      ) : null}
                                    </div>
                                    {addPreview?.spentCost ? (
                                      <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                                        Next purchase cost: {addPreview.spentCost}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div>{skillView.groupLevel}</div>
                                  <div>{skillView.primaryRanks}</div>
                                  <div>{skillView.secondaryRanks}</div>
                                  <div>{skillView.effectiveSkillNumber}</div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                    <button
                                      disabled={!skillAllocationContext}
                                      onClick={() =>
                                        handleAllocate(
                                          skillView.skillId,
                                          "skill",
                                          skillView.languageName,
                                        )
                                      }
                                      type="button"
                                    >
                                      +
                                    </button>
                                    <button
                                      disabled={!skillAllocationContext}
                                      onClick={() =>
                                        handleRemoveAllocation(
                                          skillView.skillId,
                                          "skill",
                                          skillView.languageName,
                                        )
                                      }
                                      type="button"
                                    >
                                      -
                                    </button>
                                  </div>
                                </div>
                                {rowFeedback ? (
                                  <div
                                    role="status"
                                    style={{ color: "#7a4b00", fontSize: "0.85rem" }}
                                  >
                                    {rowFeedback}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {coreProfessionSections.map((section) => (
                    <section
                      key={section.definition.id}
                      style={{
                        background: "#fff",
                        border: "1px solid #e7e2d7",
                        borderRadius: 10,
                        display: "grid",
                        gap: "0.75rem",
                        padding: "1rem",
                      }}
                    >
                      <div style={{ display: "grid", gap: "0.25rem" }}>
                        <strong>{section.definition.label}</strong>
                        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                          {section.definition.description}
                        </div>
                      </div>

                      {section.groups.map((group) => {
                        const groupView = draftView.groups.find(
                          (item) => item.groupId === group.id,
                        );
                        const groupSelectionSlots = selectableSkillSummary.selectionSlots.filter(
                          (slot) => slot.groupId === group.id,
                        );
                        const selectedGroupSlotSkillIds = new Set(
                          groupSelectionSlots.flatMap((slot) => slot.selectedSkillIds),
                        );
                        const addPreview = skillAllocationContext
                          ? allocateChargenPoint({
                              ...skillAllocationContext,
                              targetId: group.id,
                              targetType: "group",
                            })
                          : undefined;
                        // A Group that only opens Specialization access teaches no Skills of
                        // its own, so it carries no training controls at all. Rule decision
                        // 0011; the classification comes from the rules layer.
                        const opensSpecializationOnly = isSpecializationAccessOnlyChargenGroup({
                          content,
                          groupId: group.id,
                          progression,
                        });
                        const groupSkillRows = sortSkills(
                          content.skills.filter(
                            (skill) =>
                              skillDisplayGroupIds.get(skill.id) === group.id ||
                              selectedGroupSlotSkillIds.has(skill.id),
                          ),
                        )
                          .map((skill) => {
                            const row = skillRowsById.get(skill.id);

                            if (!row) {
                              return undefined;
                            }

                            return {
                              ...row,
                              metrics: getGroupScopedSkillAllocationMetrics({
                                content,
                                draftView,
                                groupId: group.id,
                                profile: selectedProfile,
                                progression,
                                skill: row.skill,
                                targetLanguageName: row.targetLanguageName,
                              }),
                            };
                          })
                          .filter((row): row is SkillBrowseRow => row !== undefined);
                        const visibleSkillRows = mergeSkillBrowseRowsBySkillId(groupSkillRows);
                        const hasOwnedContent =
                          (groupView?.totalRanks ?? 0) > 0 ||
                          visibleSkillRows.some((row) => row.metrics.totalXp > 0);

                        return (
                          <section
                            key={group.id}
                            style={{
                              background: "#fbfaf5",
                              border: "1px solid #e7e2d7",
                              borderRadius: 10,
                              display: "grid",
                              gap: "0.75rem",
                              padding: "1rem",
                            }}
                          >
                            <div
                              style={{
                                alignItems: "start",
                                display: "grid",
                                gap: "0.75rem",
                                gridTemplateColumns: "minmax(0, 1fr) auto",
                              }}
                            >
                              <div style={{ display: "grid", gap: "0.2rem" }}>
                                <strong>{group.name}</strong>
                                <TargetGroupDetails groupId={group.id} />
                                <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                                  Included training package • {visibleSkillRows.length} displayed
                                  skill
                                  {visibleSkillRows.length === 1 ? "" : "s"}
                                  {hasOwnedContent ? " • currently invested" : ""}
                                </div>
                              </div>
                              <div
                                style={{
                                  alignItems: "center",
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "0.5rem",
                                  justifyContent: "flex-end",
                                }}
                              >
                                {opensSpecializationOnly ? (
                                  <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                                    This training opens a Specialization and teaches no Skills of
                                    its own. The Specialization is acquired separately.
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      disabled={!skillAllocationContext}
                                      onClick={() => handleAllocate(group.id, "group")}
                                      type="button"
                                    >
                                      Add training
                                    </button>
                                    <button
                                      disabled={!skillAllocationContext}
                                      onClick={() => handleRemoveAllocation(group.id, "group")}
                                      type="button"
                                    >
                                      Remove training
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gap: "0.5rem",
                                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: "0.85rem" }}>
                                  Ranks from ordinary points
                                </div>
                                <strong>{groupView?.primaryRanks ?? 0}</strong>
                              </div>
                              <div>
                                <div style={{ fontSize: "0.85rem" }}>
                                  Ranks from flexible points
                                </div>
                                <strong>{groupView?.secondaryRanks ?? 0}</strong>
                              </div>
                              <div>
                                <div style={{ fontSize: "0.85rem" }}>Ranks in total</div>
                                <strong>{groupView?.totalRanks ?? 0}</strong>
                              </div>
                            </div>

                            {opensSpecializationOnly ? null : addPreview?.spentCost ? (
                              <div>
                                Adding one rank costs {addPreview.spentCost} ordinary{" "}
                                {addPreview.spentCost === 1 ? "point" : "points"}.
                              </div>
                            ) : addPreview && !addPreview.error ? (
                              <div>
                                Adding one rank costs nothing. Other training this Character already
                                has covers everything this one teaches.
                              </div>
                            ) : null}
                            {opensSpecializationOnly ? null : addPreview?.error ? (
                              <div style={{ color: "#8a3b12", fontSize: "0.9rem" }}>
                                {addPreview.error}
                              </div>
                            ) : null}

                            {groupSelectionSlots.length > 0 ? (
                              <div style={{ display: "grid", gap: "0.5rem" }}>
                                {groupSelectionSlots.map((slot) => (
                                  <div
                                    key={`${group.id}:${slot.slotId}`}
                                    style={{
                                      borderTop: "1px solid #e7e2d7",
                                      display: "grid",
                                      gap: "0.5rem",
                                      paddingTop: "0.75rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        alignItems: "center",
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "0.5rem",
                                      }}
                                    >
                                      <span style={getBadgeStyle({ muted: !slot.isSatisfied })}>
                                        {slot.required ? "Required" : "Optional"} • Choose{" "}
                                        {slot.chooseCount}
                                      </span>
                                    </div>
                                    <div
                                      style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                                    >
                                      {slot.candidateSkills.map((skill) => {
                                        const isSelected = slot.selectedSkillIds.includes(skill.id);

                                        return (
                                          <button
                                            key={`${slot.slotId}-${skill.id}`}
                                            onClick={() =>
                                              handleSelectGroupSlotSkill(
                                                slot.groupId,
                                                slot.slotId,
                                                skill.id,
                                              )
                                            }
                                            style={{
                                              background: isSelected ? "#ece8da" : "#fff",
                                              border: isSelected
                                                ? "1px solid #8b7345"
                                                : "1px solid #d9ddd8",
                                              borderRadius: 999,
                                              cursor: "pointer",
                                              padding: "0.4rem 0.75rem",
                                            }}
                                            type="button"
                                          >
                                            {skill.name} • Type {skill.category}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {renderSkillRowsTable({
                              emptyMessage: "No skills in this group are currently available.",
                              rows: visibleSkillRows,
                            })}
                          </section>
                        );
                      })}

                      {section.directRows.length > 0 ? (
                        <div style={{ display: "grid", gap: "0.5rem" }}>
                          <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
                            <strong>Direct skills in this area</strong>
                            <span style={getBadgeStyle({ muted: true })}>
                              No separate included package
                            </span>
                          </div>
                          {renderSkillRowsTable({
                            emptyMessage: "No direct normal-access skills in this area.",
                            rows: section.directRows,
                          })}
                        </div>
                      ) : null}
                    </section>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {specialAccessSection ? (
            <section
              style={{
                background: "#fbfaf5",
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "1rem",
                padding: "1rem",
              }}
            >
              <div
                style={{
                  alignItems: "start",
                  display: "grid",
                  gap: "0.75rem",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                }}
              >
                <div style={{ display: "grid", gap: "0.25rem" }}>
                  <strong>Special-access granted skills</strong>
                </div>
                <button onClick={() => toggleAllocationSection("special-access")} type="button">
                  {expandedAllocationSections.includes("special-access") ? "Collapse" : "Expand"}
                </button>
              </div>

              {expandedAllocationSections.includes("special-access")
                ? renderSkillRowsTable({
                    emptyMessage: "No direct profession-linked skills are currently available.",
                    rows: specialAccessSection.directRows,
                  })
                : null}
            </section>
          ) : null}
        </section>

        <SpecializationsStep
          handleAllocateSpecialization={handleAllocateSpecialization}
          handleRemoveSpecialization={handleRemoveSpecialization}
          rowActionFeedback={rowActionFeedback}
          setShowAllSpecializations={setShowAllSpecializations}
          setShowSpecializations={setShowSpecializations}
          setSpecializationSearch={setSpecializationSearch}
          showAllSpecializations={showAllSpecializations}
          showSpecializations={showSpecializations}
          skillAllocationContext={skillAllocationContext}
          specializationFilterActive={specializationFilterActive}
          specializationRows={specializationRows}
          specializationSearch={specializationSearch}
          visibleSpecializationRows={visibleSpecializationRows}
        />

        <OtherSkillsStep
          otherSkillFilterActive={otherSkillFilterActive}
          otherSkillTypeOptions={otherSkillTypeOptions}
          renderSkillRowsTable={renderSkillRowsTable}
          setShowOtherSkills={setShowOtherSkills}
          setSkillSearch={setSkillSearch}
          setSkillTypeFilter={setSkillTypeFilter}
          setSkillVisibilityFilter={setSkillVisibilityFilter}
          showOtherSkills={showOtherSkills}
          skillSearch={skillSearch}
          skillTypeFilter={skillTypeFilter}
          skillVisibilityFilter={skillVisibilityFilter}
          visibleOtherSkillRows={visibleOtherSkillRows}
        />
      </div>
    </section>
  );
}
