"use client";

import { useState } from "react";

import styles from "./ChargenWizardExperience.module.css";
import { defaultCanonicalContent } from "@glantri/content";
import { useChargenWizardState } from "./useChargenWizardState";
import { FeedbackPanel } from "./components";
import { formatProfileSocialBand } from "./chargenWizardHelpers";
import {
  CivilizationStep,
  FinalizeStep,
  ReviewStep,
  SkillAllocationStep,
  SkillsTableStep,
  SocialClassStep,
  SpecializationTableStep,
  StartStep,
  StatsStep,
  ResolveStatsStep,
  ProfessionStep,
} from "./steps";

export default function ChargenWizard() {
  const state = useChargenWizardState();
  const [requestedStepIndex, setRequestedStepIndex] = useState(0);

  if (state.historicalDraft) {
    const draft = state.historicalDraft;
    return (
      <section>
        <h1>Historical Chargen draft</h1>
        <p>{draft.characterName || draft.selectedProfile?.label}</p>
        <p>
          Profession:{" "}
          {defaultCanonicalContent.professions.find((p) => p.id === draft.selectedProfessionId)
            ?.name ?? draft.selectedProfessionId}
        </p>
        <p>
          Recorded ordinary spend: {draft.progression.primaryPoolSpent}. Recorded flexible spend:{" "}
          {draft.progression.secondaryPoolSpent}.
        </p>
        <ul>
          {draft.progression.skillGroups.map((g) => (
            <li key={g.groupId}>
              {g.targetDefinition?.name ??
                defaultCanonicalContent.skillGroups.find((d) => d.id === g.groupId)?.name ??
                g.groupId}
              : {g.ranks} ranks
            </li>
          ))}
        </ul>
        <p>
          This historical draft is preserved for reading. Its identities and recorded spending have
          not been converted to the target catalogue.
        </p>
        <StartStep
          onStartNew={() => void state.handleStartChargen()}
          savedDraft={{
            description: draft.characterName || draft.selectedProfile?.label || "Unnamed draft",
            kind: "historical",
          }}
        />
      </section>
    );
  }

  /**
   * Presentational step sequence. Every value these steps read or write lives in
   * `useChargenWizardState`, which is held here on the wizard and therefore stays mounted while
   * only the active step is rendered. The labels are the existing step headings verbatim, so the
   * sequence and wording stay the ones the steps already own.
   */
  const stepSequence = state.hasStartedChargen
    ? [
        {
          label: "1. Stats",
          node: (
            <StatsStep
              formatProfileSocialBand={formatProfileSocialBand}
              onExpandStats={() => state.setShowRolledProfileOptions(true)}
              onProfileSelect={state.handleProfileSelect}
              onToggleStats={() => state.setShowRolledProfileOptions((current) => !current)}
              selectedProfileId={state.selectedProfileId}
              selectedRolledProfile={state.selectedRolledProfile}
              selectedRolledProfileSummary={state.selectedRolledProfileSummary}
              showRolledProfileOptions={state.showRolledProfileOptions}
              sortedRolledProfiles={state.sortedRolledProfiles}
            />
          ),
        },
        {
          label: "2. Resolve stats",
          node: (
            <ResolveStatsStep
              buildDecreaseStat={state.buildDecreaseStat}
              buildDisabled={state.buildDisabled}
              buildIncreaseStat={state.buildIncreaseStat}
              buildLimit={state.chargenPolicy.maxBuilds}
              exchangeDisabled={state.exchangeDisabled}
              exchangeFirstStat={state.exchangeFirstStat}
              exchangeLimit={state.chargenPolicy.maxExchanges}
              exchangeSecondStat={state.exchangeSecondStat}
              onBuildDecreaseStatChange={state.setBuildDecreaseStat}
              onBuildIncreaseStatChange={state.setBuildIncreaseStat}
              onBuildStats={state.handleBuildStats}
              onExchangeFirstStatChange={state.setExchangeFirstStat}
              onExchangeSecondStatChange={state.setExchangeSecondStat}
              onExchangeStats={state.handleExchangeStats}
              onResetStatAdjustments={state.handleResetStatAdjustments}
              selectedAdjustment={state.selectedAdjustment}
              selectedProfile={state.selectedProfile}
              selectedResolvedStats={state.selectedResolvedStats}
              selectedRolledProfile={state.selectedRolledProfile}
            />
          ),
        },
        {
          label: "3. Choose civilization",
          node: (
            <CivilizationStep
              civilizations={state.civilizations}
              handleCivilizationChange={state.handleCivilizationChange}
              languageSelectionSummary={state.languageSelectionSummary}
              motherTongueSummary={state.motherTongueSummary}
              selectedCivilization={state.selectedCivilization}
              selectedCivilizationId={state.selectedCivilizationId}
              selectedProfile={state.selectedProfile}
              selectedSociety={state.selectedSociety}
              setShowCivilizationChooser={state.setShowCivilizationChooser}
              showCivilizationChooser={state.showCivilizationChooser}
            />
          ),
        },
        {
          label: "4. Social class",
          node: (
            <SocialClassStep
              selectedCivilization={state.selectedCivilization}
              selectedProfile={state.selectedProfile}
              selectedSocialBand={state.selectedSocialBand}
              selectedSociety={state.selectedSociety}
              selectedSocietyAccess={state.selectedSocietyAccess}
            />
          ),
        },
        {
          label: "5. Choose profession",
          node: (
            <ProfessionStep
              activeProfessionPreviewId={state.activeProfessionPreviewId}
              availableProfessions={state.availableProfessions}
              handleProfessionChange={state.handleProfessionChange}
              professionBrowseModel={state.professionBrowseModel}
              professionCategoryFilter={state.professionCategoryFilter}
              professionCategoryOptions={state.professionCategoryOptions}
              professionSearch={state.professionSearch}
              selectedProfessionCard={state.selectedProfessionCard}
              selectedProfessionId={state.selectedProfessionId}
              selectedSociety={state.selectedSociety}
              selectedSocietyAccess={state.selectedSocietyAccess}
              setProfessionCategoryFilter={state.setProfessionCategoryFilter}
              setProfessionSearch={state.setProfessionSearch}
              setShowProfessionChooser={state.setShowProfessionChooser}
              showProfessionChooser={state.showProfessionChooser}
              toggleProfessionPreview={state.toggleProfessionPreview}
              visibleProfessionCards={state.visibleProfessionCards}
            />
          ),
        },
        {
          label: "6. Skill allocation",
          node: <SkillAllocationStep state={state} />,
        },
        {
          label: "9. Skills table",
          node: <SkillsTableStep groupedPlayerSkillTableRows={state.groupedPlayerSkillTableRows} />,
        },
        {
          label: "9b. Specialization Table",
          node: <SpecializationTableStep draftView={state.draftView} />,
        },
        {
          label: "10. Review summary",
          node: (
            <ReviewStep
              chargenRuleSet={state.chargenRuleSet}
              draftView={state.draftView}
              educationLinkedSkillCount={state.educationLinkedSkillCount}
              languageSelectionSummary={state.languageSelectionSummary}
              motherTongueSummary={state.motherTongueSummary}
              progression={state.progression}
              selectableSkillSummary={state.selectableSkillSummary}
              selectedCivilization={state.selectedCivilization}
              selectedProfession={state.selectedProfession}
              selectedProfile={state.selectedProfile}
              selectedSocialBand={state.selectedSocialBand}
              selectedSociety={state.selectedSociety}
              selectedSocietyAccess={state.selectedSocietyAccess}
            />
          ),
        },
        {
          label: "11. Finalize character",
          node: (
            <FinalizeStep
              characterName={state.characterName}
              currentUser={state.currentUser}
              handleFinalize={state.handleFinalize}
              isFinalizing={state.isFinalizing}
              review={state.review}
              setCharacterName={state.setCharacterName}
            />
          ),
        },
      ]
    : [];
  const activeStepIndex = Math.min(Math.max(requestedStepIndex, 0), stepSequence.length - 1);
  const activeStep = stepSequence[activeStepIndex];

  return (
    <section
      className={styles.wizard}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: "1.5rem",
        maxWidth: 1080,
      }}
    >
      <div>
        <h1 style={{ marginBottom: "0.25rem" }}>Chargen</h1>
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>Draft saved locally.</div>
      </div>

      <FeedbackPanel messages={state.feedback} />

      {!state.hydrated ? <div role="status">Loading Chargen…</div> : null}

      {state.hydrated && !state.hasStartedChargen ? (
        <StartStep
          onResume={state.resumableDraft ? state.handleResumeChargen : undefined}
          onStartNew={() => void state.handleStartChargen()}
          savedDraft={
            state.resumableDraft
              ? {
                  description:
                    state.resumableDraft.characterName ||
                    state.resumableDraft.selectedProfile?.label ||
                    "Unnamed draft",
                  kind: "current",
                }
              : undefined
          }
        />
      ) : null}

      {activeStep ? (
        <>
          <nav aria-label="Chargen steps" className={styles.grid05}>
            <div className={styles.flexWrap035}>
              {stepSequence.map((step, index) => (
                <button
                  aria-current={index === activeStepIndex ? "step" : undefined}
                  className={
                    index === activeStepIndex ? styles.toggleButtonSelected : styles.toggleButton
                  }
                  key={step.label}
                  onClick={() => setRequestedStepIndex(index)}
                  type="button"
                >
                  {step.label}
                </button>
              ))}
            </div>
            <div className={styles.flexCenterBetween}>
              <button
                disabled={activeStepIndex === 0}
                onClick={() => setRequestedStepIndex(activeStepIndex - 1)}
                type="button"
              >
                Previous step
              </button>
              <span className={styles.muted}>
                Step {activeStepIndex + 1} of {stepSequence.length}
              </span>
              <button
                disabled={activeStepIndex === stepSequence.length - 1}
                onClick={() => setRequestedStepIndex(activeStepIndex + 1)}
                type="button"
              >
                Next step
              </button>
            </div>
          </nav>
          {activeStep.node}
        </>
      ) : null}
    </section>
  );
}
