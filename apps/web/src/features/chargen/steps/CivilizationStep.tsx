import { formatSocietyBandLabels } from "../chargenWizardHelpers";
import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface CivilizationStepProps {
  civilizations: State["civilizations"];
  handleCivilizationChange: State["handleCivilizationChange"];
  languageSelectionSummary: State["languageSelectionSummary"];
  motherTongueSummary: State["motherTongueSummary"];
  selectedCivilization: State["selectedCivilization"];
  selectedCivilizationId: State["selectedCivilizationId"];
  selectedProfile: State["selectedProfile"];
  selectedSociety: State["selectedSociety"];
  setShowCivilizationChooser: State["setShowCivilizationChooser"];
  showCivilizationChooser: State["showCivilizationChooser"];
}

export function CivilizationStep({
  civilizations,
  handleCivilizationChange,
  languageSelectionSummary,
  motherTongueSummary,
  selectedCivilization,
  selectedCivilizationId,
  selectedProfile,
  selectedSociety,
  setShowCivilizationChooser,
  showCivilizationChooser
}: CivilizationStepProps) {
  return (
    <section style={{ display: "grid", gap: "0.75rem", opacity: selectedProfile ? 1 : 0.6 }}>
      <h2 style={{ margin: 0 }}>3. Choose civilization</h2>
      <div style={{ fontSize: "0.95rem" }}>
        Choose the civilization that frames this character&apos;s culture and language naming.
        Chargen will infer the linked society automatically for class labels, foundational
        access, education, and profession access.
      </div>
      {selectedCivilization && !showCivilizationChooser ? (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "0.75rem",
            padding: "1rem"
          }}
        >
          <div
            style={{
              alignItems: "start",
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "minmax(0, 1fr) auto"
            }}
          >
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <strong>{selectedCivilization.name}</strong>
              <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                {selectedCivilization.shortDescription ??
                  "Selected civilization for cultural framing and language naming."}
              </div>
            </div>
            <button
              disabled={!selectedProfile}
              onClick={() => setShowCivilizationChooser(true)}
              type="button"
            >
              Change civilization
            </button>
          </div>
          <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.9rem" }}>
            <div>
              Spoken language: {selectedCivilization.spokenLanguageName}
              {selectedCivilization.writtenLanguageName &&
              selectedCivilization.writtenLanguageName !== selectedCivilization.spokenLanguageName
                ? ` • Written ${selectedCivilization.writtenLanguageName}`
                : ""}
            </div>
            <div>
              Inferred society: {selectedCivilization.linkedSocietyName} • Level{" "}
              {selectedCivilization.linkedSocietyLevel}
            </div>
            {motherTongueSummary.displayLabel ? (
              <div>
                Mother tongue: {motherTongueSummary.displayLabel} • Starting XP{" "}
                {motherTongueSummary.startingLevel}
              </div>
            ) : null}
            {languageSelectionSummary.selectableLanguages.length > 0 ? (
              <div>
                Optional languages:{" "}
                {languageSelectionSummary.selectableLanguages.map((language) => language.name).join(", ")}
              </div>
            ) : null}
            <div>Band labels: {selectedSociety ? formatSocietyBandLabels(selectedSociety) : "—"}</div>
            {selectedCivilization.historicalAnalogue ? (
              <div>Historical analogue: {selectedCivilization.historicalAnalogue}</div>
            ) : null}
            {selectedCivilization.period ? <div>Period: {selectedCivilization.period}</div> : null}
            {selectedCivilization.notes ? <div>{selectedCivilization.notes}</div> : null}
            {civilizations.length === 1 ? <div>Only available civilization at present.</div> : null}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {selectedCivilization ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                disabled={!selectedProfile}
                onClick={() => setShowCivilizationChooser(false)}
                type="button"
              >
                Collapse selected summary
              </button>
            </div>
          ) : null}
          {civilizations.map((civilization) => (
            <label
              key={civilization.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                cursor: selectedProfile ? "pointer" : "not-allowed",
                padding: "1rem"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  checked={selectedCivilizationId === civilization.id}
                  disabled={!selectedProfile}
                  name="civilization"
                  onChange={() => handleCivilizationChange(civilization.id)}
                  type="radio"
                />
                <strong>{civilization.name}</strong>
              </div>
              <div style={{ marginTop: "0.5rem", color: "#5e5a50", fontSize: "0.9rem" }}>
                {civilization.shortDescription}
              </div>
              <div style={{ marginTop: "0.25rem" }}>
                Spoken language: {civilization.spokenLanguageName}
                {civilization.writtenLanguageName &&
                civilization.writtenLanguageName !== civilization.spokenLanguageName
                  ? ` • Written ${civilization.writtenLanguageName}`
                  : ""}
              </div>
              <div style={{ marginTop: "0.25rem" }}>
                Society: {civilization.linkedSocietyName} • Level {civilization.linkedSocietyLevel}
              </div>
              {civilization.historicalAnalogue ? (
                <div style={{ marginTop: "0.25rem" }}>
                  Historical analogue: {civilization.historicalAnalogue}
                </div>
              ) : null}
              {civilizations.length === 1 ? (
                <div style={{ marginTop: "0.25rem" }}>Only available civilization at present.</div>
              ) : null}
              {civilization.notes ? (
                <div style={{ marginTop: "0.25rem" }}>{civilization.notes}</div>
              ) : null}
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
