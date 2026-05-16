import type { CharacterPhysicalStateView } from "@/lib/characters/physicalState";

interface PhysicalStateSectionProps {
  model: CharacterPhysicalStateView;
}

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

const tableStyle = {
  borderCollapse: "collapse",
  fontSize: "0.95rem",
  width: "100%",
} as const;

const cellStyle = {
  borderBottom: "1px solid #e6e8e3",
  padding: "0.45rem",
  textAlign: "left",
} as const;

function HitpointsPanel({ model }: PhysicalStateSectionProps) {
  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0 }}>Hitpoints</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Location</th>
              <th style={cellStyle}>Original</th>
              <th style={cellStyle}>Damage</th>
              <th style={cellStyle}>Current</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cellStyle}>General hitpoints</td>
              <td style={cellStyle}>{model.hitpoints.general.original}</td>
              <td style={cellStyle}>{model.hitpoints.general.damage}</td>
              <td style={cellStyle}>{model.hitpoints.general.current}</td>
            </tr>
            {model.hitpoints.locations.map((location) => (
              <tr key={location.id}>
                <td style={cellStyle}>
                  {location.label} — weight {location.weightNumerator}/
                  {location.weightDenominator}
                </td>
                <td style={cellStyle}>{location.original}</td>
                <td style={cellStyle}>{location.damage}</td>
                <td style={cellStyle}>{location.current}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DamageByTypePanel({ model }: PhysicalStateSectionProps) {
  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0 }}>Damage by type</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Type</th>
              <th style={cellStyle}>Current effect</th>
            </tr>
          </thead>
          <tbody>
            {model.damageByType.map((row) => (
              <tr key={row.id}>
                <td style={cellStyle}>{row.label}</td>
                <td style={cellStyle}>{row.currentEffect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HitLogPanel({ model }: PhysicalStateSectionProps) {
  return (
    <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
      <h3 style={{ margin: 0 }}>Log of hits</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Source</th>
              <th style={cellStyle}>Type</th>
              <th style={cellStyle}>Location</th>
              <th style={cellStyle}>Damage</th>
              <th style={cellStyle}>General damage</th>
              <th style={cellStyle}>Duration</th>
              <th style={cellStyle}>Special effects</th>
            </tr>
          </thead>
          <tbody>
            {model.hitLog.length > 0 ? (
              model.hitLog.map((entry) => (
                <tr key={entry.id}>
                  <td style={cellStyle}>{entry.source}</td>
                  <td style={cellStyle}>{entry.type}</td>
                  <td style={cellStyle}>{entry.location}</td>
                  <td style={cellStyle}>{entry.damage}</td>
                  <td style={cellStyle}>{entry.generalDamage}</td>
                  <td style={cellStyle}>{entry.duration}</td>
                  <td style={cellStyle}>{entry.specialEffects}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={cellStyle}>
                  No hits recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PhysicalStateSection({ model }: PhysicalStateSectionProps) {
  return (
    <section style={{ display: "grid", gap: "0.75rem" }}>
      <h2 style={{ margin: 0 }}>Physical state</h2>
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <HitpointsPanel model={model} />
        <DamageByTypePanel model={model} />
        <HitLogPanel model={model} />
      </div>
    </section>
  );
}
