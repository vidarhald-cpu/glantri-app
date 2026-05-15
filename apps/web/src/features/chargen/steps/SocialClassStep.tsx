import { getBandRangeLabel } from "../chargenWizardHelpers";
import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface SocialClassStepProps {
  selectedCivilization: State["selectedCivilization"];
  selectedProfile: State["selectedProfile"];
  selectedSocialBand: State["selectedSocialBand"];
  selectedSociety: State["selectedSociety"];
  selectedSocietyAccess: State["selectedSocietyAccess"];
}

export function SocialClassStep({
  selectedCivilization,
  selectedProfile,
  selectedSocialBand,
  selectedSociety,
  selectedSocietyAccess
}: SocialClassStepProps) {
  return (
    <section
      style={{
        display: "grid",
        gap: "0.75rem",
        opacity: selectedProfile && selectedSociety ? 1 : 0.6
      }}
    >
      <h2 style={{ margin: 0 }}>4. Social class</h2>
      <div style={{ fontSize: "0.95rem" }}>
        Your social roll maps to one of four universal bands. Civilization is the cultural
        selector, while the inferred society determines the structural class label for that band.
      </div>
      <div
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          padding: "1rem"
        }}
      >
        {selectedProfile && selectedSociety && selectedSocialBand !== undefined && selectedSocietyAccess ? (
          <>
            <div>Civilization: {selectedCivilization?.name ?? "Not selected"}</div>
            <div>Society: {selectedSociety.name}</div>
            <div>Roll: {selectedProfile.socialClassRoll ?? "?"}</div>
            <div>
              Band: {selectedSocialBand} ({getBandRangeLabel(selectedSocialBand)})
            </div>
            <div>
              Social class: <strong>{selectedSocietyAccess.socialClass}</strong>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              This result determines later skill, base education, and profession access.
            </div>
          </>
        ) : (
          <span>Select a rolled profile to reveal social status.</span>
        )}
      </div>
    </section>
  );
}
