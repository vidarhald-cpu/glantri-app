import type { RolledCharacterProfile } from "@glantri/domain";
import type { RolledProfileSummary } from "@glantri/rules-engine";

import styles from "./StatsStep.module.css";

interface StatsStepProps {
  formatProfileSocialBand: (profile: RolledCharacterProfile) => string;
  onExpandStats: () => void;
  onProfileSelect: (profileId: string) => void;
  onToggleStats: () => void;
  selectedProfileId: string | undefined;
  selectedRolledProfile: RolledCharacterProfile | undefined;
  selectedRolledProfileSummary: RolledProfileSummary | undefined;
  showRolledProfileOptions: boolean;
  sortedRolledProfiles: Array<{
    profile: RolledCharacterProfile;
    summary: RolledProfileSummary;
  }>;
}

export function StatsStep({
  formatProfileSocialBand,
  onExpandStats,
  onProfileSelect,
  onToggleStats,
  selectedProfileId,
  selectedRolledProfile,
  selectedRolledProfileSummary,
  showRolledProfileOptions,
  sortedRolledProfiles,
}: StatsStepProps) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>1. Stats</h2>
        <button onClick={onToggleStats} type="button">
          {showRolledProfileOptions ? "Collapse stats" : "Expand stats"}
        </button>
      </div>
      {selectedRolledProfile && !showRolledProfileOptions ? (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <strong>{selectedRolledProfile.label}</strong>
            <button onClick={onExpandStats} type="button">
              Expand stats
            </button>
          </div>
          <div className={styles.summaryRow}>
            <div>Total {selectedRolledProfileSummary?.totalCharacteristicSum ?? 0}</div>
            <div>Distraction {selectedRolledProfile.distractionLevel}</div>
            <div>Social band {formatProfileSocialBand(selectedRolledProfile)}</div>
          </div>
        </div>
      ) : showRolledProfileOptions ? (
        <div className={styles.profileList}>
          {sortedRolledProfiles.map(({ profile, summary }) => (
            <label key={profile.id} className={styles.profileOption}>
              <input
                checked={selectedProfileId === profile.id}
                name="profile"
                onChange={() => onProfileSelect(profile.id)}
                type="radio"
              />
              <div className={styles.profileOptionHeader}>
                <strong>{profile.label}</strong>
                <strong>Total {summary.totalCharacteristicSum}</strong>
              </div>
              <div className={styles.profileDetails}>
                <div>Distraction level: {summary.distractionLevel}</div>
                <div>Social band: {formatProfileSocialBand(profile)}</div>
              </div>
              <div className={styles.statsGrid}>
                {summary.characteristics.map((characteristic) => (
                  <div key={characteristic.key} className={styles.statCell}>
                    <div className={styles.statLabel}>{characteristic.label}</div>
                    <strong>{characteristic.value}</strong>
                  </div>
                ))}
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className={styles.placeholder}>
          Expand stats to review the rolled profiles.
        </div>
      )}
    </section>
  );
}
