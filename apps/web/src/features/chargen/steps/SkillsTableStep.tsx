import type { useChargenWizardState } from "../useChargenWizardState";

type State = ReturnType<typeof useChargenWizardState>;

interface SkillsTableStepProps {
  groupedPlayerSkillTableRows: State["groupedPlayerSkillTableRows"];
}

export function SkillsTableStep({ groupedPlayerSkillTableRows }: SkillsTableStepProps) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "1rem",
        order: 9,
        padding: "1rem"
      }}
    >
      <h2 style={{ margin: 0 }}>9. Skills table</h2>

      {groupedPlayerSkillTableRows.length > 0 ? (
        <div
          style={{ display: "grid", gap: "1rem" }}
        >
          {groupedPlayerSkillTableRows.map((group) => (
            <section
              key={group.bucketId}
              style={{
                border: "1px solid #e7e2d7",
                borderRadius: 10,
                overflowX: "auto"
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  background: "#f6f5ef",
                  borderBottom: "1px solid #e7e2d7",
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem"
                }}
              >
                <strong>{group.label}</strong>
                <span style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                  {group.rows.length} skill{group.rows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div
                style={{
                  borderBottom: "1px solid #e7e2d7",
                  color: "#5e5a50",
                  display: "grid",
                  fontSize: "0.8rem",
                  gap: "0.75rem",
                  gridTemplateColumns:
                    "minmax(180px, 2fr) minmax(120px, 1.2fr) repeat(6, minmax(72px, 88px))",
                  padding: "0.75rem 1rem"
                }}
              >
                <strong>Skill</strong>
                <strong>Stats</strong>
                <strong>Avg stats</strong>
                <strong>Skill group XP</strong>
                <strong>Owned XP</strong>
                <strong>Derived preview</strong>
                <strong>Total XP</strong>
                <strong>Total skill level</strong>
              </div>

              {group.rows.map((skill) => (
                <div
                  key={skill.skillId}
                  style={{
                    borderTop: "1px solid #f0eadf",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns:
                      "minmax(180px, 2fr) minmax(120px, 1.2fr) repeat(6, minmax(72px, 88px))",
                    padding: "0.75rem 1rem"
                  }}
                >
                  <div>
                    <div>{skill.skillName}</div>
                    {skill.literacyWarning ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.8rem" }}>
                        {skill.literacyWarning}
                      </div>
                    ) : null}
                  </div>
                  <div>{skill.stats}</div>
                  <div>{skill.avgStats}</div>
                  <div>{skill.skillGroupXp}</div>
                  <div>{skill.skillXp}</div>
                  <div>{skill.grantedSkillXp}</div>
                  <div>{skill.totalXp}</div>
                  <div>{skill.totalSkillLevel}</div>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div>No skills in the draft yet.</div>
      )}
    </section>
  );
}
