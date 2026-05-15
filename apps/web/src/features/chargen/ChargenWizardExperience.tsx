"use client";

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
  ProfessionStep
} from "./steps";

export default function ChargenWizard() {
  const state = useChargenWizardState();

  return (
    <section style={{ display: "grid", gap: "1.5rem", maxWidth: 1080 }}>
      <div>
        <h1 style={{ marginBottom: "0.25rem" }}>Chargen</h1>
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>Draft saved locally.</div>
      </div>

      <FeedbackPanel messages={state.feedback} />

      {!state.hasStartedChargen ? (
        <StartStep onStart={() => void state.handleStartChargen()} />
      ) : null}

      {state.hasStartedChargen ? (
        <>
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
          <SocialClassStep
            selectedCivilization={state.selectedCivilization}
            selectedProfile={state.selectedProfile}
            selectedSocialBand={state.selectedSocialBand}
            selectedSociety={state.selectedSociety}
            selectedSocietyAccess={state.selectedSocietyAccess}
          />
          <ProfessionStep
            activeProfessionPreviewId={state.activeProfessionPreviewId}
            availableProfessions={state.availableProfessions}
            availableProfessionCards={state.availableProfessionCards}
            handleProfessionChange={state.handleProfessionChange}
            professionFamilyFilter={state.professionFamilyFilter}
            professionFamilyOptions={state.professionFamilyOptions}
            professionSearch={state.professionSearch}
            selectedProfessionCard={state.selectedProfessionCard}
            selectedProfessionId={state.selectedProfessionId}
            selectedSociety={state.selectedSociety}
            selectedSocietyAccess={state.selectedSocietyAccess}
            setProfessionFamilyFilter={state.setProfessionFamilyFilter}
            setProfessionSearch={state.setProfessionSearch}
            setShowProfessionChooser={state.setShowProfessionChooser}
            showProfessionChooser={state.showProfessionChooser}
            toggleProfessionPreview={state.toggleProfessionPreview}
            visibleProfessionCards={state.visibleProfessionCards}
          />
          <SkillAllocationStep state={state} />
          <SkillsTableStep groupedPlayerSkillTableRows={state.groupedPlayerSkillTableRows} />
          <SpecializationTableStep draftView={state.draftView} />
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
          <FinalizeStep
            characterName={state.characterName}
            currentUser={state.currentUser}
            handleFinalize={state.handleFinalize}
            isFinalizing={state.isFinalizing}
            review={state.review}
            setCharacterName={state.setCharacterName}
          />
        </>
      ) : null}
    </section>
  );
}
