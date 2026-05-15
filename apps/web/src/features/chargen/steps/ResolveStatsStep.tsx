import type { GlantriCharacteristicKey, RolledCharacterProfile } from "@glantri/domain";
import { glantriCharacteristicLabels, glantriCharacteristicOrder } from "@glantri/domain";

import styles from "./ResolveStatsStep.module.css";

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
    <section className={`${styles.section}${!selectedRolledProfile ? ` ${styles.dimmed}` : ""}`}>
      <h2 className={styles.heading}>2. Resolve stats</h2>
      {selectedRolledProfile && selectedAdjustment && selectedProfile && selectedResolvedStats ? (
        <div className={styles.content}>
          <div className={styles.card}>
            <div className={styles.twoCol}>
              <div className={styles.statTable}>
                <div className={styles.statTableHeader}>
                  <span>Stat</span>
                  <span className={styles.statTableHeaderCell}>Base</span>
                  <span className={styles.statTableHeaderCell}>Adjusted</span>
                  <span className={styles.statTableHeaderCell}>Final</span>
                </div>
                <div className={styles.statTableBody}>
                  {glantriCharacteristicOrder.map((stat) => (
                    <div key={`stat-row-${stat}`} className={styles.statRow}>
                      <span>{glantriCharacteristicLabels[stat]}</span>
                      <strong className={styles.statCellRight}>
                        {selectedRolledProfile.rolledStats[stat]}
                      </strong>
                      <strong className={styles.statCellRight}>{selectedAdjustment.stats[stat]}</strong>
                      <strong className={styles.statCellRight}>{selectedResolvedStats[stat]}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.controlPanel}>
                <div className={styles.controlGroup}>
                  <div className={styles.controlGroupHeader}>
                    <strong className={styles.controlLabel}>Exchange</strong>
                    <div className={styles.controlSubtext}>
                      Exchanges: {selectedAdjustment.exchangesUsed} / {exchangeLimit}
                    </div>
                  </div>
                  <label className={styles.formLabel}>
                    <span className={styles.formLabelText}>Stat A</span>
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
                  <label className={styles.formLabel}>
                    <span className={styles.formLabelText}>Stat B</span>
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
                <div className={styles.controlGroup}>
                  <div className={styles.controlGroupHeader}>
                    <strong className={styles.controlLabel}>Build</strong>
                    <div className={styles.controlSubtext}>
                      Builds: {selectedAdjustment.buildsUsed} / {buildLimit}
                    </div>
                  </div>
                  <label className={styles.formLabel}>
                    <span className={styles.formLabelText}>+ Stat</span>
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
                  <label className={styles.formLabel}>
                    <span className={styles.formLabelText}>- Stat</span>
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
                <div className={styles.resetRow}>
                  <button onClick={onResetStatAdjustments} type="button">
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.placeholder}>
          Choose a rolled profile first to exchange or build stats.
        </div>
      )}
    </section>
  );
}
