import type { GlantriCharacteristicKey, RolledCharacterProfile } from "@glantri/domain";
import { glantriCharacteristicLabels, glantriCharacteristicOrder } from "@glantri/domain";

interface ResolveStatsStepProps {
  buildDecreaseStat: GlantriCharacteristicKey;
  buildDisabled: boolean;
  buildIncreaseStat: GlantriCharacteristicKey;
  buildLimit: number;
  exchangeDisabled: boolean;
  exchangeFirstStat: GlantriCharacteristicKey;
  exchangeLimit: number;
  exchangeSecondStat: GlantriCharacteristicKey;
  onBuildDecreaseStatChange: (stat: GlantriCharacteristicKey) => void;
  onBuildIncreaseStatChange: (stat: GlantriCharacteristicKey) => void;
  onBuildStats: () => void;
  onExchangeFirstStatChange: (stat: GlantriCharacteristicKey) => void;
  onExchangeSecondStatChange: (stat: GlantriCharacteristicKey) => void;
  onExchangeStats: () => void;
  onResetStatAdjustments: () => void;
  selectedAdjustment:
    | {
        buildsUsed: number;
        exchangesUsed: number;
        stats: Record<GlantriCharacteristicKey, number>;
      }
    | undefined;
  selectedProfile: unknown;
  selectedResolvedStats: Record<GlantriCharacteristicKey, number> | undefined;
  selectedRolledProfile: RolledCharacterProfile | undefined;
}

export function ResolveStatsStep({
  buildDecreaseStat,
  buildDisabled,
  buildIncreaseStat,
  buildLimit,
  exchangeDisabled,
  exchangeFirstStat,
  exchangeLimit,
  exchangeSecondStat,
  onBuildDecreaseStatChange,
  onBuildIncreaseStatChange,
  onBuildStats,
  onExchangeFirstStatChange,
  onExchangeSecondStatChange,
  onExchangeStats,
  onResetStatAdjustments,
  selectedAdjustment,
  selectedProfile,
  selectedResolvedStats,
  selectedRolledProfile,
}: ResolveStatsStepProps) {
  return (
    <section style={{ display: "grid", gap: "0.75rem", opacity: selectedRolledProfile ? 1 : 0.6 }}>
      <h2 style={{ margin: 0 }}>2. Resolve stats</h2>
      {selectedRolledProfile && selectedAdjustment && selectedProfile && selectedResolvedStats ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div
            style={{
              background: "#f6f5ef",
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
                gap: "1rem",
                gridTemplateColumns: "minmax(0, 520px) minmax(280px, 1fr)",
              }}
            >
              <div
                style={{
                  border: "1px solid #e6e2d5",
                  borderRadius: 10,
                  maxWidth: 520,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "#ece8da",
                    display: "grid",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    gap: "0.5rem",
                    gridTemplateColumns: "minmax(92px, 1fr) 56px 68px 56px",
                    letterSpacing: "0.02em",
                    padding: "0.55rem 0.75rem",
                    textTransform: "uppercase",
                  }}
                >
                  <span>Stat</span>
                  <span style={{ textAlign: "right" }}>Base</span>
                  <span style={{ textAlign: "right" }}>Adjusted</span>
                  <span style={{ textAlign: "right" }}>Final</span>
                </div>
                <div style={{ display: "grid" }}>
                  {glantriCharacteristicOrder.map((stat, index) => (
                    <div
                      key={`stat-row-${stat}`}
                      style={{
                        background: index % 2 === 0 ? "#f6f5ef" : "#f2efe6",
                        borderTop: index === 0 ? "none" : "1px solid #e6e2d5",
                        display: "grid",
                        fontSize: "0.92rem",
                        gap: "0.5rem",
                        gridTemplateColumns: "minmax(92px, 1fr) 56px 68px 56px",
                        padding: "0.5rem 0.75rem",
                      }}
                    >
                      <span>{glantriCharacteristicLabels[stat]}</span>
                      <strong style={{ textAlign: "right" }}>
                        {selectedRolledProfile.rolledStats[stat]}
                      </strong>
                      <strong style={{ textAlign: "right" }}>{selectedAdjustment.stats[stat]}</strong>
                      <strong style={{ textAlign: "right" }}>{selectedResolvedStats[stat]}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  background: "#f2efe6",
                  border: "1px solid #e6e2d5",
                  borderRadius: 10,
                  display: "grid",
                  gap: "0.75rem",
                  padding: "0.85rem",
                }}
              >
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div style={{ display: "grid", gap: "0.25rem" }}>
                    <strong style={{ fontSize: "0.9rem", fontWeight: 600 }}>Exchange</strong>
                    <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                      Exchanges: {selectedAdjustment.exchangesUsed} / {exchangeLimit}
                    </div>
                  </div>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.9rem" }}>Stat A</span>
                    <select
                      onChange={(event) =>
                        onExchangeFirstStatChange(event.target.value as GlantriCharacteristicKey)
                      }
                      value={exchangeFirstStat}
                    >
                      {glantriCharacteristicOrder.map((stat) => (
                        <option key={`exchange-a-${stat}`} value={stat}>
                          {glantriCharacteristicLabels[stat]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.9rem" }}>Stat B</span>
                    <select
                      onChange={(event) =>
                        onExchangeSecondStatChange(event.target.value as GlantriCharacteristicKey)
                      }
                      value={exchangeSecondStat}
                    >
                      {glantriCharacteristicOrder.map((stat) => (
                        <option key={`exchange-b-${stat}`} value={stat}>
                          {glantriCharacteristicLabels[stat]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={exchangeDisabled} onClick={onExchangeStats} type="button">
                    Swap
                  </button>
                </div>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div style={{ display: "grid", gap: "0.25rem" }}>
                    <strong style={{ fontSize: "0.9rem", fontWeight: 600 }}>Build</strong>
                    <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                      Builds: {selectedAdjustment.buildsUsed} / {buildLimit}
                    </div>
                  </div>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.9rem" }}>+ Stat</span>
                    <select
                      onChange={(event) =>
                        onBuildIncreaseStatChange(event.target.value as GlantriCharacteristicKey)
                      }
                      value={buildIncreaseStat}
                    >
                      {glantriCharacteristicOrder.map((stat) => (
                        <option key={`build-plus-${stat}`} value={stat}>
                          {glantriCharacteristicLabels[stat]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "0.25rem" }}>
                    <span style={{ fontSize: "0.9rem" }}>- Stat</span>
                    <select
                      onChange={(event) =>
                        onBuildDecreaseStatChange(event.target.value as GlantriCharacteristicKey)
                      }
                      value={buildDecreaseStat}
                    >
                      {glantriCharacteristicOrder.map((stat) => (
                        <option key={`build-minus-${stat}`} value={stat}>
                          {glantriCharacteristicLabels[stat]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={buildDisabled} onClick={onBuildStats} type="button">
                    Apply
                  </button>
                </div>
                <div style={{ paddingTop: "0.25rem" }}>
                  <button onClick={onResetStatAdjustments} type="button">
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            color: "#5e5a50",
            padding: "1rem",
          }}
        >
          Choose a rolled profile first to exchange or build stats.
        </div>
      )}
    </section>
  );
}
