import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface ReviewStepProps {
  chargenRuleSet: State["chargenRuleSet"];
  draftView: State["draftView"];
  educationLinkedSkillCount: State["educationLinkedSkillCount"];
  languageSelectionSummary: State["languageSelectionSummary"];
  motherTongueSummary: State["motherTongueSummary"];
  progression: State["progression"];
  selectableSkillSummary: State["selectableSkillSummary"];
  selectedCivilization: State["selectedCivilization"];
  selectedProfession: State["selectedProfession"];
  selectedProfile: State["selectedProfile"];
  selectedSocialBand: State["selectedSocialBand"];
  selectedSociety: State["selectedSociety"];
  selectedSocietyAccess: State["selectedSocietyAccess"];
}

export function ReviewStep({
  chargenRuleSet,
  draftView,
  educationLinkedSkillCount,
  languageSelectionSummary,
  motherTongueSummary,
  progression,
  selectableSkillSummary,
  selectedCivilization,
  selectedProfession,
  selectedProfile,
  selectedSocialBand,
  selectedSociety,
  selectedSocietyAccess,
}: ReviewStepProps) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "1rem",
        order: 11,
        padding: "1rem",
      }}
    >
      <h2 style={{ margin: 0 }}>10. Review summary</h2>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #e7e2d7",
            borderRadius: 10,
            display: "grid",
            gap: "0.35rem",
            padding: "1rem",
          }}
        >
          <strong>Character summary</strong>
          <div>Chargen rules: {chargenRuleSet.name}</div>
          <div>Profile: {selectedProfile?.label ?? "Not selected"}</div>
          <div>Civilization: {selectedCivilization?.name ?? "Not selected"}</div>
          <div>Society: {selectedSociety?.name ?? "Not selected"}</div>
          <div>Social band: {selectedSocialBand ?? "Not selected"}</div>
          <div>Social class: {selectedSocietyAccess?.socialClass ?? "Not selected"}</div>
          <div>Profession: {selectedProfession?.name ?? "Not selected"}</div>
          <div>
            Mother tongue:{" "}
            {motherTongueSummary.displayLabel
              ? `${motherTongueSummary.displayLabel} • XP ${motherTongueSummary.startingLevel}`
              : "Not selected"}
          </div>
          <div>
            Selected extra languages: {languageSelectionSummary.selectedOptionalLanguageIds.length}
          </div>
          <div>Learning Groups trained: {draftView.groups.length}</div>
          <div>Skills: {draftView.skills.length}</div>
          <div>
            Skills this Profession always teaches: {selectableSkillSummary.coreSkillIds.length}
          </div>
          <div>Training choices to make: {selectableSkillSummary.selectionSlots.length}</div>
          <div>Skills available to choose: {selectableSkillSummary.selectableSkillIds.length}</div>
          <div>Skills chosen: {selectableSkillSummary.selectedSkillIds.length}</div>
          <div>Specializations: {draftView.specializations.length}</div>
        </div>

        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #e7e2d7",
            borderRadius: 10,
            display: "grid",
            gap: "0.35rem",
            padding: "1rem",
          }}
        >
          <strong>Points and education</strong>
          <div>
            Rule set: {chargenRuleSet.name} ({chargenRuleSet.ordinarySkillPoints} ordinary, flexible
            x{chargenRuleSet.flexiblePointFactor})
          </div>
          <div>
            Ordinary points: allocated to training {progression.primaryPoolSpent} / still available{" "}
            {draftView.primaryPoolAvailable}
          </div>
          <div>
            Flexible points: allocated to training {progression.secondaryPoolSpent} / still
            available {draftView.secondaryPoolAvailable}
          </div>
          <div>Education: {draftView.education.theoreticalSkillCount}</div>
          <div>Base education: {draftView.education.baseEducation}</div>
          <div>Social class education value: {draftView.education.socialClassEducationValue}</div>
          <div>Education-linked skills: {educationLinkedSkillCount}</div>
          <small style={{ color: "#6d665a" }}>
            Education-linked skills are learned skills that add to Education.
          </small>
          <div>Points allocated to training in total: {draftView.totalSkillPointsInvested}</div>
        </div>
      </div>
    </section>
  );
}
