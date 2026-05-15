import { formatDerivedSkillSourceLabel } from "@/lib/characters/derivedSkillLabels";
import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface SpecializationTableStepProps {
  draftView: State["draftView"];
}

export function SpecializationTableStep({ draftView }: SpecializationTableStepProps) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "1rem",
        order: 10,
        padding: "1rem"
      }}
    >
      <h2 style={{ margin: 0 }}>9b. Specialization Table</h2>
      {draftView.specializations.length > 0 ? (
        <div
          style={{
            border: "1px solid #e7e2d7",
            borderRadius: 10,
            overflowX: "auto"
          }}
        >
          <div
            style={{
              borderBottom: "1px solid #e7e2d7",
              color: "#5e5a50",
              display: "grid",
              fontSize: "0.8rem",
              gap: "0.75rem",
              gridTemplateColumns:
                "minmax(180px, 2fr) minmax(160px, 1.6fr) repeat(3, minmax(80px, 92px))",
              padding: "0.75rem 1rem"
            }}
          >
            <strong>Specialization</strong>
            <strong>Parent skill</strong>
            <strong>Direct XP</strong>
            <strong>Derived preview</strong>
            <strong>Total</strong>
          </div>

          {draftView.specializations.map((specialization) => (
            <div
              key={specialization.specializationId}
              style={{
                borderTop: "1px solid #f0eadf",
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns:
                  "minmax(180px, 2fr) minmax(160px, 1.6fr) repeat(3, minmax(80px, 92px))",
                padding: "0.75rem 1rem"
              }}
            >
              <div>
                <div>{specialization.name}</div>
                {specialization.relationshipGrantedSourceSkillName ? (
                  <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                    {formatDerivedSkillSourceLabel({
                      sourceSkillName: specialization.relationshipGrantedSourceSkillName,
                      sourceType: specialization.relationshipGrantedSourceType
                    })}
                  </div>
                ) : null}
              </div>
              <div>{specialization.parentSkillName}</div>
              <div>{specialization.secondaryRanks}</div>
              <div>{specialization.relationshipGrantedPreviewLevel ?? 0}</div>
              <div>{specialization.effectiveSpecializationNumber}</div>
            </div>
          ))}
        </div>
      ) : (
        <div>No specializations in the draft yet.</div>
      )}
    </section>
  );
}
