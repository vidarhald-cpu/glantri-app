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
  selectedSocietyAccess
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
        padding: "1rem"
      }}
    >
      <h2 style={{ margin: 0 }}>10. Review summary</h2>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
        }}
      >
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #e7e2d7",
            borderRadius: 10,
            display: "grid",
            gap: "0.35rem",
            padding: "1rem"
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
          <div>Selected extra languages: {languageSelectionSummary.selectedOptionalLanguageIds.length}</div>
          <div>Skill groups: {draftView.groups.length}</div>
          <div>Skills: {draftView.skills.length}</div>
          <div>Core skills: {selectableSkillSummary.coreSkillIds.length}</div>
          <div>Required group choices: {selectableSkillSummary.selectionSlots.length}</div>
          <div>Selectable pool: {selectableSkillSummary.selectableSkillIds.length}</div>
          <div>Chosen skills: {selectableSkillSummary.selectedSkillIds.length}</div>
          <div>Specializations: {draftView.specializations.length}</div>
        </div>

        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #e7e2d7",
            borderRadius: 10,
            display: "grid",
            gap: "0.35rem",
            padding: "1rem"
          }}
        >
          <strong>Points and education</strong>
          <div>
            Rule set: {chargenRuleSet.name} ({chargenRuleSet.ordinarySkillPoints} ordinary, flexible x
            {chargenRuleSet.flexiblePointFactor})
          </div>
          <div>
            Ordinary points: {progression.primaryPoolSpent} spent /{" "}
            {draftView.primaryPoolAvailable} remaining
          </div>
          <div>
            Flexible points: {progression.secondaryPoolSpent} spent /{" "}
            {draftView.secondaryPoolAvailable} remaining
          </div>
          <div>Education: {draftView.education.theoreticalSkillCount}</div>
          <div>Base education: {draftView.education.baseEducation}</div>
          <div>Social class education value: {draftView.education.socialClassEducationValue}</div>
          <div>Education-linked skills: {educationLinkedSkillCount}</div>
          <small style={{ color: "#6d665a" }}>
            Education-linked skills are learned skills that add to Education. Review skill
            metadata in Admin -&gt; Skills.
          </small>
          <div>Total skill points invested: {draftView.totalSkillPointsInvested}</div>
        </div>

      </div>
    </section>
  );
}
